import type {
    IresMetabolicConfig,
    MetabolicActionBand,
    MetabolicActionClass,
    MetabolicPrimaryResource
} from './metabolic-types';

export interface ResolvedMetabolicActionProfile {
    sparkCost: number;
    manaCost: number;
    baseExhaustion: number;
}

export const DEFAULT_METABOLIC_ACTION_BANDS: IresMetabolicConfig['actionBands'] = {
    maintenance: {
        id: 'maintenance',
        sparkCost: 10,
        manaCost: 4,
        baseExhaustion: 0,
        description: 'Sustainable baseline events like ordinary walking or trivial upkeep.',
        intendedUse: 'sustainable'
    },
    light: {
        id: 'light',
        sparkCost: 16,
        manaCost: 5,
        baseExhaustion: 6,
        description: 'Repeatable light commitments that still carry real metabolic weight.',
        intendedUse: 'repeatable'
    },
    standard: {
        id: 'standard',
        sparkCost: 24,
        manaCost: 8,
        baseExhaustion: 12,
        description: 'Default committed tactical events that pressure sustain over a few beats.',
        intendedUse: 'committed'
    },
    heavy: {
        id: 'heavy',
        sparkCost: 32,
        manaCost: 12,
        baseExhaustion: 20,
        description: 'Burst actions that buy extra outcome now at clear reserve and exhaustion cost.',
        intendedUse: 'burst'
    },
    redline: {
        id: 'redline',
        sparkCost: 44,
        manaCost: 18,
        baseExhaustion: 32,
        description: 'Crisis-only actions that belong in overdrive or late-game superhuman play.',
        intendedUse: 'crisis'
    }
};

export const DEFAULT_METABOLIC_ACTION_CATALOG: IresMetabolicConfig['actionCatalog'] = {
    BASIC_MOVE: {
        id: 'BASIC_MOVE',
        kind: 'movement',
        bandId: 'maintenance',
        resourceMode: 'spark_only',
        countsAsMovement: true,
        countsAsAction: false,
        beatEventDelta: 1,
        movementSkillFamily: 'basic',
        travelEligible: true
    },
    DASH: {
        id: 'DASH',
        kind: 'movement',
        bandId: 'light',
        resourceMode: 'spark_only',
        countsAsMovement: true,
        countsAsAction: false,
        beatEventDelta: 1,
        movementSkillFamily: 'dash',
        travelEligible: true
    },
    JUMP: {
        id: 'JUMP',
        kind: 'movement',
        bandId: 'light',
        resourceMode: 'spark_only',
        countsAsMovement: true,
        countsAsAction: false,
        beatEventDelta: 1,
        movementSkillFamily: 'jump',
        travelEligible: true
    },
    VAULT: {
        id: 'VAULT',
        kind: 'hybrid',
        bandId: 'heavy',
        resourceMode: 'spark_only',
        countsAsMovement: true,
        countsAsAction: true,
        beatEventDelta: 1,
        movementSkillFamily: 'vault'
    },
    WITHDRAWAL: {
        id: 'WITHDRAWAL',
        kind: 'hybrid',
        bandId: 'heavy',
        resourceMode: 'spark_only',
        countsAsMovement: true,
        countsAsAction: true,
        beatEventDelta: 1,
        movementSkillFamily: 'hybrid'
    },
    PHASE_STEP: {
        id: 'PHASE_STEP',
        kind: 'movement',
        bandId: 'light',
        resourceMode: 'mana_only',
        countsAsMovement: true,
        countsAsAction: false,
        beatEventDelta: 1,
        movementSkillFamily: 'blink',
        travelEligible: true
    },
    FIREWALK: {
        id: 'FIREWALK',
        kind: 'movement',
        bandId: 'light',
        resourceMode: 'mana_only',
        countsAsMovement: true,
        countsAsAction: false,
        beatEventDelta: 1,
        movementSkillFamily: 'blink',
        travelEligible: true
    },
    SHADOW_STEP: {
        id: 'SHADOW_STEP',
        kind: 'hybrid',
        bandId: 'heavy',
        resourceMode: 'mana_only',
        countsAsMovement: true,
        countsAsAction: true,
        beatEventDelta: 1,
        movementSkillFamily: 'hybrid'
    },
    spark_attack_light: {
        id: 'spark_attack_light',
        kind: 'attack',
        bandId: 'light',
        resourceMode: 'spark_only',
        countsAsMovement: false,
        countsAsAction: true,
        beatEventDelta: 1
    },
    spark_attack_standard: {
        id: 'spark_attack_standard',
        kind: 'attack',
        bandId: 'standard',
        resourceMode: 'spark_only',
        countsAsMovement: false,
        countsAsAction: true,
        beatEventDelta: 1
    },
    spark_attack_heavy: {
        id: 'spark_attack_heavy',
        kind: 'attack',
        bandId: 'heavy',
        resourceMode: 'spark_only',
        countsAsMovement: false,
        countsAsAction: true,
        beatEventDelta: 1
    },
    mana_cast_light: {
        id: 'mana_cast_light',
        kind: 'cast',
        bandId: 'light',
        resourceMode: 'mana_only',
        countsAsMovement: false,
        countsAsAction: true,
        beatEventDelta: 1
    },
    mana_cast_standard: {
        id: 'mana_cast_standard',
        kind: 'cast',
        bandId: 'standard',
        resourceMode: 'mana_only',
        countsAsMovement: false,
        countsAsAction: true,
        beatEventDelta: 1
    },
    mana_cast_heavy: {
        id: 'mana_cast_heavy',
        kind: 'cast',
        bandId: 'heavy',
        resourceMode: 'mana_only',
        countsAsMovement: false,
        countsAsAction: true,
        beatEventDelta: 1
    },
    rest: {
        id: 'rest',
        kind: 'rest',
        bandId: 'maintenance',
        resourceMode: 'none',
        countsAsMovement: false,
        countsAsAction: false,
        beatEventDelta: 0
    }
};

export const resolveMetabolicActionBand = (
    config: Pick<IresMetabolicConfig, 'actionBands'>,
    bandId: MetabolicActionClass['bandId']
): MetabolicActionBand => config.actionBands[bandId];

export const resolveMetabolicActionProfile = (
    config: Pick<IresMetabolicConfig, 'actionBands'>,
    action: MetabolicActionClass
): ResolvedMetabolicActionProfile => {
    const band = resolveMetabolicActionBand(config, action.bandId);
    return {
        sparkCost: Math.max(0, band.sparkCost + (action.sparkCostOffset || 0)),
        manaCost: Math.max(0, band.manaCost + (action.manaCostOffset || 0)),
        baseExhaustion: Math.max(0, band.baseExhaustion + (action.baseExhaustionOffset || 0))
    };
};

export const resolveMetabolicPrimaryResource = (action: MetabolicActionClass): MetabolicPrimaryResource => {
    if (action.resourceMode === 'spark_only') return 'spark';
    if (action.resourceMode === 'mana_only') return 'mana';
    return 'none';
};

export const resolveMetabolicPrimaryCost = (
    config: Pick<IresMetabolicConfig, 'actionBands'>,
    action: MetabolicActionClass
): number => {
    const profile = resolveMetabolicActionProfile(config, action);
    if (action.resourceMode === 'spark_only') return profile.sparkCost;
    if (action.resourceMode === 'mana_only') return profile.manaCost;
    return 0;
};
