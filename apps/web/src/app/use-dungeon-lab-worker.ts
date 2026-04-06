import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  DungeonLabArenaConfigV2,
  DungeonLabArenaPreviewInspectionV2,
  DungeonLabArenaRunArtifactV2,
} from '@hop/engine';
import type { DungeonLabWorkerRequest, DungeonLabWorkerResponse } from './dungeon-lab-worker-protocol';

type PendingRequest =
  | {
      kind: 'preview';
      resolve: (inspection: DungeonLabArenaPreviewInspectionV2) => void;
      reject: (error: Error) => void;
    }
  | {
      kind: 'match';
      resolve: (artifact: DungeonLabArenaRunArtifactV2) => void;
      reject: (error: Error) => void;
    };

export interface DungeonLabWorkerState {
  phase: 'idle' | 'working' | 'error';
  error?: string;
  compilePreview: (config: DungeonLabArenaConfigV2, seedOverride?: string) => Promise<DungeonLabArenaPreviewInspectionV2>;
  runMatch: (config: DungeonLabArenaConfigV2, seedOverride?: string) => Promise<DungeonLabArenaRunArtifactV2>;
  reset: () => void;
}

export const useDungeonLabWorker = (): DungeonLabWorkerState => {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<string, PendingRequest>());
  const requestCounterRef = useRef(0);
  const [phase, setPhase] = useState<DungeonLabWorkerState['phase']>('idle');
  const [error, setError] = useState<string | undefined>(undefined);

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    pendingRef.current.forEach((pending) => pending.reject(new Error('Dungeon Lab worker reset.')));
    pendingRef.current.clear();
    setPhase('idle');
    setError(undefined);
  }, []);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL('./dungeon-lab-worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<DungeonLabWorkerResponse>) => {
      const message = event.data;
      if (!message) return;
      const pending = pendingRef.current.get(message.requestId);
      if (!pending) return;

      pendingRef.current.delete(message.requestId);
      setPhase('idle');

      if (message.type === 'ERROR') {
        const nextError = message.error || 'Dungeon Lab worker failed.';
        setError(nextError);
        pending.reject(new Error(nextError));
        return;
      }

      setError(undefined);
      if (message.type === 'PREVIEW_OK' && pending.kind === 'preview') {
        pending.resolve(message.inspection);
        return;
      }
      if (message.type === 'RUN_MATCH_OK' && pending.kind === 'match') {
        pending.resolve(message.artifact);
      }
    };

    worker.onerror = (event) => {
      const nextError = event.message || 'Dungeon Lab worker crashed.';
      setPhase('error');
      setError(nextError);
      pendingRef.current.forEach((pending) => pending.reject(new Error(nextError)));
      pendingRef.current.clear();
      workerRef.current = null;
    };

    return worker;
  }, []);

  useEffect(() => () => {
    reset();
  }, [reset]);

  const sendRequest = useCallback(<T,>(
    request:
      | Omit<Extract<DungeonLabWorkerRequest, { type: 'COMPILE_PREVIEW' }>, 'requestId'>
      | Omit<Extract<DungeonLabWorkerRequest, { type: 'RUN_MATCH' }>, 'requestId'>,
    kind: PendingRequest['kind']
  ): Promise<T> => {
    const worker = ensureWorker();
    const requestId = `dungeon_lab_arena_${requestCounterRef.current += 1}`;
    setPhase('working');
    setError(undefined);

    return new Promise<T>((resolve, reject) => {
      pendingRef.current.set(requestId, { kind, resolve: resolve as never, reject });
      worker.postMessage({
        ...request,
        requestId
      } satisfies DungeonLabWorkerRequest);
    });
  }, [ensureWorker]);

  const compilePreview = useCallback((config: DungeonLabArenaConfigV2, seedOverride?: string) =>
    sendRequest<DungeonLabArenaPreviewInspectionV2>({
      type: 'COMPILE_PREVIEW',
      config,
      seedOverride
    }, 'preview'), [sendRequest]);

  const runMatch = useCallback((config: DungeonLabArenaConfigV2, seedOverride?: string) =>
    sendRequest<DungeonLabArenaRunArtifactV2>({
      type: 'RUN_MATCH',
      config,
      seedOverride
    }, 'match'), [sendRequest]);

  return useMemo<DungeonLabWorkerState>(() => ({
    phase,
    error,
    compilePreview,
    runMatch,
    reset
  }), [compilePreview, error, phase, reset, runMatch]);
};
