import { randomFromSeed } from '../rng';
import {
    calculateCombat,
    type CombatAttribute,
    type TrinityStats
} from '../combat/combat-calculator';
import { deriveMaxHpFromTrinity } from '../combat/trinity-resolver';

export type EcosystemBiome = 'red' | 'blue' | 'green' | 'white' | 'black';
export type RgbBiome = 'red' | 'blue' | 'green';
export type EcosystemLineage = 'native' | 'hybrid' | 'inversion';
export type DamageClass = 'physical' | 'magical';

export interface RangeBand {
    min: number;
    max: number;
}

export interface PropensityProfile {
    native: number;
    hybrid: number;
    inversion: number;
}

export interface EcosystemUnit {
    id: string;
    originBiome: EcosystemBiome;
    activeBiome: EcosystemBiome;
    lineage: EcosystemLineage;
    trinity: TrinityStats;
    preferredRange: RangeBand;
    damageClass: DamageClass;
    maxHp: number;
    hp: number;
    decayClock: number;
    sourceBiome?: RgbBiome;
}

export interface EvolutionOutcome {
    unit: EcosystemUnit;
    survived: boolean;
    operational: boolean;
    roundsSurvived: number;
    hazardDamageTaken: number;
    movementBudget: number;
    canTraverseThreeHexes: boolean;
}

export interface BiomeStressReport {
    targetBiome: EcosystemBiome;
    tested: number;
    survived: number;
    operational: number;
    canTraverseThreeHexes: number;
    survivalRate: number;
    operationalRate: number;
    traverseThreeHexesRate: number;
    avgRemainingHpRatio: number;
    avgMovementBudget: number;
}

export interface PredationArcReport {
    predator: RgbBiome;
    prey: RgbBiome;
    engagementRange: number;
    predatorPower: number;
    preyPower: number;
    advantage: number;
}

export interface EmergentBestiaryConfig {
    seed: string;
    biome: EcosystemBiome;
    batchSize?: number;
    hazardRounds?: number;
    movementFloor?: number;
    crossBiomeTargets?: readonly EcosystemBiome[];
    propensityTarget?: PropensityProfile;
}

export interface EmergentBestiaryReport {
    seed: string;
    biome: EcosystemBiome;
    generated: number;
    survivors: EcosystemUnit[];
    casualties: EcosystemUnit[];
    homeStress: BiomeStressReport;
    crossBiomeStress: BiomeStressReport[];
    propensity: PropensityProfile;
    propensityTarget: PropensityProfile;
    propensityDelta: PropensityProfile;
    predationArc: PredationArcReport[];
}

type StatRange = [number, number];

interface TrinityTemplate {
    body: StatRange;
    instinct: StatRange;
    mind: StatRange;
    preferredRange: RangeBand;
    damageClass: DamageClass | 'adaptive';
}

interface HazardModel {
    baseDamage: number;
    jitter: number;
    bodyMitigation: number;
    instinctMitigation: number;
    mindMitigation: number;
    movementTax: number;
}

const RGB_BIOMES: readonly RgbBiome[] = ['red', 'blue', 'green'];

const DEFAULT_PROPENSITY_TARGET: PropensityProfile = {
    native: 0.6,
    hybrid: 0.3,
    inversion: 0.1
};

