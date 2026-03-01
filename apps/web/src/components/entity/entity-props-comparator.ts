import type { MovementTrace } from '@hop/engine';
import type { EntityProps } from './entity-types';

const movementTraceKey = (movementTrace?: MovementTrace): string => {
  if (!movementTrace) return '';
  const pathSig = (movementTrace.path || []).map(p => `${p.q},${p.r},${p.s}`).join(';');
  return `${movementTrace.actorId}|${movementTrace.movementType || ''}|${movementTrace.destination?.q ?? ''},${movementTrace.destination?.r ?? ''},${movementTrace.destination?.s ?? ''}|${pathSig}|${movementTrace.durationMs ?? ''}|${movementTrace.startDelayMs ?? 0}|${movementTrace.wasLethal ? 1 : 0}`;
};

const statusSig = (arr: any[] = []) => arr.map(s => `${s.id}:${s.duration ?? ''}:${s.stacks ?? ''}`).join('|');

export const areEntityPropsEqual = (prev: EntityProps, next: EntityProps): boolean => {
  const a = prev.entity;
  const b = next.entity;
  return prev.isSpear === next.isSpear
    && prev.isDying === next.isDying
    && prev.waapiControlled === next.waapiControlled
    && prev.assetHref === next.assetHref
    && prev.fallbackAssetHref === next.fallbackAssetHref
    && prev.floorTheme === next.floorTheme
    && (prev.visualPose?.offsetX ?? 0) === (next.visualPose?.offsetX ?? 0)
    && (prev.visualPose?.offsetY ?? 0) === (next.visualPose?.offsetY ?? 0)
    && (prev.visualPose?.scaleX ?? 1) === (next.visualPose?.scaleX ?? 1)
    && (prev.visualPose?.scaleY ?? 1) === (next.visualPose?.scaleY ?? 1)
    && movementTraceKey(prev.movementTrace) === movementTraceKey(next.movementTrace)
    && a.id === b.id
    && a.hp === b.hp
    && a.maxHp === b.maxHp
    && a.facing === b.facing
    && a.intent === b.intent
    && a.isVisible === b.isVisible
    && a.position.q === b.position.q
    && a.position.r === b.position.r
    && a.position.s === b.position.s
    && (a.previousPosition?.q ?? 0) === (b.previousPosition?.q ?? 0)
    && (a.previousPosition?.r ?? 0) === (b.previousPosition?.r ?? 0)
    && (a.previousPosition?.s ?? 0) === (b.previousPosition?.s ?? 0)
    && (a.intentPosition?.q ?? 0) === (b.intentPosition?.q ?? 0)
    && (a.intentPosition?.r ?? 0) === (b.intentPosition?.r ?? 0)
    && (a.intentPosition?.s ?? 0) === (b.intentPosition?.s ?? 0)
    && statusSig(a.statusEffects) === statusSig(b.statusEffects);
};
