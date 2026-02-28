import { SkillRegistry } from '../../../skillRegistry';
import type { SkillIntentTag } from '../../../types';
import { extractTrinityStats } from '../../combat/combat-calculator';
import type { EnemyAiContext, EnemyAiPolicyProfile } from './types';
import type { EnemyIntentBand } from './features';

type IntentBias = Record<EnemyIntentBand, number>;
const MAX_DYNAMIC_INTENT_BIAS_TOTAL = 4.5;
const DYNAMIC_INTENT_BIAS_STRENGTH_ENV = 'HOP_ENEMY_AI_DYNAMIC_INTENT_BIAS_STRENGTH';

const ZERO_INTENT_BIAS: IntentBias = {
    offense: 0,
    positioning: 0,
    control: 0,
    defense: 0
};

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const addBias = (target: IntentBias, partial: Partial<IntentBias>, scale: number = 1): void => {
    target.offense += (partial.offense || 0) * scale;
    target.positioning += (partial.positioning || 0) * scale;
    target.control += (partial.control || 0) * scale;
    target.defense += (partial.defense || 0) * scale;
};

const TAG_BIAS: Record<SkillIntentTag, Partial<IntentBias>> = {
    damage: { offense: 0.22, control: 0.02 },
    move: { positioning: 0.24, offense: 0.04 },
    heal: { defense: 0.24, control: 0.04 },
    protect: { defense: 0.2, control: 0.06 },
    control: { control: 0.25, positioning: 0.06 },
    summon: { control: 0.14, defense: 0.08 },
    hazard: { control: 0.14, offense: 0.1 },
    objective: { positioning: 0.08, control: 0.12 },
    economy: { defense: 0.08, control: 0.08 },
    utility: { positioning: 0.08, control: 0.1 }
};

const inferTagsFromSkillId = (skillId: string): SkillIntentTag[] => {
    const upper = String(skillId || '').toUpperCase();
    const tags = new Set<SkillIntentTag>();

    if (/(ATTACK|THROW|BLAST|FIREBALL|BASH|PECK|EXPLOSION|SPEAR|SHOOT|DASH)/.test(upper)) {
        tags.add('damage');
    }
    if (/(MOVE|DASH|JUMP|ROLL|VAULT|STEP|GRAPPLE|WITHDRAWAL|WALK|TELEPORT)/.test(upper)) {
        tags.add('move');
    }
    if (/(HEAL|ABSORB)/.test(upper)) tags.add('heal');
    if (/(SHIELD|PROTECT|BULWARK)/.test(upper)) tags.add('protect');
    if (/(STUN|TRAP|SMOKE|TELEGRAPH|ROOT|SWAP|SCOUT)/.test(upper)) tags.add('control');
    if (/(RAISE|SUMMON|FALCON)/.test(upper)) tags.add('summon');
    if (/(FIRE|LAVA|HAZARD|BOMB|EXPLOSION)/.test(upper)) tags.add('hazard');

    if (tags.size === 0) tags.add('utility');
    return [...tags];
};

const getSkillIntentTags = (skillId: string): SkillIntentTag[] => {
    const def = SkillRegistry.get(skillId);
    const profile = def?.intentProfile;
    if (profile?.intentTags && profile.intentTags.length > 0) {
        return profile.intentTags;
    }
    return inferTagsFromSkillId(skillId);
};

const normalizeBias = (bias: IntentBias, maxTotal: number): IntentBias => {
    const clamped: IntentBias = {
        offense: Math.max(0, bias.offense),
        positioning: Math.max(0, bias.positioning),
        control: Math.max(0, bias.control),
        defense: Math.max(0, bias.defense)
    };
    const total = clamped.offense + clamped.positioning + clamped.control + clamped.defense;
    if (total <= maxTotal || total <= 0) return clamped;
    const scale = maxTotal / total;
    return {
        offense: clamped.offense * scale,
        positioning: clamped.positioning * scale,
        control: clamped.control * scale,
        defense: clamped.defense * scale
    };
};

export const isDynamicEnemyIntentBiasEnabled = (): boolean => {
    if (typeof process === 'undefined') return false;
    const raw = process.env?.HOP_ENEMY_AI_DYNAMIC_INTENT_BIAS;
    return raw === '1' || raw === 'true';
};

export const getDynamicEnemyIntentBiasStrength = (): number => {
    if (typeof process === 'undefined') return 1;
    const raw = process.env?.[DYNAMIC_INTENT_BIAS_STRENGTH_ENV];
    if (!raw) return 1;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 1;
    return clamp(parsed, 0, 8);
};

export const deriveEnemyDynamicIntentBias = (
    context: EnemyAiContext,
    _policy: EnemyAiPolicyProfile
): IntentBias => {
    if (!isDynamicEnemyIntentBiasEnabled()) {
        return { ...ZERO_INTENT_BIAS };
    }
    const strength = getDynamicEnemyIntentBiasStrength();
    if (strength <= 0) {
        return { ...ZERO_INTENT_BIAS };
    }

    const bias: IntentBias = { ...ZERO_INTENT_BIAS };
    const trinity = extractTrinityStats(context.enemy);
    const body = clamp(Number(trinity.body || 0), 0, 24);
    const mind = clamp(Number(trinity.mind || 0), 0, 24);
    const instinct = clamp(Number(trinity.instinct || 0), 0, 24);

    addBias(bias, {
        offense: body * 0.06 + instinct * 0.015,
        defense: body * 0.018 + mind * 0.028,
        control: mind * 0.06,
        positioning: instinct * 0.055 + Math.max(0, Number(context.enemy.speed || 1) - 1) * 0.06
    });

    for (const skill of context.enemy.activeSkills || []) {
        const skillId = String(skill.id);
        const tags = getSkillIntentTags(skillId);
        for (const tag of tags) {
            addBias(bias, TAG_BIAS[tag] || {});
        }

        const def = SkillRegistry.get(skill.id);
        const range = Number(def?.intentProfile?.target?.range ?? skill.range ?? 0);
        if (range >= 3) {
            addBias(bias, { positioning: 0.08, control: 0.04 });
        } else if (range <= 1) {
            addBias(bias, { offense: 0.05 });
        }

        const cooldown = Number(def?.intentProfile?.economy?.cooldown ?? skill.cooldown ?? 0);
        if (cooldown > 0) {
            addBias(bias, { defense: 0.02, control: 0.015 }, Math.min(3, cooldown));
        }
    }

    const normalized = normalizeBias(bias, MAX_DYNAMIC_INTENT_BIAS_TOTAL);
    if (strength === 1) return normalized;
    const scaled: IntentBias = {
        offense: normalized.offense * strength,
        positioning: normalized.positioning * strength,
        control: normalized.control * strength,
        defense: normalized.defense * strength
    };
    return normalizeBias(scaled, MAX_DYNAMIC_INTENT_BIAS_TOTAL * Math.max(1, strength));
};