const BIOME_TEMPLATES: Record<EcosystemBiome, Record<EcosystemLineage, TrinityTemplate>> = {
    red: {
        native: {
            body: [9, 13],
            instinct: [4, 8],
            mind: [1, 4],
            preferredRange: { min: 1, max: 1 },
            damageClass: 'physical'
        },
        hybrid: {
            body: [8, 11],
            instinct: [7, 11],
            mind: [2, 5],
            preferredRange: { min: 1, max: 2 },
            damageClass: 'physical'
        },
        inversion: {
            body: [4, 7],
            instinct: [3, 6],
            mind: [8, 12],
            preferredRange: { min: 2, max: 3 },
            damageClass: 'magical'
        }
    },
    blue: {
        native: {
            body: [1, 4],
            instinct: [4, 8],
            mind: [9, 13],
            preferredRange: { min: 2, max: 3 },
            damageClass: 'magical'
        },
        hybrid: {
            body: [2, 5],
            instinct: [7, 10],
            mind: [8, 12],
            preferredRange: { min: 2, max: 4 },
            damageClass: 'magical'
        },
        inversion: {
            body: [8, 12],
            instinct: [3, 6],
            mind: [4, 7],
            preferredRange: { min: 1, max: 2 },
            damageClass: 'physical'
        }
    },
    green: {
        native: {
            body: [4, 7],
            instinct: [9, 13],
            mind: [2, 5],
            preferredRange: { min: 4, max: 6 },
            damageClass: 'physical'
        },
        hybrid: {
            body: [3, 6],
            instinct: [8, 12],
            mind: [6, 9],
            preferredRange: { min: 3, max: 6 },
            damageClass: 'adaptive'
        },
        inversion: {
            body: [8, 12],
            instinct: [3, 6],
            mind: [3, 6],
            preferredRange: { min: 1, max: 2 },
            damageClass: 'physical'
        }
    },
    white: {
        native: {
            body: [5, 8],
            instinct: [5, 8],
            mind: [5, 8],
            preferredRange: { min: 2, max: 4 },
            damageClass: 'adaptive'
        },
        hybrid: {
            body: [4, 9],
            instinct: [4, 9],
            mind: [4, 9],
            preferredRange: { min: 2, max: 4 },
            damageClass: 'adaptive'
        },
        inversion: {
            body: [3, 10],
            instinct: [3, 10],
            mind: [3, 10],
            preferredRange: { min: 2, max: 4 },
            damageClass: 'adaptive'
        }
    },
    black: {
        native: {
            body: [5, 9],
            instinct: [5, 9],
            mind: [5, 9],
            preferredRange: { min: 1, max: 4 },
            damageClass: 'adaptive'
        },
        hybrid: {
            body: [5, 9],
            instinct: [5, 9],
            mind: [5, 9],
            preferredRange: { min: 1, max: 4 },
            damageClass: 'adaptive'
        },
        inversion: {
            body: [5, 9],
            instinct: [5, 9],
            mind: [5, 9],
            preferredRange: { min: 1, max: 4 },
            damageClass: 'adaptive'
        }
    }
};

const HAZARD_MODELS: Record<EcosystemBiome, HazardModel> = {
    red: {
        baseDamage: 6.8,
        jitter: 2.2,
        bodyMitigation: 0.44,
        instinctMitigation: 0.12,
        mindMitigation: 0.08,
        movementTax: 2.1
    },
    blue: {
        baseDamage: 6.2,
        jitter: 2.4,
        bodyMitigation: 0.12,
        instinctMitigation: 0.18,
        mindMitigation: 0.42,
        movementTax: 1.8
    },
    green: {
        baseDamage: 6.0,
        jitter: 2.8,
        bodyMitigation: 0.18,
        instinctMitigation: 0.42,
        mindMitigation: 0.12,
        movementTax: 2.8
    },
    white: {
        baseDamage: 4.2,
        jitter: 1.6,
        bodyMitigation: 0.2,
        instinctMitigation: 0.2,
        mindMitigation: 0.2,
        movementTax: 1.1
    },
    black: {
        baseDamage: 7.2,
        jitter: 2.4,
        bodyMitigation: 0.16,
        instinctMitigation: 0.16,
        mindMitigation: 0.16,
        movementTax: 3.3
    }
};

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

const trinityKeys: Array<keyof TrinityStats> = ['body', 'mind', 'instinct'];

const createEntropy = (seed: string, startCounter = 0) => {
    let counter = startCounter;
    return () => randomFromSeed(seed, counter++);
};

