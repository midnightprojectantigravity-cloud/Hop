import type { EntityVisualPose } from '../entity/entity-types';
import type { EntityPoseEffect } from './board-juice-presentation-types';

export interface BoardEntityPoseStore {
  subscribe: (listener: () => void) => () => void;
  getPose: (actorId: string) => EntityVisualPose | undefined;
  enqueueEffects: (effects: ReadonlyArray<EntityPoseEffect>) => void;
  reset: () => void;
}

const lerp = (a: number, b: number, t: number) => a + ((b - a) * t);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const buildPoseMap = (
  effects: ReadonlyArray<EntityPoseEffect>,
  nowMs: number,
): Map<string, EntityVisualPose> => {
  const nextPoseByActorId = new Map<string, EntityVisualPose>();

  for (const effect of effects) {
    if (nowMs < effect.startTime || nowMs > effect.endTime) continue;

    const duration = Math.max(1, effect.endTime - effect.startTime);
    const tRaw = Math.max(0, Math.min(1, (nowMs - effect.startTime) / duration));
    const t = effect.easing === 'inOut' ? easeInOutCubic(tRaw) : easeOutCubic(tRaw);
    const frame: EntityVisualPose = {
      offsetX: lerp(effect.from.offsetX, effect.to.offsetX, t),
      offsetY: lerp(effect.from.offsetY, effect.to.offsetY, t),
      scaleX: lerp(effect.from.scaleX, effect.to.scaleX, t),
      scaleY: lerp(effect.from.scaleY, effect.to.scaleY, t),
    };
    const previous = nextPoseByActorId.get(effect.actorId);
    if (!previous) {
      nextPoseByActorId.set(effect.actorId, frame);
      continue;
    }

    nextPoseByActorId.set(effect.actorId, {
      offsetX: (previous.offsetX ?? 0) + (frame.offsetX ?? 0),
      offsetY: (previous.offsetY ?? 0) + (frame.offsetY ?? 0),
      scaleX: (previous.scaleX ?? 1) * (frame.scaleX ?? 1),
      scaleY: (previous.scaleY ?? 1) * (frame.scaleY ?? 1),
    });
  }

  return nextPoseByActorId;
};

export const createBoardEntityPoseStore = (): BoardEntityPoseStore => {
  let activeEffects: EntityPoseEffect[] = [];
  let poseByActorId = new Map<string, EntityVisualPose>();
  let animationFrameId: number | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const cancelFrame = () => {
    if (animationFrameId === null || typeof window === 'undefined') return;
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  };

  const tick = () => {
    animationFrameId = null;
    const nowMs = Date.now();
    activeEffects = activeEffects.filter((effect) => nowMs < effect.endTime + 16);
    poseByActorId = buildPoseMap(activeEffects, nowMs);
    notify();

    if (activeEffects.length > 0 && typeof window !== 'undefined') {
      animationFrameId = window.requestAnimationFrame(tick);
    }
  };

  const ensureFrame = () => {
    if (animationFrameId !== null || typeof window === 'undefined') return;
    animationFrameId = window.requestAnimationFrame(tick);
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getPose: (actorId) => poseByActorId.get(actorId),
    enqueueEffects: (effects) => {
      if (effects.length === 0) return;
      const nowMs = Date.now();
      activeEffects = [
        ...activeEffects.filter((effect) => nowMs < effect.endTime + 16),
        ...effects,
      ];
      poseByActorId = buildPoseMap(activeEffects, nowMs);
      notify();
      ensureFrame();
    },
    reset: () => {
      activeEffects = [];
      poseByActorId = new Map<string, EntityVisualPose>();
      cancelFrame();
      notify();
    },
  };
};
