import type {
  CompiledFloorArtifact,
  CompilerProgress,
  StartRunCompileContext,
  TransitionCompileContext
} from '@hop/engine';

export type WorldgenWorkerRequest =
  | { type: 'BOOT' }
  | { type: 'COMPILE_RUN_START'; requestId: string; payload: StartRunCompileContext }
  | { type: 'COMPILE_PENDING_FLOOR'; requestId: string; payload: TransitionCompileContext };

export type WorldgenWorkerResponse =
  | {
      type: 'BOOT_OK';
      registryVersion: string;
      specSchemaVersion: string;
      moduleCount: number;
    }
  | {
      type: 'BOOT_ERROR';
      registryVersion: string;
      specSchemaVersion: string;
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
