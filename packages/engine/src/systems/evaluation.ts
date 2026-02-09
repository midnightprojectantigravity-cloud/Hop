import type { Actor, GameState, SkillIntentProfile } from '../types';
import type { Tile } from './tile-types';
import { SkillRegistry } from '../skillRegistry';
import { computeSkillNumericGrade } from './skill-grading';
import { DEFAULT_CALIBRATION_PROFILE, type CalibrationProfile } from './calibration';

export type EvaluationKind = 'skill' | 'entity' | 'tile' | 'map' | 'encounter';

export interface GradeEnvelope {
    power: number;
    survivability: number;
    control: number;
    mobility: number;
    economy: number;
    risk: number;
    complexity: number;
    objectivePressure: number;
}

export interface GradeResult {
    id: string;
    kind: EvaluationKind;
    envelope: GradeEnvelope;
    numericGrade: number;
    efficiencyGrade: number;
    difficultyGrade: number;
    rationale: string[];
    metadata?: Record<string, unknown>;
}

export type Evaluator<I> = (input: I, context?: EvaluationContext) => GradeResult;

export interface EvaluationContext {
    state?: GameState;
    seed?: string;
    calibration?: CalibrationProfile;
}

export interface MapEvaluationInput {
    id: string;
    tiles: Map<string, Tile>;
    playerSpawn?: { q: number; r: number; s: number };
    stairsPosition?: { q: number; r: number; s: number };
    shrinePosition?: { q: number; r: number; s: number };
}

export interface EncounterEvaluationInput {
    id: string;
    map: MapEvaluationInput;
    enemies: Actor[];
    objectives?: Array<{ id: string; target: number }>;
}

const round4 = (n: number) => Number(n.toFixed(4));
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const normalizeEnvelope = (e: GradeEnvelope): GradeEnvelope => ({
    power: round4(clamp(e.power)),
    survivability: round4(clamp(e.survivability)),
    control: round4(clamp(e.control)),
    mobility: round4(clamp(e.mobility)),
    economy: round4(clamp(e.economy)),
    risk: round4(clamp(e.risk)),
    complexity: round4(clamp(e.complexity)),
    objectivePressure: round4(clamp(e.objectivePressure))
});
const scoreEnvelope = (e: GradeEnvelope) => {
    const efficiency = (
        e.power * 1.8 +
        e.survivability * 1.3 +
        e.control * 1.1 +
        e.mobility * 1.2 +
        e.economy * 1.0 -
        e.risk * 1.0
    );
    const difficulty = (
        e.power * 1.6 +
        e.control * 1.2 +
        e.objectivePressure * 1.4 +
        e.risk * 0.8 -
        e.survivability * 0.5
    );
    return {
        efficiency: round4(clamp(efficiency)),
        difficulty: round4(clamp(difficulty)),
        numeric: round4(clamp((efficiency + difficulty) / 2))
    };
};

export class EvaluationRegistry {
    private evaluators = new Map<EvaluationKind, Evaluator<any>>();

    register<I>(kind: EvaluationKind, evaluator: Evaluator<I>) {
        this.evaluators.set(kind, evaluator as Evaluator<any>);
    }

    evaluate<I>(kind: EvaluationKind, input: I, context?: EvaluationContext): GradeResult {
        const evaluator = this.evaluators.get(kind);
        if (!evaluator) {
            throw new Error(`Missing evaluator for kind: ${kind}`);
        }
        return evaluator(input, context);
    }
}

const blankEnvelope = (): GradeEnvelope => ({
    power: 0,
    survivability: 0,
    control: 0,
    mobility: 0,
    economy: 0,
    risk: 0,
    complexity: 0,
    objectivePressure: 0
});

const withCalibration = (context?: EvaluationContext): CalibrationProfile => context?.calibration || DEFAULT_CALIBRATION_PROFILE;

export const evaluateSkillProfile = (profile: SkillIntentProfile): GradeResult => {
    return evaluateSkillProfileWithContext(profile);
};

