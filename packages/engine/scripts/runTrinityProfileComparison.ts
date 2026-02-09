import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_LOADOUTS } from '../src/systems/loadout';
import {
    runBatch,
    summarizeBatch,
    runHeadToHeadBatch,
    summarizeMatchup,
    type ArchetypeLoadoutId,
    type BatchSummary,
} from '../src/systems/balance-harness';
import { computeStaticSkillGrades } from '../src/systems/skill-grading';
import { COMPOSITIONAL_SKILLS } from '../src/skillRegistry';
import type { TrinityProfileId } from '../src/systems/trinity-profiles';

const originalLog = console.log.bind(console);
if (process.env.VERBOSE_ANALYSIS !== '1') {
    console.log = () => undefined;
    console.warn = () => undefined;
}

type SkillHealthLabel =
    | 'effective'
    | 'underutilized'
    | 'loop-risk'
    | 'spam-inflated'
    | 'policy-blocked'
    | 'no-data';

interface SkillAggregate {
    casts: number;
    games: number;
    damagePerCastWeighted: number;
    killContributionWeighted: number;
    objectiveDeltaWeighted: number;
    dynamicGradeWeighted: number;
    archetypesObserved: string[];
}

const count = Number(process.argv[2] || 12);
const maxTurns = Number(process.argv[3] || 40);
const outDir = process.argv[4] || 'docs';
const profiles: TrinityProfileId[] = ['neutral', 'live'];
const loadouts = Object.keys(DEFAULT_LOADOUTS) as ArchetypeLoadoutId[];

const writeJson = (file: string, payload: unknown) => {
    const target = resolve(process.cwd(), file);
    writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
    return target;
};

const generateTrinityReport = (profile: TrinityProfileId) => {
    process.env.HOP_TRINITY_PROFILE = profile;
    const seeds = Array.from({ length: count }, (_, i) => `trinity-${profile}-seed-${i + 1}`);

    const byArchetype = loadouts.map(loadoutId => {
        const summary = summarizeBatch(runBatch(seeds, 'heuristic', maxTurns, loadoutId), 'heuristic', loadoutId);
        return {
            loadoutId,
            games: summary.games,
            winRate: summary.winRate,
            timeoutRate: summary.timeoutRate,
            avgFloor: summary.avgFloor,
            trinityContribution: summary.trinityContribution,
        };
    });

    const matchupPairs: Array<{ left: ArchetypeLoadoutId; right: ArchetypeLoadoutId }> = [
        { left: 'VANGUARD', right: 'HUNTER' },
        { left: 'FIREMAGE', right: 'NECROMANCER' },
        { left: 'ASSASSIN', right: 'SKIRMISHER' },
    ];

    const byMatchup = matchupPairs.map(pair => {
        const runs = runHeadToHeadBatch(
            seeds,
            { policy: 'heuristic', loadoutId: pair.left },
            { policy: 'heuristic', loadoutId: pair.right },
            maxTurns
        );
        const leftSummary = summarizeBatch(runs.map(r => r.left), 'heuristic', pair.left);
        const rightSummary = summarizeBatch(runs.map(r => r.right), 'heuristic', pair.right);
        return {
            pair: `${pair.left}_vs_${pair.right}`,
            left: { loadoutId: pair.left, trinityContribution: leftSummary.trinityContribution },
            right: { loadoutId: pair.right, trinityContribution: rightSummary.trinityContribution },
        };
    });

    return {
        generatedAt: new Date().toISOString(),
        profile,
        count,
        maxTurns,
        byArchetype,
        byMatchup,
    };
};

const generateMatrixReport = (profile: TrinityProfileId) => {
    process.env.HOP_TRINITY_PROFILE = profile;
    const cells: any[] = [];
    for (const left of loadouts) {
        for (const right of loadouts) {
            if (left === right) continue;
            const seeds = Array.from({ length: count }, (_, i) => `matrix-${profile}-${left}-vs-${right}-${i + 1}`);
            const runs = runHeadToHeadBatch(
                seeds,
                { policy: 'heuristic', loadoutId: left },
                { policy: 'heuristic', loadoutId: right },
                maxTurns
            );
            const summary = summarizeMatchup(runs);
            cells.push({
                left,
                right,
                games: summary.games,
                leftWinRate: summary.leftWinRate,
                rightWinRate: summary.rightWinRate,
                tieRate: summary.tieRate,
                dominanceDelta: Number(Math.abs(summary.leftWinRate - summary.rightWinRate).toFixed(4)),
            });
        }
    }
    const imbalanceCandidates = [...cells]
        .sort((a, b) => b.dominanceDelta - a.dominanceDelta)
        .slice(0, 3)
        .map(cell => ({
            pairing: `${cell.left} vs ${cell.right}`,
            dominanceDelta: cell.dominanceDelta,
            leftWinRate: cell.leftWinRate,
            rightWinRate: cell.rightWinRate,
        }));

    return {
        generatedAt: new Date().toISOString(),
        profile,
        policy: 'heuristic',
        count,
        maxTurns,
        loadouts,
        matrix: cells,
        imbalanceCandidates,
    };
};

