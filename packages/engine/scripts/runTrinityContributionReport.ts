import { runBatch, summarizeBatch, runHeadToHeadBatch } from '../src/systems/balance-harness';
import type { ArchetypeLoadoutId } from '../src/systems/balance-harness';
import { writeFileSync } from 'node:fs';
import { getActiveTrinityProfileId } from '../src/systems/trinity-profiles';

const originalLog = console.log.bind(console);
if (process.env.VERBOSE_ANALYSIS !== '1') {
    console.log = () => undefined;
    console.warn = () => undefined;
}

const count = Number(process.argv[2] || 60);
const maxTurns = Number(process.argv[3] || 60);
const outFile = process.argv[4] || 'docs/UPA_TRINITY_CONTRIBUTIONS.json';
const trinityProfile = getActiveTrinityProfileId();

const loadouts: ArchetypeLoadoutId[] = ['VANGUARD', 'SKIRMISHER', 'FIREMAGE', 'NECROMANCER', 'HUNTER', 'ASSASSIN'];
const seeds = Array.from({ length: count }, (_, i) => `trinity-report-seed-${i + 1}`);

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
        left: {
            loadoutId: pair.left,
            trinityContribution: leftSummary.trinityContribution,
        },
        right: {
            loadoutId: pair.right,
            trinityContribution: rightSummary.trinityContribution,
        },
    };
});

const artifact = {
    generatedAt: new Date().toISOString(),
    trinityProfile,
    count,
    maxTurns,
    byArchetype,
    byMatchup,
};

writeFileSync(outFile, JSON.stringify(artifact, null, 2));
originalLog(`Wrote ${outFile}`);
