import type { SkillDefinition, SkillIntentProfile, SkillIntentTag } from '../types';
import type { SkillID } from '../types/registry';

type PartialProfile = Partial<Omit<SkillIntentProfile, 'id' | 'target' | 'estimates' | 'economy' | 'risk'>> & {
    target?: Partial<SkillIntentProfile['target']>;
    estimates?: Partial<SkillIntentProfile['estimates']>;
    economy?: Partial<SkillIntentProfile['economy']>;
    risk?: Partial<SkillIntentProfile['risk']>;
};

const hasTag = (tags: SkillIntentTag[], tag: SkillIntentTag): boolean => tags.includes(tag);

const inferTags = (def: SkillDefinition): SkillIntentTag[] => {
    const tags = new Set<SkillIntentTag>();
    const id = def.id;
    const dmg = def.baseVariables.damage || 0;

    if (dmg > 0 || /(ATTACK|THROW|BLAST|FIREBALL|BASH|PECK|EXPLOSION|SPEAR|SHOOT)/.test(id)) {
        tags.add('damage');
    }
    if (/(MOVE|DASH|JUMP|ROLL|VAULT|STEP|GRAPPLE|WITHDRAWAL|WALK)/.test(id)) {
        tags.add('move');
    }
    if (/(HEAL|ABSORB)/.test(id)) {
        tags.add('heal');
    }
    if (/(SHIELD|PROTECT|BULWARK)/.test(id)) {
        tags.add('protect');
    }
    if (/(STUN|TRAP|SMOKE|TELEGRAPH|ROOT|SWAP|SCOUT)/.test(id)) {
        tags.add('control');
    }
    if (/(RAISE|FALCON|SUMMON)/.test(id)) {
        tags.add('summon');
    }
    if (/(FIRE|LAVA|HAZARD|TRAP)/.test(id)) {
        tags.add('hazard');
    }

    if (def.slot === 'offensive') tags.add('damage');
    if (def.slot === 'defensive') tags.add('protect');
    if (def.slot === 'utility') tags.add('utility');
    if (def.baseVariables.cooldown > 0 || def.baseVariables.cost > 0) tags.add('economy');

    if (!tags.size) tags.add('utility');
    return [...tags];
};

