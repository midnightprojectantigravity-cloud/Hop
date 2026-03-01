import { useEffect, useRef, useState } from 'react';
import type { Actor as EntityType, MovementTrace } from '@hop/engine';
import {
  getHexLine,
  hexEquals,
  hexToPixel,
  TILE_SIZE
} from '@hop/engine';
import { hasMatchingMovementTrace, resolvePlaybackPath } from './entity-animation';

interface UseEntityMotionArgs {
  entity: EntityType;
  movementTrace?: MovementTrace;
  waapiControlled: boolean;
  movementDebugEnabled: boolean;
}

interface UseEntityMotionResult {
  displayPos: EntityType['position'];
  displayPixel: { x: number; y: number };
  animationPrevPos: EntityType['position'] | undefined;
  segmentDurationMs: number;
  segmentEasing: string;
  teleportPhase: 'none' | 'out' | 'in';
}

export const useEntityMotion = ({
  entity,
  movementTrace,
  waapiControlled,
  movementDebugEnabled
}: UseEntityMotionArgs): UseEntityMotionResult => {
  const [displayPos, setDisplayPos] = useState(entity.position);
  const [displayPixel, setDisplayPixel] = useState(() => hexToPixel(entity.position, TILE_SIZE));
  const [animationPrevPos, setAnimationPrevPos] = useState<EntityType['position'] | undefined>(entity.previousPosition);
  const [segmentDurationMs, setSegmentDurationMs] = useState(220);
  const [segmentEasing, setSegmentEasing] = useState('cubic-bezier(0.22, 1, 0.36, 1)');
  const [teleportPhase, setTeleportPhase] = useState<'none' | 'out' | 'in'>('none');
  const animationInProgress = useRef(false);
  const lastTargetPos = useRef(entity.position);
  const animationTimers = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const clearAnimationTimers = () => {
      for (const t of animationTimers.current) {
        clearTimeout(t);
      }
      animationTimers.current = [];
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    if (waapiControlled) {
      clearAnimationTimers();
      animationInProgress.current = false;
      const hasCurrentTrace = Boolean(
        movementTrace
        && movementTrace.actorId === entity.id
        && movementTrace.destination
        && hexEquals(movementTrace.destination as any, entity.position)
      );
      const moved = !hexEquals(entity.position, lastTargetPos.current);
      lastTargetPos.current = entity.position;
      if (moved && !hasCurrentTrace) {
        setDisplayPos(entity.position);
        setAnimationPrevPos(entity.previousPosition);
        setDisplayPixel(hexToPixel(entity.position, TILE_SIZE));
      }
      setTeleportPhase('none');
      setSegmentDurationMs(0);
      setSegmentEasing('linear');
      return;
    }

    if (!hexEquals(entity.position, lastTargetPos.current)) {
      lastTargetPos.current = entity.position;

      const hasMatchingTrace = hasMatchingMovementTrace(movementTrace, entity.id, entity.position);
      const matchedTrace = hasMatchingTrace ? movementTrace! : undefined;
      const tracePath = matchedTrace?.path as EntityType['position'][] | undefined;
      const inferredMovementType = matchedTrace?.movementType;
      const traceStartDelayMs = matchedTrace ? Math.max(0, matchedTrace.startDelayMs ?? 0) : 0;

      if (movementDebugEnabled) {
        const fallbackPathLen = entity.previousPosition ? getHexLine(entity.previousPosition, entity.position).length : 0;
        console.log('[HOP_MOVE]', {
          actorId: entity.id,
          movementType: inferredMovementType || 'fallback',
          usedEngineTrace: hasMatchingTrace,
          tracePathLength: tracePath?.length || 0,
          tracePath: tracePath || [],
          startDelayMs: traceStartDelayMs,
          fallbackPathLength: fallbackPathLen,
          origin: movementTrace?.origin || entity.previousPosition,
          destination: entity.position
        });
      }

      if (inferredMovementType === 'teleport' && matchedTrace?.origin) {
        clearAnimationTimers();
        animationInProgress.current = true;
        const totalDuration = matchedTrace.durationMs ?? 180;
        const halfDuration = Math.max(80, Math.floor(totalDuration / 2));

        const startTeleport = () => {
          setSegmentDurationMs(0);
          setSegmentEasing('linear');
          setAnimationPrevPos(matchedTrace.origin);
          setDisplayPos(matchedTrace.origin);
          setDisplayPixel(hexToPixel(matchedTrace.origin, TILE_SIZE));
          setTeleportPhase('out');

          const t1 = window.setTimeout(() => {
            setDisplayPos(entity.position);
            setAnimationPrevPos(entity.position);
            setDisplayPixel(hexToPixel(entity.position, TILE_SIZE));
            setTeleportPhase('in');
          }, halfDuration);
          const t2 = window.setTimeout(() => {
            setTeleportPhase('none');
            animationInProgress.current = false;
          }, halfDuration * 2);
          animationTimers.current.push(t1, t2);
        };

        if (traceStartDelayMs > 0) {
          const t0 = window.setTimeout(startTeleport, traceStartDelayMs);
          animationTimers.current.push(t0);
        } else {
          startTeleport();
        }
        return () => {
          clearAnimationTimers();
          animationInProgress.current = false;
        };
      }

      const hasPrevStep = !!(entity.previousPosition && !hexEquals(entity.position, entity.previousPosition));
      const hasTraceStep = !!(tracePath && tracePath.length > 1);

      if (hasTraceStep || hasPrevStep) {
        const rawPath = tracePath || (entity.previousPosition ? getHexLine(entity.previousPosition, entity.position) : []);
        const path = resolvePlaybackPath({
          rawPath,
          movementTraceOrigin: matchedTrace?.origin,
          hasMatchingTrace
        });

        if (path.length > 1) {
          clearAnimationTimers();
          animationInProgress.current = true;
          const segmentCount = Math.max(1, path.length - 1);
          const tracePerSegmentMs = matchedTrace?.durationMs
            ? matchedTrace.durationMs / segmentCount
            : 0;
          const perSegmentMs = Math.max(
            90,
            Math.min(130, tracePerSegmentMs || 112)
          );
          const totalDuration = perSegmentMs * segmentCount;
          const pointsPx = path.map(p => hexToPixel(p, TILE_SIZE));
          const startTs = performance.now();
          const easeInOutCubic = (t: number) =>
            t < 0.5
              ? 4 * t * t * t
              : 1 - Math.pow(-2 * t + 2, 3) / 2;

          setTeleportPhase('none');
          setSegmentDurationMs(0);
          setSegmentEasing('linear');
          setDisplayPos(path[0]);
          setAnimationPrevPos(path[0]);
          setDisplayPixel(pointsPx[0]);

          let lastSegmentIndex = -1;
          const animate = (now: number) => {
            const elapsed = Math.max(0, now - startTs);
            const segmentIndex = Math.min(segmentCount - 1, Math.floor(elapsed / perSegmentMs));
            const segmentStart = segmentIndex * perSegmentMs;
            const segmentElapsed = elapsed - segmentStart;
            const tRaw = Math.max(0, Math.min(1, segmentElapsed / perSegmentMs));
            const t = easeInOutCubic(tRaw);

            if (segmentIndex !== lastSegmentIndex) {
              setAnimationPrevPos(path[segmentIndex]);
              setDisplayPos(path[Math.min(path.length - 1, segmentIndex + 1)]);
              lastSegmentIndex = segmentIndex;
            }

            const from = pointsPx[segmentIndex];
            const to = pointsPx[Math.min(pointsPx.length - 1, segmentIndex + 1)];
            setDisplayPixel({
              x: from.x + ((to.x - from.x) * t),
              y: from.y + ((to.y - from.y) * t)
            });

            if (elapsed < totalDuration) {
              animationFrameRef.current = requestAnimationFrame(animate);
              return;
            }

            animationInProgress.current = false;
            setDisplayPos(entity.position);
            setAnimationPrevPos(entity.previousPosition);
            setDisplayPixel(pointsPx[pointsPx.length - 1]);
            animationFrameRef.current = null;
          };
          if (traceStartDelayMs > 0) {
            const t0 = window.setTimeout(() => {
              animationFrameRef.current = requestAnimationFrame(animate);
            }, traceStartDelayMs);
            animationTimers.current.push(t0);
          } else {
            animationFrameRef.current = requestAnimationFrame(animate);
          }

          return () => {
            clearAnimationTimers();
            animationInProgress.current = false;
          };
        }
      }

      setTeleportPhase('none');
      setSegmentDurationMs(220);
      setSegmentEasing('cubic-bezier(0.22, 1, 0.36, 1)');
      setDisplayPos(entity.position);
      setAnimationPrevPos(entity.previousPosition);
      setDisplayPixel(hexToPixel(entity.position, TILE_SIZE));
    }
  }, [entity.position, entity.previousPosition, movementTrace, entity.id, waapiControlled, movementDebugEnabled]);

  return {
    displayPos,
    displayPixel,
    animationPrevPos,
    segmentDurationMs,
    segmentEasing,
    teleportPhase
  };
};
