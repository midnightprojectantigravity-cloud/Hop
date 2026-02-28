import type { MovementTrace, Point } from '@hop/engine';
import { hexEquals } from '@hop/engine';

export const hasMatchingMovementTrace = (
  movementTrace: MovementTrace | undefined,
  actorId: string,
  destination: Point
): boolean =>
  Boolean(
    movementTrace
    && movementTrace.actorId === actorId
    && movementTrace.destination
    && hexEquals(movementTrace.destination as any, destination)
    && Array.isArray(movementTrace.path)
    && movementTrace.path.length > 0
  );

export const resolvePlaybackPath = (args: {
  rawPath: Point[];
  movementTraceOrigin?: Point;
  hasMatchingTrace: boolean;
}): Point[] => {
  const { rawPath, movementTraceOrigin, hasMatchingTrace } = args;
  if (!hasMatchingTrace || !movementTraceOrigin || rawPath.length <= 1) return rawPath;
  if (
    hexEquals(rawPath[rawPath.length - 1], movementTraceOrigin)
    && !hexEquals(rawPath[0], movementTraceOrigin)
  ) {
    return [...rawPath].reverse();
  }
  return rawPath;
};

