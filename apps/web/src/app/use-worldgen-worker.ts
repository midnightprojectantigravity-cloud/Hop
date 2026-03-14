import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CompiledFloorArtifact,
  StartRunCompileContext,
  TransitionCompileContext,
  CompilerProgress
} from '@hop/engine';
import { getModuleRegistrySnapshot } from '@hop/engine';
import type { WorldgenWorkerRequest, WorldgenWorkerResponse } from './worldgen-worker-protocol';

interface PendingRequest {
  resolve: (artifact: CompiledFloorArtifact) => void;
  reject: (error: Error) => void;
}

export type WorldgenCompilePhase = 'booting' | 'idle' | 'compiling' | 'error';

export interface WorldgenCompileJobState {
  requestId: string;
  requestType: 'COMPILE_RUN_START' | 'COMPILE_PENDING_FLOOR';
  progress: CompilerProgress;
}

export interface WorldgenWorkerState {
  ready: boolean;
  registryVersion?: string;
  specSchemaVersion?: string;
  error?: string;
  phase: WorldgenCompilePhase;
  progress?: CompilerProgress;
  job?: WorldgenCompileJobState;
  compileRunStart: (context: StartRunCompileContext) => Promise<CompiledFloorArtifact>;
  compilePendingFloor: (context: TransitionCompileContext) => Promise<CompiledFloorArtifact>;
}

const expectedSnapshot = getModuleRegistrySnapshot();

export const useWorldgenWorker = (): WorldgenWorkerState => {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<string, PendingRequest>());
  const activeRequestIdRef = useRef<string | null>(null);
  const requestCounterRef = useRef(0);
  const [state, setState] = useState<Omit<WorldgenWorkerState, 'compileRunStart' | 'compilePendingFloor'>>({
    ready: false,
    phase: 'booting'
  });

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      setState({
        ready: false,
        error: 'Worker API unavailable',
        phase: 'error'
      });
      return;
    }

    const worker = new Worker(new URL('./worldgen-worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorldgenWorkerResponse>) => {
      const message = event.data;
      if (!message) return;

      if (message.type === 'BOOT_OK') {
        const mismatch = message.registryVersion !== expectedSnapshot.registryVersion
          || message.specSchemaVersion !== expectedSnapshot.specSchemaVersion;
        if (mismatch) {
          setState({
            ready: false,
            registryVersion: message.registryVersion,
            specSchemaVersion: message.specSchemaVersion,
            error: 'Worldgen worker registry version mismatch',
            phase: 'error'
          });
          return;
        }
        setState({
          ready: true,
          registryVersion: message.registryVersion,
          specSchemaVersion: message.specSchemaVersion,
          phase: 'idle',
          error: undefined,
          progress: undefined,
          job: undefined
        });
        return;
      }

      if (message.type === 'BOOT_ERROR') {
        setState({
          ready: false,
          registryVersion: message.registryVersion,
          specSchemaVersion: message.specSchemaVersion,
          error: message.error,
          phase: 'error'
        });
        return;
      }

      if (message.type === 'PROGRESS') {
        if (activeRequestIdRef.current !== message.requestId) return;
        setState((previous) => ({
          ...previous,
          phase: 'compiling',
          job: previous.job
            ? {
                ...previous.job,
                progress: message.progress
              }
            : undefined,
          progress: message.progress
        }));
        return;
      }

      if (message.type === 'COMPILE_OK') {
        if (activeRequestIdRef.current !== message.requestId) return;
        const pending = pendingRef.current.get(message.requestId);
        if (!pending) return;
        pendingRef.current.delete(message.requestId);
        activeRequestIdRef.current = null;
        setState((previous) => ({
          ...previous,
          phase: previous.ready ? 'idle' : 'error',
          progress: undefined,
          job: undefined,
          error: previous.ready ? undefined : previous.error
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
        }
        setState((previous) => ({
          ...previous,
          error: message.error,
          phase: 'error',
          progress: undefined,
          job: undefined
        }));
      }
    };

    worker.onerror = (error) => {
      setState({
        ready: false,
        error: error.message || 'Worldgen worker failed',
        phase: 'error'
      });
    };

    worker.postMessage({ type: 'BOOT' } satisfies WorldgenWorkerRequest);

    return () => {
      pendingRef.current.forEach((pending) => pending.reject(new Error('Worldgen worker terminated')));
      pendingRef.current.clear();
      activeRequestIdRef.current = null;
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const compile = useCallback((
    type: 'COMPILE_RUN_START' | 'COMPILE_PENDING_FLOOR',
    payload: StartRunCompileContext | TransitionCompileContext
  ): Promise<CompiledFloorArtifact> => {
    if (!workerRef.current || !state.ready) {
      return Promise.reject(new Error(state.error || 'Worldgen worker unavailable'));
    }
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
      activeRequestIdRef.current = requestId;
      pendingRef.current.set(requestId, { resolve, reject });
      setState((previous) => ({
        ...previous,
        error: undefined,
        phase: 'compiling',
        progress: {
          pass: 'normalizeSpec',
          percent: 0
        },
        job: {
          requestId,
          requestType: type,
          progress: {
            pass: 'normalizeSpec',
            percent: 0
          }
        }
      }));
      workerRef.current?.postMessage(request);
    });
  }, [state.error, state.ready]);

  const api = useMemo<WorldgenWorkerState>(() => ({
    ...state,
    compileRunStart: (context) => compile('COMPILE_RUN_START', context),
    compilePendingFloor: (context) => compile('COMPILE_PENDING_FLOOR', context)
  }), [compile, state]);

  return api;
};
