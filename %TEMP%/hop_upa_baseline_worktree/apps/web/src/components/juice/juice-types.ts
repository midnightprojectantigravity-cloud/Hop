import type { Point } from '@hop/engine';

export type JuiceEffectType =
    | 'basic_attack_strike'
    | 'archer_shot_signature'
    | 'impact'
    | 'combat_text'
    | 'flash'
    | 'spear_trail'
    | 'vaporize'
    | 'lava_ripple'
    | 'explosion_ring'
    | 'melee_lunge'
    | 'arrow_shot'
    | 'arcane_bolt'
    | 'kinetic_wave'
    | 'wall_crack'
    | 'dash_blur'
    | 'hidden_fade'
    | 'generic_ring'
    | 'generic_line';

export type WorldPoint = { x: number; y: number };

export interface JuiceEffect {
    id: string;
    type: JuiceEffectType;
    position?: Point;
    worldPosition?: WorldPoint;
    payload?: any;
    startTime: number;
    ttlMs?: number;
}

export interface JuiceActorSnapshot {
    id: string;
    position: Point;
    subtype?: string;
    assetHref?: string;
    fallbackAssetHref?: string;
}
