import type { SkillDefinition, SkillIntentProfile } from '../types';
import type { SkillID } from '../types/registry';

export interface SkillTelemetrySummary {
    casts: number;
    enemyDamage: number;
    killShots: number;
    healingReceived: number;
    hazardDamage: number;
    stairsProgress: number;
    shrineProgress: number;
    floorProgress: number;
}

export type SkillTelemetryTotals = Record<string, SkillTelemetrySummary>;

export interface DynamicGradeSummaryInput {
    games: number;
    winRate: number;
    skillTelemetryTotals: SkillTelemetryTotals;
}

export interface SkillNumericGradeBreakdown {
    skillId: SkillID;
    numericGrade: number;
    power: number;
    reach: number;
    safety: number;
    tempo: number;
    complexity: number;
}

const round4 = (v: number): number => Number(v.toFixed(4));

const shapeMultiplier = (pattern: SkillIntentProfile['target']['pattern']): number => {
    switch (pattern) {
        case 'self': return 0.8;
        case 'single': return 1.0;
        case 'line': return 1.15;
        case 'radius': return 1.35;
        case 'global': return 1.6;
        default: return 1.0;
    }
};

export const computeSkillNumericGrade = (
    profile: SkillIntentProfile
): Omit<SkillNumericGradeBreakdown, 'skillId'> => {
    const damage = Math.max(0, profile.estimates.damage || 0);
    const movement = Math.max(0, profile.estimates.movement || 0);
    const healing = Math.max(0, profile.estimates.healing || 0);
    const shielding = Math.max(0, profile.estimates.shielding || 0);
    const control = Math.max(0, profile.estimates.control || 0);
    const summon = Math.max(0, profile.estimates.summon || 0);

    const power = (damage * 2.2) + (control * 1.7) + (summon * 2.6);
    const aoeFactor = 1 + (Math.max(0, profile.target.aoeRadius || 0) * 0.45);
    const reach = (1 + Math.max(0, profile.target.range)) * shapeMultiplier(profile.target.pattern) * aoeFactor;
    const safety = (healing * 1.8) + (shielding * 1.6) + (movement * 0.9)
        + (Math.max(0, profile.risk.hazardAffinity || 0) * 2.2)
        - (Math.max(0, profile.risk.selfExposure || 0) * 1.2);
    const tempo = (1 / (1 + Math.max(0, profile.economy.cooldown)))
        + Math.max(0, 1 - (profile.economy.cost * 0.08))
        + (profile.economy.consumesTurn === false ? 0.8 : 0);
    const complexity = Math.max(0, profile.complexity);

    const numericGrade = (power * reach) + (safety * 5) + (tempo * 10) + (complexity * 0.25);

    return {
        numericGrade: round4(numericGrade),
        power: round4(power),
        reach: round4(reach),
        safety: round4(safety),
        tempo: round4(tempo),
        complexity: round4(complexity)
    };
};

export interface StaticSkillGradeArtifact {
    generatedAt: string;
    gradeModelVersion: string;
    skills: Record<string, SkillNumericGradeBreakdown>;
}

export const computeStaticSkillGrades = (
    registry: Record<string, SkillDefinition>,
    gradeModelVersion: string
): StaticSkillGradeArtifact => {
    const skills: Record<string, SkillNumericGradeBreakdown> = {};
    for (const def of Object.values(registry)) {
        if (!def.intentProfile) continue;
        const grade = computeSkillNumericGrade(def.intentProfile);
        skills[def.id] = {
            skillId: def.id,
            ...grade
        };
    }
    return {
        generatedAt: new Date().toISOString(),
        gradeModelVersion,
        skills
    };
};

export interface DynamicSkillMetric {
    casts: number;
    castRate: number;
    damagePerCast: number;
    killContribution: number;
    survivalDelta: number;
    objectiveDelta: number;
    winImpact: number;
    numericGrade: number;
}

export const computeDynamicSkillGrades = (
    summary: DynamicGradeSummaryInput
): Record<string, DynamicSkillMetric> => {
    const games = Math.max(1, summary.games || 1);
    const telemetry = summary.skillTelemetryTotals || {};
    const grades: Record<string, DynamicSkillMetric> = {};

    for (const [skillId, stats] of Object.entries(telemetry)) {
        const casts = Math.max(0, stats.casts || 0);
        if (casts === 0) continue;
        const castRate = casts / games;
        const damagePerCast = (stats.enemyDamage || 0) / casts;
        const killContribution = (stats.killShots || 0) / games;
        const survivalDelta = ((stats.healingReceived || 0) - (stats.hazardDamage || 0)) / games;
        const objectiveDelta = ((stats.stairsProgress || 0) + (stats.shrineProgress || 0) + ((stats.floorProgress || 0) * 4)) / games;
        const winImpact = summary.winRate * Math.log1p(castRate);
        const numericGrade = (damagePerCast * 3.2)
            + (killContribution * 26)
            + (Math.max(0, survivalDelta) * 2.4)
            + (objectiveDelta * 5.5)
            + (winImpact * 45)
            + (castRate * 1.5);

        grades[skillId] = {
            casts,
            castRate: round4(castRate),
            damagePerCast: round4(damagePerCast),
            killContribution: round4(killContribution),
            survivalDelta: round4(survivalDelta),
            objectiveDelta: round4(objectiveDelta),
            winImpact: round4(winImpact),
            numericGrade: round4(numericGrade)
        };
    }

    return grades;
};

export interface SkillGradeDrift {
    skillId: string;
    staticNumericGrade: number;
    dynamicNumericGrade: number;
    drift: number;
}

export const computeSkillGradeDrift = (
    staticArtifact: StaticSkillGradeArtifact,
    dynamicMetrics: Record<string, DynamicSkillMetric>
): SkillGradeDrift[] => {
    const rows: SkillGradeDrift[] = [];
    for (const [skillId, staticGrade] of Object.entries(staticArtifact.skills)) {
        const dynamic = dynamicMetrics[skillId];
        if (!dynamic) continue;
        rows.push({
            skillId,
            staticNumericGrade: staticGrade.numericGrade,
            dynamicNumericGrade: dynamic.numericGrade,
            drift: round4(dynamic.numericGrade - staticGrade.numericGrade)
        });
    }
    return rows.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));
};

export const mergeSkillTelemetryTotals = (
    left: SkillTelemetryTotals,
    right: SkillTelemetryTotals
): SkillTelemetryTotals => {
    const merged: SkillTelemetryTotals = { ...left };
    for (const [skillId, stats] of Object.entries(right)) {
        if (!merged[skillId]) {
            merged[skillId] = { ...stats };
            continue;
        }
        const dst = merged[skillId];
        dst.casts += stats.casts;
        dst.enemyDamage += stats.enemyDamage;
        dst.killShots += stats.killShots;
        dst.healingReceived += stats.healingReceived;
        dst.hazardDamage += stats.hazardDamage;
        dst.stairsProgress += stats.stairsProgress;
        dst.shrineProgress += stats.shrineProgress;
        dst.floorProgress += stats.floorProgress;
    }
    return merged;
};