const evaluateSkillProfileWithContext = (profile: SkillIntentProfile, context?: EvaluationContext): GradeResult => {
    const calibration = withCalibration(context);
    const g = computeSkillNumericGrade(profile);
    const perSkill = calibration.skill.perSkillScalar[profile.id] || 1;
    const envelope: GradeEnvelope = {
        power: clamp(((profile.estimates.damage || 0) * 4 + (profile.estimates.control || 0) * 6) * calibration.skill.powerCoeff * perSkill),
        survivability: clamp(((profile.estimates.healing || 0) * 7 + (profile.estimates.shielding || 0) * 6) * calibration.skill.safetyCoeff),
        control: clamp((profile.estimates.control || 0) * 9 * calibration.skill.safetyCoeff),
        mobility: clamp((profile.estimates.movement || 0) * 9 + (profile.target.range || 0) * 2),
        economy: clamp((40 + (10 / (1 + profile.economy.cooldown)) - profile.economy.cost) * calibration.skill.tempoCoeff),
        risk: clamp((profile.risk.selfExposure || 0) * 20 - (profile.risk.hazardAffinity || 0) * 8),
        complexity: clamp(profile.complexity * 8 * calibration.skill.complexityCoeff),
        objectivePressure: clamp(((profile.intentTags.includes('objective') ? 35 : 0) + (profile.target.range * 2)) * calibration.skill.reachCoeff)
    };
    const scored = scoreEnvelope(envelope);
    return {
        id: profile.id,
        kind: 'skill',
        envelope,
        numericGrade: round4((g.numericGrade * calibration.skill.staticWeight + scored.numeric * (1 - calibration.skill.staticWeight)) * perSkill),
        efficiencyGrade: scored.efficiency,
        difficultyGrade: scored.difficulty,
        rationale: ['Skill profile envelope + static grading blend']
    };
};

export const evaluateTile = (tile: Tile, context?: EvaluationContext): GradeResult => {
    const calibration = withCalibration(context);
    const envelope = blankEnvelope();
    const traits = tile.traits;
    if (traits.has('HAZARDOUS') || traits.has('DAMAGING') || traits.has('LAVA') || traits.has('VOID') || traits.has('PIT')) {
        envelope.power += 45 * calibration.encounter.hazardWeight;
        envelope.risk += 65 * calibration.encounter.hazardWeight;
        envelope.objectivePressure += 20;
    }
    if (traits.has('BLOCKS_MOVEMENT')) {
        envelope.control += 30;
        envelope.objectivePressure += 12;
    }
    if (traits.has('SLIPPERY')) {
        envelope.mobility += 18;
        envelope.risk += 12;
    }
    if (traits.has('WALKABLE')) {
        envelope.mobility += 8;
        envelope.economy += 10;
    }
    if (traits.has('ANCHOR')) {
        envelope.mobility += 6;
        envelope.control += 6;
    }
    envelope.complexity = clamp((tile.effects?.length || 0) * 12 + traits.size * 2);
    const scored = scoreEnvelope(envelope);
    return {
        id: `${tile.baseId}@${tile.position.q},${tile.position.r}`,
        kind: 'tile',
        envelope: normalizeEnvelope(envelope),
        numericGrade: scored.numeric,
        efficiencyGrade: scored.efficiency,
        difficultyGrade: scored.difficulty,
        rationale: ['Tile trait and effect weighting']
    };
};

