import type {
  DungeonLabArenaConfigV2,
  DungeonLabArenaPreviewInspectionV2,
  DungeonLabArenaRunArtifactV2,
} from '@hop/engine';

export type DungeonLabWorkerRequest =
  | {
      type: 'COMPILE_PREVIEW';
      requestId: string;
      config: DungeonLabArenaConfigV2;
      seedOverride?: string;
    }
  | {
      type: 'RUN_MATCH';
      requestId: string;
      config: DungeonLabArenaConfigV2;
      seedOverride?: string;
    };

export type DungeonLabWorkerResponse =
  | {
      type: 'PREVIEW_OK';
      requestId: string;
      inspection: DungeonLabArenaPreviewInspectionV2;
    }
  | {
      type: 'RUN_MATCH_OK';
      requestId: string;
      artifact: DungeonLabArenaRunArtifactV2;
    }
  | {
      type: 'ERROR';
      requestId: string;
      error: string;
    };
