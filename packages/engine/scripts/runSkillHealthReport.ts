import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_LOADOUTS } from '../src/systems/loadout';
import { runBatch, summarizeBatch, type ArchetypeLoadoutId, type BatchSummary } from '../src/systems/balance-harness';
import { computeStaticSkillGrades } from '../src/systems/skill-grading';
import { COMPOSITIONAL_SKILLS } from '../src/skillRegistry';

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

const dateStamp = new Date().toISOString().slice(0, 10);
const count = Number(process.argv[2] || 80);
const maxTurns = Number(process.argv[3] || 60);
const outFile = process.argv[4] || `docs/UPA_SKILL_HEALTH_${dateStamp}.json`;
const maxLoopRisk = Number(process.argv[5] || -1);
const maxFailures = Number(process.argv[6] || -1);
const maxPlayerFacingNoData = Number(process.argv[7] || -1);
const loadouts = Object.keys(DEFAULT_LOADOUTS) as ArchetypeLoadoutId[];

const staticArtifact = computeStaticSkillGrades(COMPOSITIONAL_SKILLS as any, 'p6-static-v1');
const staticBySkill = staticArtifact.skills;

const summaries: Array<{ loadoutId: ArchetypeLoadoutId; summary: BatchSummary }> = [];
const failures: Array<{ loadoutId: ArchetypeLoadoutId; error: string }> = [];

for (const loadoutId of loadouts) {
    try {
        const seeds = Array.from({ length: count }, (_, i) => `health-${loadoutId}-${i + 1}`);
        const summary = summarizeBatch(runBatch(seeds, 'heuristic', maxTurns, loadoutId), 'heuristic', loadoutId);
        summaries.push({ loadoutId, summary });
    } catch (error) {
        failures.push({
            loadoutId,
            error: error instanceof Error ? error.message : String(error)
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
                archetypesObserved: []
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
            labels
        };
    });

const archetypeSummary = summaries.map(({ loadoutId, summary }) => ({
    loadoutId,
    winRate: summary.winRate,
    timeoutRate: summary.timeoutRate,
    avgFloor: summary.avgFloor,
    avgHazardBreaches: summary.avgHazardBreaches
}));

const payload = {
    generatedAt: new Date().toISOString(),
    params: { count, maxTurns, policy: 'heuristic', maxLoopRisk, maxFailures, maxPlayerFacingNoData },
    archetypeSummary,
    failures,
    rows
};

const target = resolve(process.cwd(), outFile);
writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
const loopRiskCount = rows.filter(r => r.labels.includes('loop-risk')).length;
const playerFacingNoDataCount = rows.filter(r => r.labels.includes('policy-blocked') && loadoutSkills.has(r.skillId)).length;
originalLog(JSON.stringify({ wrote: target, rows: rows.length, failures: failures.length, loopRiskCount, playerFacingNoDataCount }, null, 2));

if (
    (maxFailures >= 0 && failures.length > maxFailures)
    || (maxLoopRisk >= 0 && loopRiskCount > maxLoopRisk)
    || (maxPlayerFacingNoData >= 0 && playerFacingNoDataCount > maxPlayerFacingNoData)
) {
    process.exitCode = 2;
}
