import { runBatch, summarizeBatch, type ArchetypeLoadoutId } from '../src/systems/balance-harness';

const originalLog = console.log.bind(console);
if (process.env.VERBOSE_ANALYSIS !== '1') {
    console.log = () => undefined;
    console.warn = () => undefined;
}

const count = Number(process.argv[2] || 120);
const maxTurns = Number(process.argv[3] || 60);
const loadoutId = (process.argv[4] || 'VANGUARD') as ArchetypeLoadoutId;
const profileA = process.argv[5] || 'sp-v1-default';
const profileB = process.argv[6] || 'sp-v1-aggro';

const seeds = Array.from({ length: count }, (_, i) => `policy-compare-${i + 1}`);

const aSummary = summarizeBatch(runBatch(seeds, 'heuristic', maxTurns, loadoutId, profileA), 'heuristic', loadoutId);
const bSummary = summarizeBatch(runBatch(seeds, 'heuristic', maxTurns, loadoutId, profileB), 'heuristic', loadoutId);

const round4 = (n: number) => Number(n.toFixed(4));
const delta = {
    winRate: round4(bSummary.winRate - aSummary.winRate),
    avgFloor: round4(bSummary.avgFloor - aSummary.avgFloor),
    avgHazardBreaches: round4(bSummary.avgHazardBreaches - aSummary.avgHazardBreaches),
    timeoutRate: round4(bSummary.timeoutRate - aSummary.timeoutRate),
    avgPlayerSkillCastsPerRun: round4(bSummary.avgPlayerSkillCastsPerRun - aSummary.avgPlayerSkillCastsPerRun)
};

originalLog(JSON.stringify({
    generatedAt: new Date().toISOString(),
    count,
    maxTurns,
    loadoutId,
    baseline: aSummary,
    candidate: bSummary,
    delta
}, null, 2));

