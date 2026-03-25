import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CompiledFloorArtifact,
  StartRunCompileContext,
  TransitionCompileContext,
  CompilerProgress
} from '@hop/engine';
import { emitUiMetric } from './ui-telemetry';
import type { WorldgenWorkerRequest, WorldgenWorkerResponse } from './worldgen-worker-protocol';

interface PendingRequest {
  resolve: (artifact: CompiledFloorArtifact) => void;
  reject: (error: Error) => void;
}

interface InitializationRequest {
  startedAt: number;
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}

export type WorldgenCompilePhase = 'idle' | 'initializing' | 'ready' | 'compiling' | 'error';

export interface WorldgenCompileJobState {
  requestId: string;
  requestType: 'COMPILE_RUN_START' | 'COMPILE_PENDING_FLOOR';
  progress: CompilerProgress;
}

export interface WorldgenWorkerState {
  initialized: boolean;
  ready: boolean;
  contractVersion?: string;
  runtimeApiVersion?: string;
  error?: string;
  phase: WorldgenCompilePhase;
  progress?: CompilerProgress;
  job?: WorldgenCompileJobState;
  ensureReady: () => Promise<void>;
  compileRunStart: (context: StartRunCompileContext) => Promise<CompiledFloorArtifact>;
  compilePendingFloor: (context: TransitionCompileContext) => Promise<CompiledFloorArtifact>;
}

const INITIAL_PROGRESS: CompilerProgress = {
  pass: 'normalizeSpec',
  percent: 0
};

const createInitializationRequest = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return {
    startedAt: Date.now(),
    promise,
    resolve,
    reject
  } satisfies InitializationRequest;
};

export const ensureCompileWorker = async <TWorker extends object>({
  workerRef,
  reinitializeWorker
}: {
  workerRef: { current: TWorker | null };
  reinitializeWorker: () => Promise<void>;
}): Promise<TWorker> => {
  if (workerRef.current) {
    return workerRef.current;
  }

  await reinitializeWorker();

  if (workerRef.current) {
    return workerRef.current;
  }

  throw new Error('Worldgen worker unavailable');
};