const rollInt = (next: () => number, [min, max]: StatRange): number =>
    min + Math.floor(next() * ((max - min) + 1));

const dominantStat = (trinity: TrinityStats): keyof TrinityStats =>
    trinityKeys.reduce((best, key) => trinity[key] > trinity[best] ? key : best, trinityKeys[0]);

const weakestStat = (trinity: TrinityStats): keyof TrinityStats =>
    trinityKeys.reduce((best, key) => trinity[key] < trinity[best] ? key : best, trinityKeys[0]);

const resolveDamageClass = (
    damageClass: TrinityTemplate['damageClass'],
    trinity: TrinityStats
): DamageClass => {
    if (damageClass !== 'adaptive') return damageClass;
    return dominantStat(trinity) === 'mind' ? 'magical' : 'physical';
};

const pickLineage = (roll: number, target: PropensityProfile): EcosystemLineage => {
    const nativeCutoff = target.native;
    const hybridCutoff = target.native + target.hybrid;
    if (roll < nativeCutoff) return 'native';
    if (roll < hybridCutoff) return 'hybrid';
    return 'inversion';
};

const pickRgbBiome = (roll: number): RgbBiome =>
    RGB_BIOMES[Math.floor(roll * RGB_BIOMES.length) % RGB_BIOMES.length];

const rollTrinityFromTemplate = (template: TrinityTemplate, next: () => number): TrinityStats => ({
    body: rollInt(next, template.body),
    instinct: rollInt(next, template.instinct),
    mind: rollInt(next, template.mind)
});

const createBlackCorruptedTrinity = (
    lineage: EcosystemLineage,
    next: () => number
): { trinity: TrinityStats; sourceBiome: RgbBiome; preferredRange: RangeBand; damageClass: DamageClass } => {
    const sourceBiome = pickRgbBiome(next());
    const sourceTemplate = BIOME_TEMPLATES[sourceBiome][lineage];
    const trinity = rollTrinityFromTemplate(sourceTemplate, next);
    const weakest = weakestStat(trinity);
    trinity[weakest] = 7;
    return {
        trinity,
        sourceBiome,
        preferredRange: { ...sourceTemplate.preferredRange },
        damageClass: resolveDamageClass(sourceTemplate.damageClass, trinity)
    };
};

const createUnit = (
    biome: EcosystemBiome,
    id: string,
    lineage: EcosystemLineage,
    next: () => number
): EcosystemUnit => {
    if (biome === 'black') {
        const corrupted = createBlackCorruptedTrinity(lineage, next);
        const maxHp = Math.max(8, Math.floor(deriveMaxHpFromTrinity(corrupted.trinity) * 0.33));
        return {
            id,
            lineage,
            originBiome: biome,
            activeBiome: biome,
            sourceBiome: corrupted.sourceBiome,
            trinity: corrupted.trinity,
            preferredRange: corrupted.preferredRange,
            damageClass: corrupted.damageClass,
            maxHp,
            hp: maxHp,
            decayClock: 1
        };
    }

    const template = BIOME_TEMPLATES[biome][lineage];
    const trinity = rollTrinityFromTemplate(template, next);
    const maxHp = Math.max(8, Math.floor(deriveMaxHpFromTrinity(trinity) * 0.33));
    return {
        id,
        lineage,
        originBiome: biome,
        activeBiome: biome,
        trinity,
        preferredRange: { ...template.preferredRange },
        damageClass: resolveDamageClass(template.damageClass, trinity),
        maxHp,
        hp: maxHp,
        decayClock: 0
    };
};

