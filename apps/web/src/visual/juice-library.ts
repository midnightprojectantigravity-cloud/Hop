export type JuiceRendererId =
    | 'basic_attack_strike'
    | 'archer_shot_signature'
    | 'impact'
    | 'flash'
    | 'combat_text'
    | 'spear_trail'
    | 'melee_lunge'
    | 'arrow_shot'
    | 'arcane_bolt'
    | 'explosion_ring'
    | 'lava_ripple'
    | 'kinetic_wave'
    | 'wall_crack'
    | 'dash_blur'
    | 'hidden_fade'
    | 'generic_ring'
    | 'generic_line'
    | 'none';

export interface JuiceRecipe {
    rendererId: JuiceRendererId;
    ttlMs: number;
    skipIfLegacyMirrored?: boolean;
}

export const EXACT_SIGNATURE_PHASE_RECIPES: Record<string, JuiceRecipe> = {
    'ATK.STRIKE.PHYSICAL.BASIC_ATTACK|anticipation': { rendererId: 'basic_attack_strike', ttlMs: 130 },
    'ATK.STRIKE.PHYSICAL.BASIC_ATTACK|travel': { rendererId: 'basic_attack_strike', ttlMs: 110 },
    'ATK.STRIKE.PHYSICAL.BASIC_ATTACK|impact': { rendererId: 'basic_attack_strike', ttlMs: 180 },
    'ATK.STRIKE.PHYSICAL.BASIC_ATTACK|aftermath': { rendererId: 'basic_attack_strike', ttlMs: 190 },
    'ATK.STRIKE.PHYSICAL.AUTO_ATTACK|anticipation': { rendererId: 'basic_attack_strike', ttlMs: 100 },
    'ATK.STRIKE.PHYSICAL.AUTO_ATTACK|travel': { rendererId: 'basic_attack_strike', ttlMs: 90 },
    'ATK.STRIKE.PHYSICAL.AUTO_ATTACK|impact': { rendererId: 'basic_attack_strike', ttlMs: 140 },
    'ATK.STRIKE.PHYSICAL.AUTO_ATTACK|aftermath': { rendererId: 'basic_attack_strike', ttlMs: 120 },
    'ATK.SHOOT.PHYSICAL.ARROW|anticipation': { rendererId: 'archer_shot_signature', ttlMs: 110 },
    'ATK.SHOOT.PHYSICAL.ARROW|travel': { rendererId: 'archer_shot_signature', ttlMs: 160, skipIfLegacyMirrored: true },
    'ATK.SHOOT.PHYSICAL.ARROW|impact': { rendererId: 'archer_shot_signature', ttlMs: 150 }
};

