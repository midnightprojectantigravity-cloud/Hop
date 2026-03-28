import type { SkillAiTargetRule, SkillDefinition, SkillIntentProfile, SkillIntentTag } from '../types';
import type { SkillID } from '../types/registry';

type PartialProfile = Partial<Omit<SkillIntentProfile, 'id' | 'target' | 'estimates' | 'economy' | 'risk'>> & {
    target?: Partial<SkillIntentProfile['target']>;
    estimates?: Partial<SkillIntentProfile['estimates']>;
    economy?: Partial<SkillIntentProfile['economy']>;
    risk?: Partial<SkillIntentProfile['risk']>;
    ai?: Partial<NonNullable<SkillIntentProfile['ai']>>;
};

const deriveAiRules = (tags: SkillIntentTag[], aoeRadius?: number): SkillAiTargetRule[] => {
    const rules = new Set<SkillAiTargetRule>();
    if (tags.includes('damage')) rules.add('direct_hit');
    if ((aoeRadius || 0) > 0) rules.add('enemy_density');
    if (tags.includes('control') || tags.includes('hazard')) rules.add('empty_tile_adjacent_to_enemy');
    if (tags.includes('objective')) rules.add('objective_progress');
    if (tags.includes('move')) rules.add('self_preservation');
    return [...rules];
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
    BASIC_MOVE: {
        intentTags: ['move', 'objective', 'utility'],
        target: { pattern: 'single' },
        estimates: { movement: 1 },
        ai: {
            targetRules: ['self_preservation', 'objective_progress']
        }
    },
    BASIC_ATTACK: {
        intentTags: ['damage'],
        target: { pattern: 'single' },
        estimates: { damage: 4 },
        economy: { consumesTurn: true },
        ai: {
            desiredRange: 1,
            targetRules: ['direct_hit'],
            behaviorDelta: {
                offenseBias: 0.2,
                commitBias: 0.15,
                followThroughBias: 0.15
            }
        }
    },
    AUTO_ATTACK: { intentTags: ['damage', 'utility'], target: { pattern: 'single' }, estimates: { damage: 2 } },
    DASH: {
        intentTags: ['move', 'damage', 'utility'],
        target: { pattern: 'line' },
        estimates: { movement: 2, damage: 1 },
        risk: { requireEnemyContact: true, noContactPenalty: 4, noProgressCastPenalty: 8 }
    },
    JUMP: {
        intentTags: ['move', 'utility'],
        target: { pattern: 'single' },
        estimates: { movement: 2 },
        risk: { noProgressCastPenalty: 6 },
        ai: {
            mobilityRole: 'gap_close',
            behaviorDelta: {
                commitBias: 0.1
            }
        }
    },
    SHIELD_BASH: {
        intentTags: ['damage', 'control', 'protect'],
        target: { pattern: 'single' },
        estimates: { damage: 3, control: 2 },
        risk: { requireEnemyContact: true, noContactPenalty: 5, noProgressCastPenalty: 7 },
        ai: {
            desiredRange: 1,
            targetRules: ['direct_hit', 'self_preservation'],
            behaviorDelta: {
                offenseBias: 0.2,
                commitBias: 0.1
            }
        }
    },
    BULWARK_CHARGE: { intentTags: ['move', 'protect', 'damage'], target: { pattern: 'line' }, estimates: { movement: 2, damage: 4, shielding: 2 } },
    VAULT: {
        intentTags: ['move', 'control', 'utility'],
        target: { pattern: 'single' },
        estimates: { movement: 2, control: 1, damage: 0 },
        risk: { noProgressCastPenalty: 12 }
    },
    GRAPPLE_HOOK: {
        intentTags: ['move', 'control', 'damage', 'utility'],
        target: { pattern: 'line' },
        estimates: { movement: 2, control: 2, damage: 1 },
        risk: { requireEnemyContact: true, noContactPenalty: 8, noProgressCastPenalty: 18, hazardAffinity: 1 }
    },
    SHIELD_THROW: {
        intentTags: ['damage', 'control', 'utility'],
        target: { pattern: 'line' },
        estimates: { damage: 3, control: 3, shielding: 1 },
        risk: { requireEnemyContact: true, noContactPenalty: 8, noProgressCastPenalty: 20, hazardAffinity: 1.5 }
    },
    SPEAR_THROW: {
        intentTags: ['damage'],
        target: { pattern: 'line' },
        estimates: { damage: 5 },
        risk: { requireEnemyContact: true, noContactPenalty: 4, noProgressCastPenalty: 5 },
        ai: {
            desiredRange: [1, 2],
            targetRules: ['direct_hit'],
            behaviorDelta: {
                offenseBias: 0.15,
                commitBias: 0.1
            }
        }
    },
    ARCHER_SHOT: {
        intentTags: ['damage'],
        target: { pattern: 'line' },
        estimates: { damage: 2 },
        risk: { requireEnemyContact: true, noContactPenalty: 4, noProgressCastPenalty: 4 },
        ai: {
            desiredRange: [2, 4],
            targetRules: ['direct_hit', 'self_preservation', 'escape_exposure'],
            preferSafeAfterUse: true,
            behaviorDelta: {
                offenseBias: 0.1,
                selfPreservationBias: 0.25,
                commitBias: -0.1
            }
        }
    },
    FIREBALL: {
        intentTags: ['damage', 'hazard'],
        target: { pattern: 'radius', aoeRadius: 1 },
        estimates: { damage: 5, control: 1 },
        ai: {
            desiredRange: [2, 4],
            targetRules: ['direct_hit', 'enemy_density', 'escape_exposure'],
            preferSafeAfterUse: true,
            behaviorDelta: {
                offenseBias: 0.15,
                selfPreservationBias: 0.2,
                commitBias: -0.05,
                controlBias: 0.1
            }
        }
    },
    FIREWALL: {
        intentTags: ['hazard', 'control', 'damage'],
        target: { pattern: 'radius', aoeRadius: 2 },
        estimates: { damage: 5, control: 3 },
        ai: {
            desiredRange: [2, 4],
            targetRules: ['enemy_density', 'empty_tile_adjacent_to_enemy', 'escape_exposure'],
            preferSafeAfterUse: true,
            behaviorDelta: {
                controlBias: 0.45,
                selfPreservationBias: 0.2,
                offenseBias: 0.1,
                commitBias: -0.1
            }
        }
    },
    FIREWALK: {
        intentTags: ['move', 'hazard', 'utility'],
        target: { pattern: 'single' },
        estimates: { movement: 3 },
        risk: { noProgressCastPenalty: 8 },
        ai: {
            mobilityRole: 'reposition',
            targetRules: ['self_preservation', 'escape_exposure'],
            behaviorDelta: {
                selfPreservationBias: 0.15,
                controlBias: 0.05,
                commitBias: -0.05
            }
        }
    },
    ABSORB_FIRE: {
        intentTags: ['heal', 'hazard', 'utility'],
        target: { pattern: 'self' },
        estimates: { healing: 6 },
        economy: { consumesTurn: false },
        risk: { noProgressCastPenalty: 2 }
    },
    BOMB_TOSS: {
        intentTags: ['damage', 'control', 'hazard'],
        target: { pattern: 'radius', aoeRadius: 1 },
        estimates: { damage: 6, control: 2 },
        ai: {
            rangeModel: 'skill_range_plus_one',
            targetRules: ['empty_tile_adjacent_to_enemy', 'empty_tile_on_route', 'avoid_self_blast'],
            persistence: { turns: 2, radius: 1 },
            stationarySummon: true,
            behaviorDelta: {
                controlBias: 0.4,
                offenseBias: 0.1,
                selfPreservationBias: 0.2,
                commitBias: -0.05
            }
        }
    },
    TIME_BOMB: {
        intentTags: ['damage', 'hazard', 'utility'],
        target: { pattern: 'self' },
        estimates: { damage: 6, control: 1 },
        economy: { consumesTurn: false },
        ai: {
            persistence: { turns: 2, radius: 1 }
        }
    },
    VOLATILE_PAYLOAD: {
        intentTags: ['hazard', 'utility'],
        target: { pattern: 'self' },
        estimates: { control: 1 },
        economy: { consumesTurn: false }
    },
    CORPSE_EXPLOSION: { intentTags: ['damage', 'control', 'hazard'], target: { pattern: 'radius', aoeRadius: 1 }, estimates: { damage: 6, control: 1 } },
    RAISE_DEAD: {
        intentTags: ['summon', 'control', 'utility'],
        target: { pattern: 'single' },
        estimates: { summon: 5 },
        ai: {
            targetRules: ['objective_progress'],
            overlayOnSummon: {
                desiredRange: 1,
                offenseBias: 0.1,
                commitBias: 0.15,
                followThroughBias: 0.1
            }
        }
    },
    SOUL_SWAP: { intentTags: ['move', 'control', 'utility'], target: { pattern: 'single' }, estimates: { movement: 2, control: 2 } },
    MULTI_SHOOT: { intentTags: ['damage'], target: { pattern: 'line' }, estimates: { damage: 5 } },
    SET_TRAP: { intentTags: ['control', 'hazard'], target: { pattern: 'single' }, estimates: { control: 3 } },
    SWIFT_ROLL: { intentTags: ['move', 'utility'], target: { pattern: 'single' }, estimates: { movement: 2 } },
    BURROW: {
        intentTags: ['move', 'utility', 'objective'],
        target: { pattern: 'self' },
        estimates: { movement: 2, control: 1 },
        economy: { consumesTurn: false }
    },
    FLIGHT: {
        intentTags: ['move', 'utility', 'objective'],
        target: { pattern: 'self' },
        estimates: { movement: 2, control: 1 },
        economy: { consumesTurn: false }
    },
    PHASE_STEP: {
        intentTags: ['move', 'utility', 'objective'],
        target: { pattern: 'self' },
        estimates: { movement: 2, control: 1 },
        economy: { consumesTurn: false }
    },
    STANDARD_VISION: {
        intentTags: ['control', 'utility', 'objective'],
        estimates: { control: 1.5 },
        economy: { consumesTurn: false }
    },
    BASIC_AWARENESS: {
        intentTags: ['control', 'utility'],
        target: { pattern: 'self' },
        estimates: { control: 1 },
        economy: { consumesTurn: false }
    },
    COMBAT_ANALYSIS: {
        intentTags: ['control', 'utility'],
        target: { pattern: 'self' },
        estimates: { control: 1.2 },
        economy: { consumesTurn: false }
    },
    TACTICAL_INSIGHT: {
        intentTags: ['control', 'utility'],
        target: { pattern: 'self' },
        estimates: { control: 1.4 },
        economy: { consumesTurn: false }
    },
    ORACLE_SIGHT: {
        intentTags: ['control', 'utility'],
        target: { pattern: 'self' },
        estimates: { control: 1.6 },
        economy: { consumesTurn: false }
    },
    VIBRATION_SENSE: {
        intentTags: ['control', 'utility', 'objective'],
        estimates: { control: 2 },
        economy: { consumesTurn: false }
    },
    BLIND_FIGHTING: {
        intentTags: ['protect', 'control', 'utility'],
        target: { pattern: 'self' },
        estimates: { shielding: 1, control: 1 },
        economy: { consumesTurn: false }
    },
    ENEMY_AWARENESS: {
        intentTags: ['control', 'utility', 'objective'],
        estimates: { control: 1.2 },
        economy: { consumesTurn: false }
    },
    SNEAK_ATTACK: {
        intentTags: ['damage', 'move', 'utility'],
        target: { pattern: 'single' },
        estimates: { damage: 14, movement: 1 },
        risk: { requireEnemyContact: true, noContactPenalty: 2, noProgressCastPenalty: 3 }
    },
    SMOKE_SCREEN: {
        intentTags: ['control', 'protect', 'utility'],
        target: { pattern: 'radius', aoeRadius: 1 },
        estimates: { control: 0, shielding: 1 },
        risk: { noProgressCastPenalty: 100 }
    },
    SHADOW_STEP: {
        intentTags: ['move', 'utility'],
        target: { pattern: 'single' },
        estimates: { movement: 0, control: 0 },
        risk: { noProgressCastPenalty: 100 }
    },
    FALCON_COMMAND: {
        intentTags: ['summon', 'control', 'damage', 'utility'],
        target: { pattern: 'single' },
        estimates: { summon: 1, control: 0, damage: 2 },
        risk: { noProgressCastPenalty: 30 },
        ai: {
            targetRules: ['objective_progress']
        }
    },
    FALCON_PECK: {
        intentTags: ['damage'],
        target: { pattern: 'single' },
        estimates: { damage: 3 },
        ai: {
            desiredRange: 1,
            targetRules: ['direct_hit'],
            behaviorDelta: {
                offenseBias: 0.15,
                commitBias: 0.15
            }
        }
    },
    FALCON_APEX_STRIKE: {
        intentTags: ['damage', 'control'],
        target: { pattern: 'single' },
        estimates: { damage: 5, control: 1 },
        ai: {
            desiredRange: [1, 2],
            targetRules: ['direct_hit'],
            behaviorDelta: {
                offenseBias: 0.3,
                commitBias: 0.2,
                followThroughBias: 0.2
            }
        }
    },
    FALCON_HEAL: {
        intentTags: ['heal', 'utility'],
        target: { pattern: 'single' },
        estimates: { healing: 4 },
        ai: {
            rangeModel: 'owner_proximity',
            targetRules: ['self_preservation']
        }
    },
    FALCON_SCOUT: {
        intentTags: ['control', 'utility'],
        target: { pattern: 'self' },
        estimates: { control: 3 },
        ai: {
            rangeModel: 'anchor_proximity',
            targetRules: ['objective_progress']
        }
    },
    FALCON_AUTO_ROOST: {
        intentTags: ['summon', 'utility', 'protect'],
        target: { pattern: 'self' },
        estimates: { summon: 2, shielding: 1 },
        economy: { consumesTurn: false }
    },
    KINETIC_TRI_TRAP: {
        intentTags: ['control', 'hazard', 'damage'],
        target: { pattern: 'radius', aoeRadius: 1 },
        estimates: { control: 2, damage: 2 },
        risk: { noProgressCastPenalty: 40 }
    },
    WITHDRAWAL: {
        intentTags: ['move', 'damage', 'utility'],
        target: { pattern: 'single' },
        estimates: { movement: 0, control: 0, damage: 2 },
        risk: { noProgressCastPenalty: 40 }
    },
    SENTINEL_TELEGRAPH: { intentTags: ['control', 'objective'], target: { pattern: 'radius', aoeRadius: 2 }, estimates: { control: 3 } },
    SENTINEL_BLAST: { intentTags: ['damage', 'hazard'], target: { pattern: 'radius', aoeRadius: 2 }, estimates: { damage: 7 } },
    THEME_HAZARDS: {
        intentTags: ['hazard', 'control', 'utility'],
        target: { pattern: 'global' },
        estimates: { control: 2 },
        economy: { consumesTurn: false }
    }
};

const mergeProfile = (base: SkillIntentProfile, patch?: PartialProfile): SkillIntentProfile => {
    if (!patch) return base;
    return {
        ...base,
        ...patch,
        target: { ...base.target, ...(patch.target || {}) },
        estimates: { ...base.estimates, ...(patch.estimates || {}) },
        economy: { ...base.economy, ...(patch.economy || {}) },
        risk: { ...base.risk, ...(patch.risk || {}) },
        ai: patch.ai || base.ai
            ? { ...(base.ai || {}), ...(patch.ai || {}) }
            : undefined
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
            consumesTurn: def.slot !== 'passive'
        },
        risk: {
            selfExposure: hasTag(inferredTags, 'move') ? 0.5 : 0,
            hazardAffinity: hasTag(inferredTags, 'hazard') ? 0.5 : 0
        },
        ai: {
            targetRules: deriveAiRules(inferredTags)
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
