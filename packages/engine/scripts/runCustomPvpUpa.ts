import type { BotPolicy } from '../src/systems/balance-harness';
import { runPvpBatch, summarizePvpBatch } from '../src/systems/pvp-harness';
import { DEFAULT_LOADOUTS, type Loadout } from '../src/systems/loadout';
import { buildUpaEntitySnapshot } from './lib/upaEntitySnapshot';
import { TRINITY_PROFILES, getActiveTrinityProfileId } from '../src/systems/trinity-profiles';

if (!process.env.HOP_TRINITY_PROFILE) {
    process.env.HOP_TRINITY_PROFILE = 'live';
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const computePvpUpa = (winRate: number, drawRate: number, avgRounds: number, maxRounds: number): number => {
    const decisiveRate = clamp01(1 - drawRate);
    const pace = clamp01(1 - (avgRounds / Math.max(1, maxRounds)));
    const value = (0.75 * clamp01(winRate)) + (0.15 * decisiveRate) + (0.10 * pace);
    return Number(clamp01(value).toFixed(4));
};

const parseSkills = (raw: string): string[] =>
    raw.split(',').map(s => s.trim()).filter(Boolean);

const parseTrinity = (raw?: string): { body: number; mind: number; instinct: number } | undefined => {
    if (!raw) return undefined;
    const [b, m, i] = raw.split(',').map(v => Number(v.trim()));
    if (![b, m, i].every(Number.isFinite)) return undefined;
    return { body: b, mind: m, instinct: i };
};

const count = Number(process.argv[2] || 200);
const maxRounds = Number(process.argv[3] || 60);
const leftArchetype = (process.argv[4] || 'VANGUARD').toUpperCase();
const leftSkills = parseSkills(process.argv[5] || 'BASIC_MOVE,BASIC_ATTACK');
const rightArchetype = (process.argv[6] || 'HUNTER').toUpperCase();
const rightSkills = parseSkills(process.argv[7] || 'BASIC_MOVE,BASIC_ATTACK');
const leftPolicy = (process.argv[8] || 'heuristic') as BotPolicy;
const rightPolicy = (process.argv[9] || 'heuristic') as BotPolicy;
const leftTrinityRaw = process.argv[10];
const rightTrinityRaw = process.argv[11];

const leftTrinity = parseTrinity(leftTrinityRaw);
const rightTrinity = parseTrinity(rightTrinityRaw);

if (leftTrinity) TRINITY_PROFILES.live.archetype[leftArchetype] = leftTrinity;
if (rightTrinity) TRINITY_PROFILES.live.archetype[rightArchetype] = rightTrinity;

const leftKey = 'CUSTOM_LEFT';
const rightKey = 'CUSTOM_RIGHT';

const leftLoadout: Loadout = {
    id: leftArchetype,
    name: `${leftArchetype} (Custom Left)`,
    description: 'Custom UPA loadout (left).',
    startingUpgrades: [],
    startingSkills: leftSkills
};

const rightLoadout: Loadout = {
    id: rightArchetype,
    name: `${rightArchetype} (Custom Right)`,
    description: 'Custom UPA loadout (right).',
    startingUpgrades: [],
    startingSkills: rightSkills
};

(DEFAULT_LOADOUTS as any)[leftKey] = leftLoadout;
(DEFAULT_LOADOUTS as any)[rightKey] = rightLoadout;

const seeds = Array.from({ length: count }, (_, i) => `pvp-custom-seed-${i + 1}`);
const runs = runPvpBatch(
    seeds,
    leftKey as any,
    rightKey as any,
    leftPolicy,
    rightPolicy,
    maxRounds
);
const summary = summarizePvpBatch(runs);
const trinityProfile = getActiveTrinityProfileId();

const leftEntitySnapshot = buildUpaEntitySnapshot(leftKey as any);
const rightEntitySnapshot = buildUpaEntitySnapshot(rightKey as any);

const sample = runs.slice(0, 12).map(r => ({
    seed: r.seed,
    winner: r.winner,
    roundsPlayed: r.roundsPlayed,
    leftHp: r.leftHp,
    rightHp: r.rightHp
}));

console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    count,
    maxRounds,
    trinityProfile,
    left: {
        loadoutId: leftKey,
        archetype: leftArchetype,
        skills: leftSkills,
        trinityOverride: leftTrinity || null,
        entitySnapshot: leftEntitySnapshot,
        policy: leftPolicy,
        pvpUpa: computePvpUpa(summary.leftWinRate, summary.drawRate, summary.avgRounds, maxRounds)
    },
    right: {
        loadoutId: rightKey,
        archetype: rightArchetype,
        skills: rightSkills,
        trinityOverride: rightTrinity || null,
        entitySnapshot: rightEntitySnapshot,
        policy: rightPolicy,
        pvpUpa: computePvpUpa(summary.rightWinRate, summary.drawRate, summary.avgRounds, maxRounds)
    },
    summary,
    sample
}, null, 2));