const generateSkillHealthReport = (profile: TrinityProfileId) => {
    process.env.HOP_TRINITY_PROFILE = profile;
    const staticArtifact = computeStaticSkillGrades(COMPOSITIONAL_SKILLS as any, 'p6-static-v1');
    const staticBySkill = staticArtifact.skills;
    const summaries: Array<{ loadoutId: ArchetypeLoadoutId; summary: BatchSummary }> = [];
    const failures: Array<{ loadoutId: ArchetypeLoadoutId; error: string }> = [];

    for (const loadoutId of loadouts) {
        try {
            const seeds = Array.from({ length: count }, (_, i) => `health-${profile}-${loadoutId}-${i + 1}`);
            const summary = summarizeBatch(runBatch(seeds, 'heuristic', maxTurns, loadoutId), 'heuristic', loadoutId);
            summaries.push({ loadoutId, summary });
        } catch (error) {
            failures.push({
                loadoutId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    const aggregate: Record<string, SkillAggregate> = {};
    for (const { loadoutId, summary } of summaries) {
        const grades = summary.dynamicSkillGrades || {};
        for (const [skillId, metric] of Object.entries(grades)) {
            if (!aggregate[skillId]) {
                aggregate[skillId] = {
                    casts: 0,
                    games: 0,
                    damagePerCastWeighted: 0,
                    killContributionWeighted: 0,
                    objectiveDeltaWeighted: 0,
                    dynamicGradeWeighted: 0,
                    archetypesObserved: [],
                };
            }
            const row = aggregate[skillId];
            row.casts += metric.casts;
            row.games += summary.games;
            row.damagePerCastWeighted += metric.damagePerCast * summary.games;
            row.killContributionWeighted += metric.killContribution * summary.games;
            row.objectiveDeltaWeighted += metric.objectiveDelta * summary.games;
            row.dynamicGradeWeighted += metric.numericGrade * summary.games;
            if (!row.archetypesObserved.includes(loadoutId)) row.archetypesObserved.push(loadoutId);
        }
    }

    const loadoutSkills = new Set<string>();
    for (const loadout of Object.values(DEFAULT_LOADOUTS)) {
        for (const skillId of loadout.startingSkills) loadoutSkills.add(skillId);
    }

    const rows = Object.keys(staticBySkill)
        .sort()
        .map(skillId => {
            const staticNumericGrade = staticBySkill[skillId].numericGrade;
            const a = aggregate[skillId];
            const observed = !!a;
            const casts = a?.casts || 0;
            const games = Math.max(1, a?.games || 1);
            const castRate = casts / games;
            const dynamicNumericGrade = observed ? a!.dynamicGradeWeighted / games : 0;
            const damagePerCast = observed ? a!.damagePerCastWeighted / games : 0;
            const killContribution = observed ? a!.killContributionWeighted / games : 0;
            const objectiveDelta = observed ? a!.objectiveDeltaWeighted / games : 0;
            const labels: SkillHealthLabel[] = [];

            if (!observed) labels.push(loadoutSkills.has(skillId) ? 'policy-blocked' : 'no-data');
            if (observed && castRate < 0.05) labels.push('underutilized');
            if (observed && casts > 300 && damagePerCast < 0.08 && killContribution < 0.4) labels.push('loop-risk');
            if (observed && dynamicNumericGrade > 120 && damagePerCast < 0.1) labels.push('spam-inflated');
            if (observed && dynamicNumericGrade > 50 && (damagePerCast > 0.3 || objectiveDelta > 2)) labels.push('effective');
            if (labels.length === 0 && observed) labels.push('underutilized');

            return {
                skillId,
                staticNumericGrade: Number(staticNumericGrade.toFixed(4)),
                dynamicNumericGrade: Number(dynamicNumericGrade.toFixed(4)),
                casts,
                castRate: Number(castRate.toFixed(4)),
                damagePerCast: Number(damagePerCast.toFixed(4)),
                killContribution: Number(killContribution.toFixed(4)),
                objectiveDelta: Number(objectiveDelta.toFixed(4)),
                archetypesObserved: a?.archetypesObserved || [],
                labels,
            };
        });

    const archetypeSummary = summaries.map(({ loadoutId, summary }) => ({
        loadoutId,
        winRate: summary.winRate,
        timeoutRate: summary.timeoutRate,
        avgFloor: summary.avgFloor,
        avgHazardBreaches: summary.avgHazardBreaches,
    }));

    return {
        generatedAt: new Date().toISOString(),
        profile,
        params: { count, maxTurns, policy: 'heuristic' },
        archetypeSummary,
        failures,
        rows,
    };
};

const trinityByProfile: Record<TrinityProfileId, any> = { neutral: null, live: null };
const matrixByProfile: Record<TrinityProfileId, any> = { neutral: null, live: null };
const healthByProfile: Record<TrinityProfileId, any> = { neutral: null, live: null };

for (const profile of profiles) {
    trinityByProfile[profile] = generateTrinityReport(profile);
    matrixByProfile[profile] = generateMatrixReport(profile);
    healthByProfile[profile] = generateSkillHealthReport(profile);
}

const trinityNeutral = Object.fromEntries(
    trinityByProfile.neutral.byArchetype.map((x: any) => [x.loadoutId, x.trinityContribution])
);
const trinityLive = Object.fromEntries(
    trinityByProfile.live.byArchetype.map((x: any) => [x.loadoutId, x.trinityContribution])
);
const healthNeutral = Object.fromEntries(
    healthByProfile.neutral.archetypeSummary.map((x: any) => [x.loadoutId, x])
);
const healthLive = Object.fromEntries(
    healthByProfile.live.archetypeSummary.map((x: any) => [x.loadoutId, x])
);
const matrixNeutral = Object.fromEntries(
    matrixByProfile.neutral.matrix.map((x: any) => [`${x.left}->${x.right}`, x])
);
const matrixLive = Object.fromEntries(
    matrixByProfile.live.matrix.map((x: any) => [`${x.left}->${x.right}`, x])
);

const archetypeDelta = loadouts.map(loadoutId => ({
    loadoutId,
    winRateDelta: Number(((healthLive[loadoutId]?.winRate || 0) - (healthNeutral[loadoutId]?.winRate || 0)).toFixed(4)),
    avgFloorDelta: Number(((healthLive[loadoutId]?.avgFloor || 0) - (healthNeutral[loadoutId]?.avgFloor || 0)).toFixed(4)),
    avgHazardBreachesDelta: Number(((healthLive[loadoutId]?.avgHazardBreaches || 0) - (healthNeutral[loadoutId]?.avgHazardBreaches || 0)).toFixed(4)),
    bodyContributionDelta: Number(((trinityLive[loadoutId]?.bodyContribution || 0) - (trinityNeutral[loadoutId]?.bodyContribution || 0)).toFixed(4)),
    mindContributionDelta: Number(((trinityLive[loadoutId]?.mindContribution || 0) - (trinityNeutral[loadoutId]?.mindContribution || 0)).toFixed(4)),
    instinctContributionDelta: Number(((trinityLive[loadoutId]?.instinctContribution || 0) - (trinityNeutral[loadoutId]?.instinctContribution || 0)).toFixed(4)),
}));

const matrixDelta = Object.keys(matrixNeutral).map(key => {
    const n = matrixNeutral[key];
    const l = matrixLive[key];
    return {
        pairing: key,
        leftWinRateDelta: Number(((l?.leftWinRate || 0) - (n?.leftWinRate || 0)).toFixed(4)),
        dominanceDeltaShift: Number(((l?.dominanceDelta || 0) - (n?.dominanceDelta || 0)).toFixed(4)),
    };
});

const comparePayload = {
    generatedAt: new Date().toISOString(),
    count,
    maxTurns,
    profiles,
    archetypeDelta,
    topMatrixShifts: [...matrixDelta]
        .sort((a, b) => Math.abs(b.dominanceDeltaShift) - Math.abs(a.dominanceDeltaShift))
        .slice(0, 8),
};

const files = {
    trinityNeutral: `${outDir}/UPA_TRINITY_CONTRIBUTIONS_NEUTRAL.json`,
    trinityLive: `${outDir}/UPA_TRINITY_CONTRIBUTIONS_LIVE.json`,
    matrixNeutral: `${outDir}/UPA_PVP_MATCHUP_MATRIX_NEUTRAL.json`,
    matrixLive: `${outDir}/UPA_PVP_MATCHUP_MATRIX_LIVE.json`,
    healthNeutral: `${outDir}/UPA_SKILL_HEALTH_NEUTRAL.json`,
    healthLive: `${outDir}/UPA_SKILL_HEALTH_LIVE.json`,
    compare: `${outDir}/UPA_TRINITY_PROFILE_COMPARE.json`,
};

const wrote = {
    trinityNeutral: writeJson(files.trinityNeutral, trinityByProfile.neutral),
    trinityLive: writeJson(files.trinityLive, trinityByProfile.live),
    matrixNeutral: writeJson(files.matrixNeutral, matrixByProfile.neutral),
    matrixLive: writeJson(files.matrixLive, matrixByProfile.live),
    healthNeutral: writeJson(files.healthNeutral, healthByProfile.neutral),
    healthLive: writeJson(files.healthLive, healthByProfile.live),
    compare: writeJson(files.compare, comparePayload),
};

originalLog(JSON.stringify({ wrote, count, maxTurns }, null, 2));