const biomePressure = (trinity: TrinityStats, biome: EcosystemBiome): number => {
    switch (biome) {
        case 'red':
            return Math.max(0, 9 - trinity.body) * 0.9;
        case 'blue':
            return Math.max(0, 9 - trinity.mind) * 0.9;
        case 'green':
            return Math.max(0, 9 - trinity.instinct) * 0.9;
        case 'white':
            return Math.max(0, 6 - ((trinity.body + trinity.mind + trinity.instinct) / 3)) * 0.5;
        case 'black':
        default: {
            const weakest = trinity[weakestStat(trinity)];
            return Math.max(0, 7 - weakest) * 1.1;
        }
    }
};

const computeMovementBudget = (trinity: TrinityStats, biome: EcosystemBiome): number => {
    const model = HAZARD_MODELS[biome];
    let mobility = 1
        + (trinity.instinct * 0.45)
        + (trinity.body * 0.2)
        + (trinity.mind * 0.1)
        - model.movementTax;
    if (biome === 'green' && trinity.instinct < 7) mobility -= 1.5;
    if (biome === 'red' && trinity.body < 7) mobility -= 1.2;
    if (biome === 'blue' && trinity.mind < 7) mobility -= 1.2;
    if (biome === 'black') mobility -= 0.8;
    return Math.max(0, Math.floor(mobility));
};

const runHazardTrial = (
    unit: EcosystemUnit,
    biome: EcosystemBiome,
    hazardRounds: number,
    movementFloor: number,
    seed: string
): EvolutionOutcome => {
    const model = HAZARD_MODELS[biome];
    const next = createEntropy(`${seed}:hazard:${unit.id}:${biome}`);
    let hp = unit.maxHp;
    let roundsSurvived = 0;
    let hazardDamageTaken = 0;
    const pressure = biomePressure(unit.trinity, biome);
    const inversionShield = (
        unit.lineage === 'inversion' && unit.originBiome === biome
    )
        ? (
            biome === 'red'
                ? unit.trinity.mind * 0.3
                : (biome === 'blue'
                    ? unit.trinity.body * 0.24
                    : (biome === 'green'
                        ? unit.trinity.body * 0.2
                        : 0))
        )
        : 0;

    for (let round = 0; round < hazardRounds; round++) {
        const jitter = ((next() * 2) - 1) * model.jitter;
        const mitigation = (unit.trinity.body * model.bodyMitigation)
            + (unit.trinity.instinct * model.instinctMitigation)
            + (unit.trinity.mind * model.mindMitigation)
            + inversionShield;
        let damage = Math.max(0, Math.round((model.baseDamage + pressure + jitter) - mitigation));
        if (unit.decayClock > 0) {
            damage += unit.decayClock;
        }
        hp -= damage;
        hazardDamageTaken += damage;
        roundsSurvived++;
        if (hp <= 0) break;
    }

    const movementBudget = computeMovementBudget(unit.trinity, biome);
    const survived = hp > 0;
    const canTraverseThreeHexes = movementBudget >= 3;
    const operational = survived && movementBudget >= movementFloor;

    return {
        unit: {
            ...unit,
            activeBiome: biome,
            hp: Math.max(0, hp)
        },
        survived,
        operational,
        roundsSurvived,
        hazardDamageTaken,
        movementBudget,
        canTraverseThreeHexes
    };
};

const summarizeStress = (
    outcomes: EvolutionOutcome[],
    targetBiome: EcosystemBiome
): BiomeStressReport => {
    const tested = outcomes.length;
    const survived = outcomes.filter(o => o.survived).length;
    const operational = outcomes.filter(o => o.operational).length;
    const canTraverseThreeHexes = outcomes.filter(o => o.canTraverseThreeHexes).length;
    const avgRemainingHpRatio = tested > 0
        ? outcomes.reduce((acc, o) => acc + (o.unit.hp / Math.max(1, o.unit.maxHp)), 0) / tested
        : 0;
    const avgMovementBudget = tested > 0
        ? outcomes.reduce((acc, o) => acc + o.movementBudget, 0) / tested
        : 0;

    return {
        targetBiome,
        tested,
        survived,
        operational,
        canTraverseThreeHexes,
        survivalRate: tested > 0 ? survived / tested : 0,
        operationalRate: tested > 0 ? operational / tested : 0,
        traverseThreeHexesRate: tested > 0 ? canTraverseThreeHexes / tested : 0,
        avgRemainingHpRatio: round4(avgRemainingHpRatio),
        avgMovementBudget: round4(avgMovementBudget)
    };
};