export const useWorldgenWorker = (): WorldgenWorkerState => {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<string, PendingRequest>());
  const activeRequestIdRef = useRef<string | null>(null);
  const requestCounterRef = useRef(0);
  const initializationRef = useRef<InitializationRequest | null>(null);
  const firstCompileStartedAtRef = useRef<number | null>(null);
  const firstCompileMetricSentRef = useRef(false);
  const [state, setState] = useState<Omit<WorldgenWorkerState, 'ensureReady' | 'compileRunStart' | 'compilePendingFloor'>>({
    initialized: false,
    ready: false,
    phase: 'idle'
  });

  const emitRuntimeErrorMetric = useCallback((message: string, details?: Record<string, unknown>) => {
    emitUiMetric('worldgen_runtime_error', 1, {
      message,
      ...details
    });
  }, []);

  const emitFirstCompileMetric = useCallback(() => {
    if (firstCompileMetricSentRef.current || firstCompileStartedAtRef.current === null) return;
    emitUiMetric('worldgen_first_compile_ms', Date.now() - firstCompileStartedAtRef.current);
    firstCompileMetricSentRef.current = true;
    firstCompileStartedAtRef.current = null;
  }, []);

  const rejectInitialization = useCallback((message: string) => {
    const pendingInitialization = initializationRef.current;
    if (!pendingInitialization) return;
    initializationRef.current = null;
    pendingInitialization.reject(new Error(message));
  }, []);

  const resolveInitialization = useCallback((contractVersion: string, runtimeApiVersion: string) => {
    const pendingInitialization = initializationRef.current;
    if (!pendingInitialization) return;
    emitUiMetric('worldgen_init_ms', Date.now() - pendingInitialization.startedAt, {
      contractVersion,
      runtimeApiVersion
    });
    initializationRef.current = null;
    pendingInitialization.resolve();
  }, []);

  const rejectActiveCompile = useCallback((message: string) => {
    const activeRequestId = activeRequestIdRef.current;
    if (!activeRequestId) return;
    const pending = pendingRef.current.get(activeRequestId);
    if (pending) {
      pendingRef.current.delete(activeRequestId);
      pending.reject(new Error(message));
    }
    activeRequestIdRef.current = null;
    emitFirstCompileMetric();
  }, [emitFirstCompileMetric]);

  const disposeWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  const setFatalErrorState = useCallback((message: string, details?: Record<string, unknown>) => {
    emitRuntimeErrorMetric(message, details);
    setState((previous) => ({
      ...previous,
      initialized: false,
      ready: false,
      error: message,
      phase: 'error',
      progress: undefined,
      job: undefined
    }));
  }, [emitRuntimeErrorMetric]);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    if (typeof Worker === 'undefined') {
      throw new Error('Worker API unavailable');
    }

    const worker = new Worker(new URL('./worldgen-worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorldgenWorkerResponse>) => {
      const message = event.data;
      if (!message) return;

      if (message.type === 'INITIALIZE_OK') {
        setState({
          initialized: true,
          ready: true,
          contractVersion: message.contractVersion,
          runtimeApiVersion: message.runtimeApiVersion,
          error: undefined,
          phase: 'ready',
          progress: undefined,
          job: undefined
        });
        resolveInitialization(message.contractVersion, message.runtimeApiVersion);
        return;
      }

      if (message.type === 'INITIALIZE_ERROR') {
        const details = message.contractVersion ? { contractVersion: message.contractVersion } : undefined;
        emitRuntimeErrorMetric(message.error, details);
        setState((previous) => ({
          ...previous,
          initialized: false,
          ready: false,
          contractVersion: message.contractVersion ?? previous.contractVersion,
          error: message.error,
          phase: 'error',
          progress: undefined,
          job: undefined
        }));
        rejectInitialization(message.error);
        return;
      }

      if (message.type === 'PROGRESS') {
        if (activeRequestIdRef.current !== message.requestId) return;
        setState((previous) => ({
          ...previous,
          ready: true,
          phase: 'compiling',
          progress: message.progress,
          job: previous.job
            ? {
                ...previous.job,
                progress: message.progress
              }
            : undefined
        }));
        return;
      }

      if (message.type === 'COMPILE_OK') {
        if (activeRequestIdRef.current !== message.requestId) return;
        const pending = pendingRef.current.get(message.requestId);
        if (!pending) return;
        pendingRef.current.delete(message.requestId);
        activeRequestIdRef.current = null;
        emitFirstCompileMetric();
        setState((previous) => ({
          ...previous,
          ready: true,
          phase: 'ready',
          progress: undefined,
          job: undefined,
          error: undefined
        }));
        pending.resolve(message.artifact);
        return;
      }

      if (message.type === 'COMPILE_ERROR') {
        if (message.requestId) {
          if (activeRequestIdRef.current && activeRequestIdRef.current !== message.requestId) return;
          const pending = pendingRef.current.get(message.requestId);
          if (pending) {
            pendingRef.current.delete(message.requestId);
            pending.reject(new Error(message.error));
          }
          if (activeRequestIdRef.current === message.requestId) {
            activeRequestIdRef.current = null;
          }
          emitFirstCompileMetric();
          setState((previous) => ({
            ...previous,
            ready: previous.initialized,
            phase: previous.initialized ? 'ready' : 'error',
            progress: undefined,
            job: undefined,
            error: previous.initialized ? undefined : message.error
          }));
          return;
        }

        setFatalErrorState(message.error, {
          contractVersion: state.contractVersion,
          runtimeApiVersion: state.runtimeApiVersion
        });
      }
    };

    worker.onerror = (error) => {
      const message = error.message || 'Worldgen worker failed';
      rejectInitialization(message);
      rejectActiveCompile(message);
      setFatalErrorState(message, {
        contractVersion: state.contractVersion,
        runtimeApiVersion: state.runtimeApiVersion
      });
    };

    return worker;
  }, [
    emitFirstCompileMetric,
    rejectActiveCompile,
    rejectInitialization,
    resolveInitialization,
    setFatalErrorState,
    state.contractVersion,
    state.runtimeApiVersion
  ]);

  useEffect(() => () => {
    rejectInitialization('Worldgen worker terminated');
    pendingRef.current.forEach((pending) => pending.reject(new Error('Worldgen worker terminated')));
    pendingRef.current.clear();
    activeRequestIdRef.current = null;
    disposeWorker();
  }, [disposeWorker, rejectInitialization]);

  const initializeWorker = useCallback((forceReinitialize = false): Promise<void> => {
    if (!forceReinitialize && state.initialized && (state.phase === 'ready' || state.phase === 'compiling')) {
      return Promise.resolve();
    }

    if (initializationRef.current) {
      return initializationRef.current.promise;
    }

    if (forceReinitialize) {
      rejectInitialization('Worldgen worker reinitialized');
      rejectActiveCompile('Worldgen worker reinitialized');
      disposeWorker();
      setState((previous) => ({
        ...previous,
        initialized: false,
        ready: false,
        error: undefined,
        phase: 'idle',
        progress: undefined,
        job: undefined
      }));
    } else if (state.phase === 'error' && !state.initialized) {
      disposeWorker();
      setState((previous) => ({
        ...previous,
        error: undefined,
        phase: 'idle'
      }));
    }

    let worker: Worker;
    try {
      worker = ensureWorker();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Worldgen worker unavailable';
      setFatalErrorState(message);
      return Promise.reject(new Error(message));
    }

    const initialization = createInitializationRequest();
    initializationRef.current = initialization;
    setState((previous) => ({
      ...previous,
      ready: false,
      error: undefined,
      phase: 'initializing',
      progress: undefined,
      job: undefined
    }));
    worker.postMessage({ type: 'INITIALIZE' } satisfies WorldgenWorkerRequest);
    return initialization.promise;
  }, [
    disposeWorker,
    ensureWorker,
    rejectActiveCompile,
    rejectInitialization,
    setFatalErrorState,
    state.initialized,
    state.phase
  ]);

  const ensureReady = useCallback((): Promise<void> => initializeWorker(false), [initializeWorker]);

  const reinitializeWorker = useCallback((): Promise<void> => initializeWorker(true), [initializeWorker]);

  const compile = useCallback(async (
    type: 'COMPILE_RUN_START' | 'COMPILE_PENDING_FLOOR',
    payload: StartRunCompileContext | TransitionCompileContext
  ): Promise<CompiledFloorArtifact> => {
    await ensureReady();

    const worker = await ensureCompileWorker({ workerRef, reinitializeWorker });

    const requestId = `worldgen_${requestCounterRef.current += 1}`;
    const request: WorldgenWorkerRequest = type === 'COMPILE_RUN_START'
      ? { type, requestId, payload: payload as StartRunCompileContext }
      : { type, requestId, payload: payload as TransitionCompileContext };

    return new Promise<CompiledFloorArtifact>((resolve, reject) => {
      const activeRequestId = activeRequestIdRef.current;
      if (activeRequestId) {
        const pending = pendingRef.current.get(activeRequestId);
        if (pending) {
          pending.reject(new Error('Worldgen compile superseded by a newer request'));
          pendingRef.current.delete(activeRequestId);
        }
      }

      if (!firstCompileMetricSentRef.current && firstCompileStartedAtRef.current === null) {
        firstCompileStartedAtRef.current = Date.now();
      }

      activeRequestIdRef.current = requestId;
      pendingRef.current.set(requestId, { resolve, reject });
      setState((previous) => ({
        ...previous,
        ready: true,
        error: undefined,
        phase: 'compiling',
        progress: INITIAL_PROGRESS,
        job: {
          requestId,
          requestType: type,
          progress: INITIAL_PROGRESS
        }
      }));
      worker.postMessage(request);
    });
  }, [ensureReady, reinitializeWorker]);

  const api = useMemo<WorldgenWorkerState>(() => ({
    ...state,
    ensureReady,
    compileRunStart: (context) => compile('COMPILE_RUN_START', context),
    compilePendingFloor: (context) => compile('COMPILE_PENDING_FLOOR', context)
  }), [compile, ensureReady, state]);

  return api;
};
