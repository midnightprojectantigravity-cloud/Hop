import {
  createPendingFloorCompileSession,
  createStartRunCompileSession,
  initializeWorldgenRuntime,
  type WorldgenCompileSession,
  type WorldgenRuntimeInfo
} from '@hop/engine/generation/worker-runtime';
import type {
  CompilerProgress,
  StartRunCompileContext,
  TransitionCompileContext,
} from '@hop/engine';

let runtimeInfo: WorldgenRuntimeInfo | null = null;

const getRuntimeInfo = (): WorldgenRuntimeInfo => {
  runtimeInfo ??= initializeWorldgenRuntime();
  return runtimeInfo;
};

const runCompileSession = <TContext extends StartRunCompileContext | TransitionCompileContext>(
  createSession: (context: TContext) => WorldgenCompileSession,
  requestId: string,
  context: TContext,
  onProgress: (requestId: string, progress: CompilerProgress) => void
) => {
  const session = createSession(context);

  while (!session.isComplete()) {
    const step = session.step(1);
    onProgress(requestId, step.progress);
  }

  const result = session.getResult();
  if (!result) {
    throw new Error('World compiler session completed without a result.');
  }
  if (result.failure) {
    throw new Error(result.failure.diagnostics[0] || result.failure.code);
  }

  return result.artifact;
};

export const initializeWorldgenWorkerRuntime = (): WorldgenRuntimeInfo => getRuntimeInfo();

export const compileRunStartArtifact = (
  requestId: string,
  context: StartRunCompileContext,
  onProgress: (requestId: string, progress: CompilerProgress) => void
) => {
  getRuntimeInfo();
  return runCompileSession(createStartRunCompileSession, requestId, context, onProgress);
};

export const compilePendingFloorArtifact = (
  requestId: string,
  context: TransitionCompileContext,
  onProgress: (requestId: string, progress: CompilerProgress) => void
) => {
  getRuntimeInfo();
  return runCompileSession(createPendingFloorCompileSession, requestId, context, onProgress);
};