const computePropensity = (units: EcosystemUnit[]): PropensityProfile => {
    if (units.length <= 0) {
        return { native: 0, hybrid: 0, inversion: 0 };
    }
    const counts = {
        native: units.filter(u => u.lineage === 'native').length,
        hybrid: units.filter(u => u.lineage === 'hybrid').length,
        inversion: units.filter(u => u.lineage === 'inversion').length
    };
    return {
        native: round4(counts.native / units.length),
        hybrid: round4(counts.hybrid / units.length),
        inversion: round4(counts.inversion / units.length)
    };
};

const computePropensityDelta = (
    actual: PropensityProfile,
    target: PropensityProfile
): PropensityProfile => ({
    native: round4(actual.native - target.native),
    hybrid: round4(actual.hybrid - target.hybrid),
    inversion: round4(actual.inversion - target.inversion)
});

const midpoint = ([min, max]: StatRange): number =>
    Math.floor((min + max) / 2);

const createBiomeRepresentative = (biome: RgbBiome): EcosystemUnit => {
    const template = BIOME_TEMPLATES[biome].native;
    const trinity: TrinityStats = {
        body: midpoint(template.body),
        instinct: midpoint(template.instinct),
        mind: midpoint(template.mind)
    };
    const maxHp = Math.max(8, Math.floor(deriveMaxHpFromTrinity(trinity) * 0.33));
    return {
        id: `rep-${biome}`,
        originBiome: biome,
        activeBiome: biome,
        lineage: 'native',
        trinity,
        preferredRange: { ...template.preferredRange },
        damageClass: resolveDamageClass(template.damageClass, trinity),
        maxHp,
        hp: maxHp,
        decayClock: 0
    };
};

const buildScaling = (damageClass: DamageClass, trinity: TrinityStats) => {
    if (damageClass === 'magical') {
        return [
            { attribute: 'mind' as CombatAttribute, coefficient: 0.26 },
            { attribute: 'instinct' as CombatAttribute, coefficient: 0.06 }
        ];
    }

    const primary: CombatAttribute = trinity.body >= trinity.instinct ? 'body' : 'instinct';
    const secondary: CombatAttribute = primary === 'body' ? 'instinct' : 'body';
    return [
        { attribute: primary, coefficient: 0.24 },
        { attribute: secondary, coefficient: 0.08 }
    ];
};