export const EXACT_SIGNATURE_RECIPES: Record<string, JuiceRecipe> = {
    'ATK.STRIKE.PHYSICAL.IMPACT': { rendererId: 'impact', ttlMs: 420, skipIfLegacyMirrored: true },
    'ATK.STRIKE.PHYSICAL.HEAVY': { rendererId: 'melee_lunge', ttlMs: 280 },
    'ATK.STRIKE.PHYSICAL.LIGHT': { rendererId: 'impact', ttlMs: 380 },
    'ATK.SHOOT.PHYSICAL.SPEAR_TRAIL': { rendererId: 'spear_trail', ttlMs: 520, skipIfLegacyMirrored: true },
    'ATK.SHOOT.PHYSICAL.SPEAR_RETURN': { rendererId: 'spear_trail', ttlMs: 520 },
    'ATK.BLAST.FIRE.EXPLOSION_RING': { rendererId: 'explosion_ring', ttlMs: 980 },
    'ATK.BLAST.FIRE.TIME_BOMB': { rendererId: 'explosion_ring', ttlMs: 980 },
    'ATK.BLAST.FIRE.FIREBALL_IMPACT': { rendererId: 'explosion_ring', ttlMs: 740 },
    'ATK.BLAST.VOID.CORPSE_EXPLOSION': { rendererId: 'generic_ring', ttlMs: 840 },
    'ENV.HAZARD.FIRE.LAVA_RIPPLE': { rendererId: 'lava_ripple', ttlMs: 820 },
    'ENV.COLLISION.KINETIC.WALL_CRACK': { rendererId: 'wall_crack', ttlMs: 700 },
    'ENV.COLLISION.KINETIC.IMPACT': { rendererId: 'wall_crack', ttlMs: 520 },
    'ATK.PULSE.KINETIC.WAVE': { rendererId: 'kinetic_wave', ttlMs: 540 },
    'MOVE.DASH.NEUTRAL.BLUR': { rendererId: 'dash_blur', ttlMs: 320 },
    'MOVE.DASH.NEUTRAL.SWIFT_ROLL': { rendererId: 'dash_blur', ttlMs: 320 },
    'MOVE.DASH.KINETIC.MOMENTUM_TRAIL': { rendererId: 'dash_blur', ttlMs: 360 },
    'STATE.FADE.SHADOW.HIDDEN': { rendererId: 'hidden_fade', ttlMs: 360 },
    'STATE.FADE.SHADOW.SMOKE_SCREEN': { rendererId: 'hidden_fade', ttlMs: 420 },
    'MOVE.BLINK.SHADOW.SHADOW_STEP': { rendererId: 'hidden_fade', ttlMs: 380 },
    'MOVE.BLINK.ARCANE.SOUL_SWAP_ARRIVE': { rendererId: 'flash', ttlMs: 280 },
    'MOVE.BLINK.ARCANE.SOUL_SWAP_DEPART': { rendererId: 'flash', ttlMs: 280 },
    'STATE.APPLY.NEUTRAL.STUN_BURST': { rendererId: 'generic_ring', ttlMs: 560 },
    'UI.TEXT.NEUTRAL.POPUP': { rendererId: 'combat_text', ttlMs: 1100 },
    'UI.SHAKE.NEUTRAL.CAMERA': { rendererId: 'none', ttlMs: 1, skipIfLegacyMirrored: true },
    'UI.FREEZE.NEUTRAL.HITSTOP': { rendererId: 'none', ttlMs: 1 }
};

export const FAMILY_PRIMITIVE_ELEMENT_PHASE_RECIPES: Record<string, JuiceRecipe> = {
    'attack|shoot|physical|travel': { rendererId: 'arrow_shot', ttlMs: 320 },
    'attack|shoot|arcane|travel': { rendererId: 'arcane_bolt', ttlMs: 340 },
    'attack|shoot|fire|travel': { rendererId: 'arcane_bolt', ttlMs: 340 },
    'attack|strike|physical|impact': { rendererId: 'melee_lunge', ttlMs: 260 },
    'attack|blast|fire|impact': { rendererId: 'explosion_ring', ttlMs: 900 },
    'attack|pulse|kinetic|impact': { rendererId: 'kinetic_wave', ttlMs: 520 },
    'environment|collision|kinetic|impact': { rendererId: 'wall_crack', ttlMs: 700 },
    'status|state_fade|shadow|instant': { rendererId: 'hidden_fade', ttlMs: 360 },
    'ui|text|neutral|instant': { rendererId: 'combat_text', ttlMs: 1000 }
};

export const FAMILY_PRIMITIVE_PHASE_RECIPES: Record<string, JuiceRecipe> = {
    'attack|blast|impact': { rendererId: 'generic_ring', ttlMs: 680 },
    'attack|shoot|travel': { rendererId: 'generic_line', ttlMs: 300 },
    'attack|strike|impact': { rendererId: 'impact', ttlMs: 400 },
    'environment|hazard_burst|impact': { rendererId: 'generic_ring', ttlMs: 760 },
    'status|status_apply|impact': { rendererId: 'flash', ttlMs: 320 },
    'ui|text|instant': { rendererId: 'combat_text', ttlMs: 1000 }
};

export const FAMILY_PRIMITIVE_RECIPES: Record<string, JuiceRecipe> = {
    'movement|dash': { rendererId: 'dash_blur', ttlMs: 300 },
    'movement|blink': { rendererId: 'flash', ttlMs: 260 },
    'attack|pulse': { rendererId: 'kinetic_wave', ttlMs: 500 },
    'attack|blast': { rendererId: 'generic_ring', ttlMs: 700 },
    'attack|shoot': { rendererId: 'generic_line', ttlMs: 280 },
    'attack|strike': { rendererId: 'impact', ttlMs: 380 },
    'environment|collision': { rendererId: 'wall_crack', ttlMs: 650 },
    'ui|text': { rendererId: 'combat_text', ttlMs: 1000 }
};
