import type {
  CompiledFloorArtifact,
  CompilerProgress,
  StartRunCompileContext,
  TransitionCompileContext
} from '@hop/engine';

export type WorldgenWorkerRequest =
  | { type: 'INITIALIZE' }
  | { type: 'COMPILE_RUN_START'; requestId: string; payload: StartRunCompileContext }
  | { type: 'COMPILE_PENDING_FLOOR'; requestId: string; payload: TransitionCompileContext };

export type WorldgenWorkerResponse =
  | {
      type: 'INITIALIZE_OK';
      contractVersion: string;
      runtimeApiVersion: string;
    }
  | {
      type: 'INITIALIZE_ERROR';
      contractVersion?: string;
      error: string;
    }
  | {
      type: 'PROGRESS';
      requestId: string;
      progress: CompilerProgress;
    }
  | {
      type: 'COMPILE_OK';
      requestId: string;
      artifact: CompiledFloorArtifact;
    }
  | {
      type: 'COMPILE_ERROR';
      requestId?: string;
      error: string;
    };