const OVERRIDES: Partial<Record<SkillID, PartialProfile>> = {
    BASIC_MOVE: { intentTags: ['move', 'objective', 'utility'], target: { pattern: 'single' }, estimates: { movement: 1 } },
    BASIC_ATTACK: { intentTags: ['damage'], target: { pattern: 'single' }, estimates: { damage: 4 } },
    AUTO_ATTACK: { intentTags: ['damage', 'utility'], target: { pattern: 'single' }, estimates: { damage: 2 } },
    DASH: {
        intentTags: ['move', 'damage', 'utility'],
        target: { pattern: 'line' },
        estimates: { movement: 2, damage: 2 },
        risk: { noProgressCastPenalty: 5 }
    },
    JUMP: {
        intentTags: ['move', 'utility'],
        target: { pattern: 'single' },
        estimates: { movement: 2 },
        risk: { noProgressCastPenalty: 6 }
    },
    SHIELD_BASH: {
        intentTags: ['damage', 'control', 'protect'],
        target: { pattern: 'single' },
        estimates: { damage: 3, control: 2 },
        risk: { requireEnemyContact: true, noContactPenalty: 5, noProgressCastPenalty: 7 }
    },
    BULWARK_CHARGE: { intentTags: ['move', 'protect', 'damage'], target: { pattern: 'line' }, estimates: { movement: 2, damage: 4, shielding: 2 } },
    VAULT: { intentTags: ['move', 'utility', 'control'], target: { pattern: 'single' }, estimates: { movement: 3, control: 2 } },
    GRAPPLE_HOOK: { intentTags: ['move', 'control'], target: { pattern: 'line' }, estimates: { movement: 3, control: 2 } },
    SHIELD_THROW: { intentTags: ['damage', 'control'], target: { pattern: 'line' }, estimates: { damage: 6, control: 2 } },
    SPEAR_THROW: {
        intentTags: ['damage'],
        target: { pattern: 'line' },
        estimates: { damage: 5 },
        risk: { requireEnemyContact: true, noContactPenalty: 4, noProgressCastPenalty: 5 }
    },
    FIREBALL: { intentTags: ['damage', 'hazard'], target: { pattern: 'radius', aoeRadius: 1 }, estimates: { damage: 5, control: 1 } },
    FIREWALL: { intentTags: ['hazard', 'control', 'damage'], target: { pattern: 'radius', aoeRadius: 2 }, estimates: { damage: 5, control: 3 } },
    FIREWALK: {
        intentTags: ['move', 'hazard', 'utility'],
        target: { pattern: 'single' },
        estimates: { movement: 3 },
        risk: { noProgressCastPenalty: 8 }
    },
    ABSORB_FIRE: {
        intentTags: ['heal', 'hazard', 'utility'],
        target: { pattern: 'self' },
        estimates: { healing: 6 },
        risk: { noProgressCastPenalty: 2 }
    },
    BOMB_TOSS: { intentTags: ['damage', 'control', 'hazard'], target: { pattern: 'radius', aoeRadius: 1 }, estimates: { damage: 6, control: 2 } },
    CORPSE_EXPLOSION: { intentTags: ['damage', 'control', 'hazard'], target: { pattern: 'radius', aoeRadius: 1 }, estimates: { damage: 6, control: 1 } },
    RAISE_DEAD: { intentTags: ['summon', 'control', 'utility'], target: { pattern: 'single' }, estimates: { summon: 5 } },
    SOUL_SWAP: { intentTags: ['move', 'control', 'utility'], target: { pattern: 'single' }, estimates: { movement: 2, control: 2 } },
    MULTI_SHOOT: { intentTags: ['damage'], target: { pattern: 'line' }, estimates: { damage: 5 } },
    SET_TRAP: { intentTags: ['control', 'hazard'], target: { pattern: 'single' }, estimates: { control: 3 } },
    SWIFT_ROLL: { intentTags: ['move', 'utility'], target: { pattern: 'single' }, estimates: { movement: 2 } },
    SNEAK_ATTACK: {
        intentTags: ['damage', 'move'],
        target: { pattern: 'single' },
        estimates: { damage: 8, movement: 2 },
        risk: { requireEnemyContact: true, noContactPenalty: 3, noProgressCastPenalty: 4 }
    },
    SMOKE_SCREEN: { intentTags: ['control', 'protect', 'utility'], target: { pattern: 'radius', aoeRadius: 1 }, estimates: { control: 4, shielding: 4 } },
    SHADOW_STEP: { intentTags: ['move', 'damage', 'utility'], target: { pattern: 'single' }, estimates: { movement: 3, damage: 3 } },
    FALCON_COMMAND: { intentTags: ['summon', 'control', 'utility'], target: { pattern: 'single' }, estimates: { summon: 4, control: 2 } },
    FALCON_PECK: { intentTags: ['damage'], target: { pattern: 'single' }, estimates: { damage: 3 } },
    FALCON_APEX_STRIKE: { intentTags: ['damage', 'control'], target: { pattern: 'single' }, estimates: { damage: 5, control: 1 } },
    FALCON_HEAL: { intentTags: ['heal', 'utility'], target: { pattern: 'single' }, estimates: { healing: 4 } },
    FALCON_SCOUT: { intentTags: ['control', 'utility'], target: { pattern: 'self' }, estimates: { control: 3 } },
    FALCON_AUTO_ROOST: { intentTags: ['summon', 'utility'], target: { pattern: 'self' }, estimates: { summon: 2 } },
    KINETIC_TRI_TRAP: { intentTags: ['control', 'hazard'], target: { pattern: 'radius', aoeRadius: 1 }, estimates: { control: 5, damage: 4 } },
    WITHDRAWAL: { intentTags: ['move', 'control', 'utility'], target: { pattern: 'single' }, estimates: { movement: 2, control: 1 } },
    SENTINEL_TELEGRAPH: { intentTags: ['control', 'objective'], target: { pattern: 'radius', aoeRadius: 2 }, estimates: { control: 3 } },
    SENTINEL_BLAST: { intentTags: ['damage', 'hazard'], target: { pattern: 'radius', aoeRadius: 2 }, estimates: { damage: 7 } },
    THEME_HAZARDS: { intentTags: ['hazard', 'control'], target: { pattern: 'global' }, estimates: { control: 2 } }
};

