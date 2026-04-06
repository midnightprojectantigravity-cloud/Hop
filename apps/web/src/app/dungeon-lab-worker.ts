import {
  inspectDungeonLabArenaPreview,
  runDungeonLabArenaMatch,
  type DungeonLabArenaPreviewInspectionV2,
  type DungeonLabArenaRunArtifactV2,
} from '@hop/engine';
import type { DungeonLabWorkerRequest, DungeonLabWorkerResponse } from './dungeon-lab-worker-protocol';
import { toDungeonLabWorkerTransportSafe } from './dungeon-lab-worker-transport';

const workerScope = self as unknown as Worker;

const postResponse = (response: DungeonLabWorkerResponse) => {
  workerScope.postMessage(response);
};

workerScope.onmessage = (event: MessageEvent<DungeonLabWorkerRequest>) => {
  const message = event.data;
  if (!message) return;

  try {
    switch (message.type) {
      case 'COMPILE_PREVIEW': {
        const inspection: DungeonLabArenaPreviewInspectionV2 = toDungeonLabWorkerTransportSafe(
          inspectDungeonLabArenaPreview(message.config, message.seedOverride)
        );
        postResponse({
          type: 'PREVIEW_OK',
          requestId: message.requestId,
          inspection
        });
        return;
      }
      case 'RUN_MATCH': {
        const artifact: DungeonLabArenaRunArtifactV2 = toDungeonLabWorkerTransportSafe(
          runDungeonLabArenaMatch(message.config, message.seedOverride)
        );
        postResponse({
          type: 'RUN_MATCH_OK',
          requestId: message.requestId,
          artifact
        });
        return;
      }
      default:
        return;
    }
  } catch (error) {
    postResponse({
      type: 'ERROR',
      requestId: message.requestId,
      error: error instanceof Error ? error.message : 'Dungeon Lab worker failed.'
    });
  }
};

export {};
