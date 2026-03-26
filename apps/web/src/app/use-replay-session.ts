import { useMemo } from 'react';
import type { Action } from '@hop/engine';
import { useReplayController } from './use-replay-controller';

export const useReplaySession = ({
  dispatchReplayAction,
  isReplayStepBlocked
}: {
  dispatchReplayAction: (action: Action, source: string) => void;
  isReplayStepBlocked: () => boolean;
}) => {
  const replay = useReplayController({
    dispatchWithTrace: dispatchReplayAction,
    isReplayStepBlocked
  });

  const replayMarkerIndices = useMemo(() => {
    if (replay.replayActions.length === 0) return [0];
    const markerSet = new Set<number>();
    markerSet.add(0);
    replay.replayActions.forEach((action, index) => {
      const type = (action as any)?.type;
      if (
        type === 'USE_SKILL'
        || type === 'MOVE'
        || type === 'ADVANCE_TURN'
        || type === 'RESOLVE_PENDING'
        || type === 'SELECT_UPGRADE'
      ) {
        markerSet.add(index + 1);
      }
    });
    markerSet.add(replay.replayActions.length);
    const ordered = Array.from(markerSet).sort((a, b) => a - b);
    if (ordered.length <= 12) return ordered;
    const stride = Math.ceil(ordered.length / 12);
    const sampled = ordered.filter((_, index) => index % stride === 0);
    if (sampled[sampled.length - 1] !== replay.replayActions.length) {
      sampled.push(replay.replayActions.length);
    }
    return sampled;
  }, [replay.replayActions]);

  return {
    ...replay,
    replayMarkerIndices
  };
};