const mergeProfile = (base: SkillIntentProfile, patch?: PartialProfile): SkillIntentProfile => {
    if (!patch) return base;
    return {
        ...base,
        ...patch,
        target: { ...base.target, ...(patch.target || {}) },
        estimates: { ...base.estimates, ...(patch.estimates || {}) },
        economy: { ...base.economy, ...(patch.economy || {}) },
        risk: { ...base.risk, ...(patch.risk || {}) }
    };
};

export const buildSkillIntentProfile = (def: SkillDefinition): SkillIntentProfile => {
    const inferredTags = inferTags(def);
    const defaultPattern = hasTag(inferredTags, 'move') ? 'single' : 'single';
    const base: SkillIntentProfile = {
        id: def.id,
        intentTags: inferredTags,
        target: {
            range: Math.max(0, def.baseVariables.range || 0),
            pattern: defaultPattern
        },
        estimates: {
            damage: Math.max(0, def.baseVariables.damage || 0),
            movement: hasTag(inferredTags, 'move') ? Math.max(1, Math.min(3, def.baseVariables.range || 1)) : 0,
            healing: hasTag(inferredTags, 'heal') ? 2 : 0,
            shielding: hasTag(inferredTags, 'protect') ? 1 : 0,
            control: hasTag(inferredTags, 'control') ? 1 : 0,
            summon: hasTag(inferredTags, 'summon') ? 1 : 0
        },
        economy: {
            cost: Math.max(0, def.baseVariables.cost || 0),
            cooldown: Math.max(0, def.baseVariables.cooldown || 0),
            consumesTurn: true
        },
        risk: {
            selfExposure: hasTag(inferredTags, 'move') ? 0.5 : 0,
            hazardAffinity: hasTag(inferredTags, 'hazard') ? 0.5 : 0
        },
        complexity: 1
    };
    return mergeProfile(base, OVERRIDES[def.id as SkillID]);
};

export const validateSkillIntentProfile = (profile: SkillIntentProfile): string[] => {
    const errors: string[] = [];
    if (!profile.intentTags || profile.intentTags.length === 0) errors.push('intentTags must not be empty');
    if (!Number.isFinite(profile.target.range) || profile.target.range < 0) errors.push('target.range must be >= 0');
    if (!profile.target.pattern) errors.push('target.pattern is required');
    if (!Number.isFinite(profile.economy.cooldown) || profile.economy.cooldown < 0) errors.push('economy.cooldown must be >= 0');
    if (!Number.isFinite(profile.economy.cost) || profile.economy.cost < 0) errors.push('economy.cost must be >= 0');
    if (!Number.isFinite(profile.complexity) || profile.complexity < 0) errors.push('complexity must be >= 0');
    return errors;
};

export interface IntentProfileCoverageResult {
    missing: SkillID[];
    invalid: Array<{ skillId: SkillID; errors: string[] }>;
}

export const hydrateSkillIntentProfiles = (
    registry: Record<string, SkillDefinition>
): IntentProfileCoverageResult => {
    const missing: SkillID[] = [];
    const invalid: Array<{ skillId: SkillID; errors: string[] }> = [];

    for (const [skillId, def] of Object.entries(registry)) {
        const profile = def.intentProfile || buildSkillIntentProfile(def);
        def.intentProfile = profile;
        const errors = validateSkillIntentProfile(profile);
        if (errors.length > 0) {
            invalid.push({ skillId: skillId as SkillID, errors });
        }
        if (!profile) {
            missing.push(skillId as SkillID);
        }
    }

    return { missing, invalid };
};