export const evaluateEntity = (actor: Actor, context?: EvaluationContext): GradeResult => {
    const calibration = withCalibration(context);
    const envelope = blankEnvelope();
    const hpRatio = actor.maxHp > 0 ? actor.hp / actor.maxHp : 0;
    envelope.survivability = clamp(
        (actor.maxHp * calibration.entity.hpSurvivabilityCoeff)
        + (hpRatio * 15)
        + ((actor.temporaryArmor || 0) * calibration.entity.armorSurvivabilityCoeff)
    );
    envelope.mobility = clamp((actor.speed || 0) * calibration.entity.speedMobilityCoeff);
    envelope.economy = clamp((actor.speed || 0) * calibration.entity.speedEconomyCoeff + (actor.activeSkills?.length || 0) * 3);
    envelope.risk = clamp((1 - hpRatio) * 40);
    envelope.complexity = clamp((actor.activeSkills?.length || 0) * 6 + (actor.statusEffects?.length || 0) * 3);

    for (const skill of actor.activeSkills || []) {
        const profile = SkillRegistry.get(skill.id)?.intentProfile;
        if (!profile) continue;
        const perSkill = calibration.skill.perSkillScalar[skill.id] || 1;
        envelope.power += clamp(((profile.estimates.damage || 0) * 3 + (profile.estimates.summon || 0) * 4) * calibration.entity.skillPowerCoeff * perSkill, 0, 25);
        envelope.control += clamp((profile.estimates.control || 0) * 4 * calibration.entity.skillControlCoeff, 0, 20);
        envelope.mobility += clamp((profile.estimates.movement || 0) * 3 * calibration.entity.skillMobilityCoeff, 0, 20);
        envelope.objectivePressure += profile.intentTags.includes('objective') ? 6 : 0;
    }

    envelope.power = clamp(envelope.power);
    envelope.control = clamp(envelope.control);
    envelope.mobility = clamp(envelope.mobility);
    envelope.objectivePressure = clamp(envelope.objectivePressure);

    const scored = scoreEnvelope(envelope);
    const policyEfficiency = (
        (calibration.policy.offenseWeight + calibration.policy.defenseWeight + calibration.policy.positioningWeight + calibration.policy.statusWeight)
        / 4
    );
    const policyDifficulty = (
        (calibration.policy.offenseWeight + calibration.policy.statusWeight + calibration.policy.riskPenaltyWeight)
        / 3
    );
    const efficiencyGrade = round4(clamp(scored.efficiency * policyEfficiency));
    const difficultyGrade = round4(clamp(scored.difficulty * policyDifficulty));
    return {
        id: actor.id,
        kind: 'entity',
        envelope: normalizeEnvelope(envelope),
        numericGrade: round4(clamp((efficiencyGrade + difficultyGrade) / 2)),
        efficiencyGrade,
        difficultyGrade,
        rationale: ['Actor stats + loadout intent profile aggregation'],
        metadata: {
            subtype: actor.subtype || actor.type,
            skillCount: actor.activeSkills?.length || 0
        }
    };
};

export const evaluateMap = (input: MapEvaluationInput, context?: EvaluationContext): GradeResult => {
    const calibration = withCalibration(context);
    const envelope = blankEnvelope();
    const tiles = [...input.tiles.values()];
    const hazardCount = tiles.filter(t =>
        t.traits.has('HAZARDOUS') || t.baseId === 'LAVA' || t.baseId === 'VOID'
    ).length;
    const blockedCount = tiles.filter(t => t.traits.has('BLOCKS_MOVEMENT')).length;
    const walkableCount = tiles.filter(t => t.traits.has('WALKABLE')).length;
    const total = Math.max(1, tiles.length);
    const hazardDensity = hazardCount / total;
    const blockedDensity = blockedCount / total;

    envelope.power = clamp(hazardDensity * 100 * 0.7 * calibration.encounter.hazardWeight);
    envelope.control = clamp(blockedDensity * 100 * 0.8 * calibration.encounter.pathFrictionWeight);
    envelope.mobility = clamp((walkableCount / total) * 70 - blockedDensity * 20 * calibration.encounter.pathFrictionWeight);
    envelope.risk = clamp(hazardDensity * 120 * calibration.encounter.hazardWeight + blockedDensity * 40 * calibration.encounter.pathFrictionWeight);
    envelope.objectivePressure = clamp(((input.stairsPosition ? 25 : 0) + (input.shrinePosition ? 20 : 0) + hazardDensity * 40) * calibration.encounter.objectiveWeight);
    envelope.complexity = clamp((hazardDensity * 100 * 0.4) + (blockedDensity * 100 * 0.4));
    envelope.economy = clamp(50 - blockedDensity * 40);
    envelope.survivability = clamp(50 - hazardDensity * 35);

    const scored = scoreEnvelope(envelope);
    return {
        id: input.id,
        kind: 'map',
        envelope: normalizeEnvelope(envelope),
        numericGrade: scored.numeric,
        efficiencyGrade: scored.efficiency,
        difficultyGrade: scored.difficulty,
        rationale: ['Map density analysis (hazard, blocked, walkable)'],
        metadata: {
            totalTiles: total,
            hazardDensity: round4(hazardDensity),
            blockedDensity: round4(blockedDensity)
        }
    };
};

