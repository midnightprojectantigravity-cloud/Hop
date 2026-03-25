import { ENGINE_CONTRACT_VERSION } from '@hop/engine/contract-version';
import type { WorldgenWorkerRequest, WorldgenWorkerResponse } from './worldgen-worker-protocol';

const workerScope = self as unknown as Worker;
let runtimePromise: Promise<typeof import('./worldgen-worker-runtime')> | null = null;

const loadRuntime = () => {
  runtimePromise ??= import('./worldgen-worker-runtime');
  return runtimePromise;
};

const postCompileOk = (requestId: string, artifact: import('@hop/engine').CompiledFloorArtifact) => {
  workerScope.postMessage({
    type: 'COMPILE_OK',
    requestId,
    artifact
  } satisfies WorldgenWorkerResponse, [artifact.tileBaseIds.buffer]);
};

workerScope.onmessage = async (event: MessageEvent<WorldgenWorkerRequest>) => {
  const message = event.data;
  if (!message) return;

  try {
    const runtime = await loadRuntime();

    if (message.type === 'INITIALIZE') {
      const runtimeInfo = runtime.initializeWorldgenWorkerRuntime();
      workerScope.postMessage({
        type: 'INITIALIZE_OK',
        contractVersion: runtimeInfo.contractVersion,
        runtimeApiVersion: runtimeInfo.runtimeApiVersion
      } satisfies WorldgenWorkerResponse);
      return;
    }

    if (message.type === 'COMPILE_RUN_START') {
      const artifact = runtime.compileRunStartArtifact(message.requestId, message.payload, (requestId, progress) => {
        workerScope.postMessage({
          type: 'PROGRESS',
          requestId,
          progress
        } satisfies WorldgenWorkerResponse);
      });
      postCompileOk(message.requestId, artifact);
      return;
    }

    if (message.type === 'COMPILE_PENDING_FLOOR') {
      const artifact = runtime.compilePendingFloorArtifact(message.requestId, message.payload, (requestId, progress) => {
        workerScope.postMessage({
          type: 'PROGRESS',
          requestId,
          progress
        } satisfies WorldgenWorkerResponse);
      });
      postCompileOk(message.requestId, artifact);
    }
  } catch (error) {
    if (message.type === 'INITIALIZE') {
      workerScope.postMessage({
        type: 'INITIALIZE_ERROR',
        contractVersion: ENGINE_CONTRACT_VERSION,
        error: error instanceof Error ? error.message : 'Worldgen runtime initialization failed'
      } satisfies WorldgenWorkerResponse);
      return;
    }

    workerScope.postMessage({
      type: 'COMPILE_ERROR',
      requestId: 'requestId' in message ? message.requestId : undefined,
      error: error instanceof Error ? error.message : 'Worldgen compile failed'
    } satisfies WorldgenWorkerResponse);
  }
};
