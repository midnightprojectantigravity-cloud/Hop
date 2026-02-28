import type { Point } from '@hop/engine';
import { TILE_SIZE } from '@hop/engine';
import type { JuiceEffectType, JuiceEffect } from './juice-types';

export const waitMs = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const resolveEventPoint = (payload: any): Point | null => {
    if (!payload) return null;
    const p = payload.position || payload.destination || payload.origin || payload.target;
    if (p && typeof p.q === 'number' && typeof p.r === 'number' && typeof p.s === 'number') {
        return p;
    }
    return null;
};

export const getEffectLifetimeMs = (effect: JuiceEffect): number => {
    if (effect.ttlMs && effect.ttlMs > 0) return effect.ttlMs;
    const effectType = effect.type;
    if (effectType === 'basic_attack_strike') return 180;
    if (effectType === 'archer_shot_signature') return 170;
    if (effectType === 'impact') return 400;
    if (effectType === 'combat_text') return 1000;
    if (effectType === 'flash') return 300;
    if (effectType === 'melee_lunge') return 240;
    if (effectType === 'arrow_shot') return 260;
    if (effectType === 'arcane_bolt') return 320;
    if (effectType === 'kinetic_wave') return 520;
    if (effectType === 'wall_crack') return 700;
    if (effectType === 'dash_blur') return 320;
    if (effectType === 'hidden_fade') return 360;
    if (effectType === 'generic_ring') return 700;
    if (effectType === 'generic_line') return 280;
    if (effectType === 'spear_trail') return 500;
    if (effectType === 'vaporize') return 600;
    if (effectType === 'lava_ripple') return 800;
    if (effectType === 'explosion_ring') return 1000;
    return 2000;
};

export const TIMELINE_TIME_SCALE = 0.72;

export const classifyDamageCueType = (
    sourceSubtype: string | undefined,
    reason: string,
    distancePx: number
): JuiceEffectType | null => {
    const normalizedSubtype = String(sourceSubtype || '').toLowerCase();
    const normalizedReason = String(reason || '').toLowerCase();

    if (
        normalizedReason.includes('lava')
        || normalizedReason.includes('fire')
        || normalizedReason.includes('hazard')
        || normalizedReason.includes('burn')
        || normalizedReason.includes('crush')
        || normalizedReason.includes('collision')
    ) {
        return null;
    }

    if (normalizedSubtype === 'bomber' || normalizedReason.includes('bomb') || normalizedReason.includes('explosion')) {
        return null;
    }
    if (normalizedSubtype === 'warlock' || normalizedReason.includes('arcane') || normalizedReason.includes('force') || normalizedReason.includes('spell')) {
        return 'arcane_bolt';
    }
    if (normalizedSubtype === 'archer' || normalizedReason.includes('arrow') || normalizedReason.includes('spear_throw')) {
        return 'arrow_shot';
    }
    if (distancePx <= TILE_SIZE * 2.05 || normalizedReason.includes('basic_attack') || normalizedReason.includes('melee')) {
        return 'melee_lunge';
    }
    return null;
};