export const evaluateEncounter = (input: EncounterEvaluationInput, context?: EvaluationContext): GradeResult => {
    const calibration = withCalibration(context);
    const mapGrade = evaluateMap(input.map, context);
    const enemyGrades = input.enemies.map(e => evaluateEntity(e, context));
    const envelope = blankEnvelope();

    const enemyCount = Math.max(1, enemyGrades.length);
    const enemyPower = enemyGrades.reduce((acc, g) => acc + g.envelope.power, 0) / enemyCount;
    const enemyControl = enemyGrades.reduce((acc, g) => acc + g.envelope.control, 0) / enemyCount;
    const enemyPressure = enemyGrades.reduce((acc, g) => acc + g.envelope.objectivePressure, 0) / enemyCount;

    envelope.power = clamp((mapGrade.envelope.power * 0.35) + (enemyPower * 0.65 * calibration.encounter.spawnPressureWeight));
    envelope.control = clamp((mapGrade.envelope.control * 0.4) + (enemyControl * 0.6 * calibration.encounter.spawnPressureWeight));
    envelope.mobility = clamp(mapGrade.envelope.mobility * 0.8);
    envelope.survivability = clamp(enemyGrades.reduce((acc, g) => acc + g.envelope.survivability, 0) / enemyCount);
    envelope.economy = clamp(50 - (input.enemies.length * 2));
    envelope.risk = clamp((mapGrade.envelope.risk * 0.45) + (enemyPower * 0.35 * calibration.encounter.spawnPressureWeight) + (input.enemies.length * 2.5));
    envelope.complexity = clamp((mapGrade.envelope.complexity * 0.4) + (input.enemies.length * 4) + (input.objectives?.length || 0) * 5);
    envelope.objectivePressure = clamp((mapGrade.envelope.objectivePressure * 0.4) + (enemyPressure * 0.6));

    const scored = scoreEnvelope(envelope);
    const difficultyGrade = round4(clamp(scored.difficulty * calibration.policy.offenseWeight));
    const difficultyBand = scored.difficulty < calibration.encounter.lowBandMax
        ? 'low'
        : scored.difficulty < calibration.encounter.mediumBandMax
            ? 'medium'
            : 'high';
    return {
        id: input.id,
        kind: 'encounter',
        envelope: normalizeEnvelope(envelope),
        numericGrade: round4(clamp((scored.efficiency + difficultyGrade) / 2)),
        efficiencyGrade: scored.efficiency,
        difficultyGrade,
        rationale: ['Encounter blend from map + enemy aggregate pressure'],
        metadata: {
            enemyCount: input.enemies.length,
            difficultyBand
        }
    };
};

export const createDefaultEvaluationRegistry = (): EvaluationRegistry => {
    const registry = new EvaluationRegistry();
    registry.register('skill', evaluateSkillProfileWithContext);
    registry.register('tile', evaluateTile);
    registry.register('entity', evaluateEntity);
    registry.register('map', evaluateMap);
    registry.register('encounter', evaluateEncounter);
    return registry;
};