const runPredationArc = (): PredationArcReport[] => {
    const red = createBiomeRepresentative('red');
    const blue = createBiomeRepresentative('blue');
    const green = createBiomeRepresentative('green');
    const units: Record<RgbBiome, EcosystemUnit> = { red, blue, green };

    const arcs: Array<{ predator: RgbBiome; prey: RgbBiome; engagementRange: number }> = [
        { predator: 'red', prey: 'green', engagementRange: 1 },
        { predator: 'green', prey: 'blue', engagementRange: 5 },
        { predator: 'blue', prey: 'red', engagementRange: 3 }
    ];

    return arcs.map(arc => {
        const predator = units[arc.predator];
        const prey = units[arc.prey];
        const predatorCalc = calculateCombat({
            attackerId: predator.id,
            targetId: prey.id,
            skillId: `SIM_${arc.predator.toUpperCase()}`,
            basePower: 10,
            trinity: predator.trinity,
            targetTrinity: prey.trinity,
            damageClass: predator.damageClass,
            interactionModel: 'triangle',
            statusMultipliers: [],
            scaling: buildScaling(predator.damageClass, predator.trinity),
            engagementRange: arc.engagementRange,
            optimalRangeMin: predator.preferredRange.min,
            optimalRangeMax: predator.preferredRange.max,
            targetOptimalRangeMin: prey.preferredRange.min,
            targetOptimalRangeMax: prey.preferredRange.max
        });
        const preyCalc = calculateCombat({
            attackerId: prey.id,
            targetId: predator.id,
            skillId: `SIM_${arc.prey.toUpperCase()}`,
            basePower: 10,
            trinity: prey.trinity,
            targetTrinity: predator.trinity,
            damageClass: prey.damageClass,
            interactionModel: 'triangle',
            statusMultipliers: [],
            scaling: buildScaling(prey.damageClass, prey.trinity),
            engagementRange: arc.engagementRange,
            optimalRangeMin: prey.preferredRange.min,
            optimalRangeMax: prey.preferredRange.max,
            targetOptimalRangeMin: predator.preferredRange.min,
            targetOptimalRangeMax: predator.preferredRange.max
        });

        return {
            predator: arc.predator,
            prey: arc.prey,
            engagementRange: arc.engagementRange,
            predatorPower: predatorCalc.finalPower,
            preyPower: preyCalc.finalPower,
            advantage: predatorCalc.finalPower - preyCalc.finalPower
        };
    });
};

const sanitizePropensity = (value: PropensityProfile): PropensityProfile => {
    const native = clamp(value.native, 0, 1);
    const hybrid = clamp(value.hybrid, 0, 1);
    const inversion = clamp(value.inversion, 0, 1);
    const total = native + hybrid + inversion;
    if (total <= 0) return DEFAULT_PROPENSITY_TARGET;
    return {
        native: native / total,
        hybrid: hybrid / total,
        inversion: inversion / total
    };
};

export const runEmergentBestiarySimulation = (
    input: EmergentBestiaryConfig
): EmergentBestiaryReport => {
    const batchSize = Math.max(1, Math.floor(input.batchSize ?? 120));
    const hazardRounds = Math.max(1, Math.floor(input.hazardRounds ?? 6));
    const movementFloor = Math.max(1, Math.floor(input.movementFloor ?? 3));
    const propensityTarget = sanitizePropensity(input.propensityTarget ?? DEFAULT_PROPENSITY_TARGET);
    const next = createEntropy(`${input.seed}:spawn:${input.biome}`);

    const generated: EcosystemUnit[] = [];
    for (let i = 0; i < batchSize; i++) {
        const lineage = pickLineage(next(), propensityTarget);
        generated.push(createUnit(input.biome, `${input.biome}_${i + 1}`, lineage, next));
    }

    const homeOutcomes = generated.map(unit =>
        runHazardTrial(unit, input.biome, hazardRounds, movementFloor, input.seed)
    );
    const survivors = homeOutcomes.filter(o => o.survived).map(o => o.unit);
    const casualties = homeOutcomes.filter(o => !o.survived).map(o => o.unit);

    const targetCrossBiomes = (input.crossBiomeTargets || RGB_BIOMES)
        .filter(b => b !== input.biome);
    const crossBiomeStress = targetCrossBiomes.map(targetBiome => {
        const outcomes = survivors.map(unit =>
            runHazardTrial(
                unit,
                targetBiome,
                hazardRounds,
                movementFloor,
                `${input.seed}:cross:${targetBiome}`
            )
        );
        return summarizeStress(outcomes, targetBiome);
    });

    const propensity = computePropensity(survivors);
    return {
        seed: input.seed,
        biome: input.biome,
        generated: batchSize,
        survivors,
        casualties,
        homeStress: summarizeStress(homeOutcomes, input.biome),
        crossBiomeStress,
        propensity,
        propensityTarget,
        propensityDelta: computePropensityDelta(propensity, propensityTarget),
        predationArc: runPredationArc()
    };
};
