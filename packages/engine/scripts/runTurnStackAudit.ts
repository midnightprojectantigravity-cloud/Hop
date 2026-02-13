import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gameReducer, generateInitialState } from '../src/logic';
import { isPlayerTurn } from '../src/systems/initiative';
import { createRng } from '../src/systems/rng';
import { DEFAULT_LOADOUTS } from '../src/systems/loadout';
import { SkillRegistry } from '../src/skillRegistry';
import { getNeighbors, hexEquals } from '../src/hex';
import { UnifiedTileService } from '../src/systems/unified-tile-service';
import type { Action, GameState, Point, TimelineEvent } from '../src/types';

type LoadoutId = keyof typeof DEFAULT_LOADOUTS;

type ViolationType =
    | 'phase_order'
    | 'missing_step_id'
    | 'pending_advance'
    | 'pending_stall'
    | 'lock_duration'
    | 'turn_stack_warning';

type Violation = {
    loadoutId: LoadoutId;
    seed: string;
    reducerStep: number;
    turnNumber: number;
    type: ViolationType;
    detail: string;
};

type RunDiagnostics = {
    loadoutId: LoadoutId;
    seed: string;
    gameStatus: GameState['gameStatus'];
    turnsSpent: number;
    reducerSteps: number;
    actorSteps: number;
    avgBlockingMsPerStep: number;
    maxBlockingMsPerStep: number;
    turnStackWarnings: number;
    violations: number;
};

const runsPerArchetype = Number(process.argv[2] || 8);
const maxTurns = Number(process.argv[3] || 80);
const outFile = process.argv[4] || 'artifacts/upa/UPA_TURN_STACK_AUDIT.json';
const maxBlockingMsPerStep = Number(process.argv[5] || 4000);
const strict = (process.argv[6] || '0') === '1';
const includeArg = (process.argv[7] || '').trim();
const maxReducerSteps = Number(process.argv[8] || 6000);

const requestedLoadouts = includeArg.length > 0
    ? includeArg.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) as LoadoutId[]
    : (Object.keys(DEFAULT_LOADOUTS) as LoadoutId[]);

const loadoutIds = requestedLoadouts.filter(id => Boolean(DEFAULT_LOADOUTS[id]));

if (loadoutIds.length === 0) {
    throw new Error('No valid loadouts selected for turn stack audit.');
}

const isVerbose = process.env.VERBOSE_ANALYSIS === '1';
const originalLog = console.log.bind(console);
const originalWarn = console.warn.bind(console);
const warningBuffer: string[] = [];
console.log = (...args: unknown[]) => {
    if (isVerbose) originalLog(...args);
};
console.warn = (...args: unknown[]) => {
    const text = args.map(v => String(v)).join(' ');
    if (text.includes('[TURN_STACK]')) {
        warningBuffer.push(text);
    }
    if (isVerbose) originalWarn(...args);
};

const hasPendingIntercept = (state: GameState): boolean =>
    Boolean(state.pendingStatus) || (state.pendingFrames?.length ?? 0) > 0;

const queueFingerprint = (state: GameState): string => {
    const queue = state.initiativeQueue;
    if (!queue) return 'none';
    const entries = queue.entries.map(e => `${e.actorId}:${e.initiative}:${e.lastActedTurn}`);
    return `${queue.round}|${queue.currentIndex}|${entries.join(',')}`;
};

const isOccupiedByEnemy = (state: GameState, p: Point): boolean =>
    state.enemies.some(e => e.hp > 0 && e.factionId === 'enemy' && hexEquals(e.position, p));

const legalMoveTargets = (state: GameState): Point[] => {
    const origin = state.player.position;
    const moveDef = SkillRegistry.get('BASIC_MOVE');
    if (moveDef?.getValidTargets) {
        return moveDef.getValidTargets(state, origin);
    }
    return getNeighbors(origin)
        .filter(p => UnifiedTileService.isWalkable(state, p))
        .filter(p => !isOccupiedByEnemy(state, p));
};

const collectCandidatePlayerActions = (
    state: GameState,
    rng: ReturnType<typeof createRng>
): Action[] => {
    const actions: Action[] = [{ type: 'WAIT' }];

    const moveTargets = legalMoveTargets(state);
    const movePicks = Math.min(4, moveTargets.length);
    for (let i = 0; i < movePicks; i++) {
        const idx = Math.floor(rng.next() * moveTargets.length);
        const target = moveTargets[idx];
        if (target) {
            actions.push({ type: 'MOVE', payload: target });
        }
    }

    for (const skill of state.player.activeSkills || []) {
        if ((skill.currentCooldown || 0) > 0) continue;
        if (skill.id === 'AUTO_ATTACK') continue;

        const def = SkillRegistry.get(skill.id as any);
        if (!def?.getValidTargets) continue;

        const targets = def.getValidTargets(state, state.player.position);
        if (!targets.length) continue;

        const idx = Math.floor(rng.next() * targets.length);
        const target = targets[idx];
        if (target) {
            actions.push({ type: 'USE_SKILL', payload: { skillId: skill.id, target } });
        }
    }

    return actions;
};

const chooseAction = (
    state: GameState,
    rng: ReturnType<typeof createRng>
): Action => {
    if (state.gameStatus === 'choosing_upgrade') {
        const pick = state.shrineOptions?.[0] || 'EXTRA_HP';
        return { type: 'SELECT_UPGRADE', payload: pick };
    }
    if (hasPendingIntercept(state)) {
        return { type: 'RESOLVE_PENDING' };
    }
    if (!isPlayerTurn(state)) {
        return { type: 'ADVANCE_TURN' };
    }

    const candidates = collectCandidatePlayerActions(state, rng);
    const idx = Math.floor(rng.next() * candidates.length);
    return candidates[idx] || { type: 'WAIT' };
};

const groupByActorStep = (events: TimelineEvent[]): Map<string, TimelineEvent[]> => {
    const grouped = new Map<string, TimelineEvent[]>();
    for (const event of events) {
        const key = event.stepId || event.groupId || `${event.turn}:${event.actorId || 'system'}:${event.phase}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(event);
    }
    return grouped;
};

const indexOfPhase = (events: TimelineEvent[], phase: string): number =>
    events.findIndex(ev => ev.phase === phase);

const analyzeEvents = (
    events: TimelineEvent[],
    runMeta: { loadoutId: LoadoutId; seed: string; reducerStep: number; turnNumber: number },
    violations: Violation[]
): { actorSteps: number; blockingMs: number[] } => {
    if (!events.length) return { actorSteps: 0, blockingMs: [] };

    const grouped = groupByActorStep(events);
    let actorSteps = 0;
    const blockingMs: number[] = [];

    for (const [stepKey, stepEvents] of grouped.entries()) {
        if (stepEvents.some(ev => ev.actorId && !ev.stepId)) {
            violations.push({
                ...runMeta,
                type: 'missing_step_id',
                detail: `Actor timeline event emitted without stepId (step=${stepKey})`
            });
        }

        const moveStart = indexOfPhase(stepEvents, 'MOVE_START');
        const moveEnd = indexOfPhase(stepEvents, 'MOVE_END');
        const intentStart = indexOfPhase(stepEvents, 'INTENT_START');
        const intentEnd = indexOfPhase(stepEvents, 'INTENT_END');

        if (moveStart >= 0 && moveEnd >= 0 && moveEnd < moveStart) {
            violations.push({
                ...runMeta,
                type: 'phase_order',
                detail: `MOVE_END before MOVE_START in step ${stepKey}`
            });
        }

        if (moveStart >= 0 && moveEnd < 0) {
            violations.push({
                ...runMeta,
                type: 'phase_order',
                detail: `MOVE_START without MOVE_END in step ${stepKey}`
            });
        }

        if (intentStart >= 0 && intentEnd >= 0 && intentEnd < intentStart) {
            violations.push({
                ...runMeta,
                type: 'phase_order',
                detail: `INTENT_END before INTENT_START in step ${stepKey}`
            });
        }

        const stepBlockingMs = stepEvents
            .filter(ev => ev.blocking)
            .reduce((sum, ev) => sum + (ev.suggestedDurationMs || 0), 0);

        if (stepBlockingMs > 0) {
            blockingMs.push(stepBlockingMs);
        }

        if (stepBlockingMs > maxBlockingMsPerStep) {
            violations.push({
                ...runMeta,
                type: 'lock_duration',
                detail: `Blocking duration ${stepBlockingMs}ms exceeded budget ${maxBlockingMsPerStep}ms in step ${stepKey}`
            });
        }

        actorSteps += 1;
    }

    return { actorSteps, blockingMs };
};

const runSingle = (loadoutId: LoadoutId, runIndex: number): { diagnostics: RunDiagnostics; violations: Violation[] } => {
    const seed = `turn-stack-${loadoutId.toLowerCase()}-${runIndex + 1}`;
    const rng = createRng(`${seed}:audit`);
    let state = generateInitialState(1, seed, seed, undefined, DEFAULT_LOADOUTS[loadoutId]);
    let reducerSteps = 0;
    let actorSteps = 0;
    let turnStackWarnings = 0;
    const blockingSamples: number[] = [];
    const violations: Violation[] = [];

    while (
        reducerSteps < maxReducerSteps &&
        state.turnsSpent < maxTurns &&
        (state.gameStatus === 'playing' || state.gameStatus === 'choosing_upgrade')
    ) {
        reducerSteps += 1;
        const before = state;
        const action = chooseAction(before, rng);
        const beforeWarningCount = warningBuffer.length;
        const beforeQueue = queueFingerprint(before);
        const beforeTurn = before.turnNumber;
        const beforePending = hasPendingIntercept(before);
        const beforePendingDepth = (before.pendingFrames?.length ?? 0) + (before.pendingStatus ? 1 : 0);

        state = gameReducer(before, action);

        const stepWarnings = warningBuffer.length - beforeWarningCount;
        if (stepWarnings > 0) {
            turnStackWarnings += stepWarnings;
            const recentWarnings = warningBuffer.slice(beforeWarningCount);
            recentWarnings.forEach((w, idx) => {
                violations.push({
                    loadoutId,
                    seed,
                    reducerStep: reducerSteps,
                    turnNumber: state.turnNumber,
                    type: 'turn_stack_warning',
                    detail: `Warning[${idx + 1}/${recentWarnings.length}] ${w}`
                });
            });
        }

        if (beforePending && action.type === 'ADVANCE_TURN') {
            const afterQueue = queueFingerprint(state);
            if (afterQueue !== beforeQueue || state.turnNumber !== beforeTurn) {
                violations.push({
                    loadoutId,
                    seed,
                    reducerStep: reducerSteps,
                    turnNumber: state.turnNumber,
                    type: 'pending_advance',
                    detail: 'ADVANCE_TURN progressed queue while pending intercept was active.'
                });
            }
        }

        if (action.type === 'RESOLVE_PENDING' && beforePending) {
            const afterPendingDepth = (state.pendingFrames?.length ?? 0) + (state.pendingStatus ? 1 : 0);
            if (afterPendingDepth >= beforePendingDepth) {
                violations.push({
                    loadoutId,
                    seed,
                    reducerStep: reducerSteps,
                    turnNumber: state.turnNumber,
                    type: 'pending_stall',
                    detail: `RESOLVE_PENDING did not drain intercept stack (before=${beforePendingDepth}, after=${afterPendingDepth}).`
                });
            }
        }

        const analyzed = analyzeEvents(
            state.timelineEvents || [],
            { loadoutId, seed, reducerStep: reducerSteps, turnNumber: state.turnNumber },
            violations
        );
        actorSteps += analyzed.actorSteps;
        blockingSamples.push(...analyzed.blockingMs);
    }

    const avgBlocking = blockingSamples.length
        ? blockingSamples.reduce((a, b) => a + b, 0) / blockingSamples.length
        : 0;

    return {
        diagnostics: {
            loadoutId,
            seed,
            gameStatus: state.gameStatus,
            turnsSpent: state.turnsSpent || 0,
            reducerSteps,
            actorSteps,
            avgBlockingMsPerStep: Number(avgBlocking.toFixed(2)),
            maxBlockingMsPerStep: blockingSamples.length ? Math.max(...blockingSamples) : 0,
            turnStackWarnings,
            violations: violations.length
        },
        violations
    };
};

const runs: RunDiagnostics[] = [];
const allViolations: Violation[] = [];

for (const loadoutId of loadoutIds) {
    for (let i = 0; i < runsPerArchetype; i++) {
        const { diagnostics, violations } = runSingle(loadoutId, i);
        runs.push(diagnostics);
        allViolations.push(...violations);
    }
}

const byType = allViolations.reduce<Record<string, number>>((acc, violation) => {
    acc[violation.type] = (acc[violation.type] || 0) + 1;
    return acc;
}, {});

const byLoadout = runs.reduce<Record<string, {
    runs: number;
    avgTurns: number;
    avgActorSteps: number;
    avgBlockingMsPerStep: number;
    maxBlockingMsPerStep: number;
    warnings: number;
    violations: number;
}>>((acc, run) => {
    if (!acc[run.loadoutId]) {
        acc[run.loadoutId] = {
            runs: 0,
            avgTurns: 0,
            avgActorSteps: 0,
            avgBlockingMsPerStep: 0,
            maxBlockingMsPerStep: 0,
            warnings: 0,
            violations: 0
        };
    }
    const bucket = acc[run.loadoutId];
    bucket.runs += 1;
    bucket.avgTurns += run.turnsSpent;
    bucket.avgActorSteps += run.actorSteps;
    bucket.avgBlockingMsPerStep += run.avgBlockingMsPerStep;
    bucket.maxBlockingMsPerStep = Math.max(bucket.maxBlockingMsPerStep, run.maxBlockingMsPerStep);
    bucket.warnings += run.turnStackWarnings;
    bucket.violations += run.violations;
    return acc;
}, {});

for (const entry of Object.values(byLoadout)) {
    entry.avgTurns = Number((entry.avgTurns / Math.max(1, entry.runs)).toFixed(2));
    entry.avgActorSteps = Number((entry.avgActorSteps / Math.max(1, entry.runs)).toFixed(2));
    entry.avgBlockingMsPerStep = Number((entry.avgBlockingMsPerStep / Math.max(1, entry.runs)).toFixed(2));
}

const summary = {
    generatedAt: new Date().toISOString(),
    params: {
        runsPerArchetype,
        maxTurns,
        maxBlockingMsPerStep,
        maxReducerSteps,
        loadoutIds,
        strict
    },
    totals: {
        totalRuns: runs.length,
        totalViolations: allViolations.length,
        totalWarnings: runs.reduce((acc, run) => acc + run.turnStackWarnings, 0),
        totalActorSteps: runs.reduce((acc, run) => acc + run.actorSteps, 0),
        avgBlockingMsPerStep: runs.length
            ? Number((runs.reduce((acc, run) => acc + run.avgBlockingMsPerStep, 0) / runs.length).toFixed(2))
            : 0
    },
    byType,
    byLoadout
};

const target = resolve(process.cwd(), outFile);
writeFileSync(target, JSON.stringify({ summary, runs, violations: allViolations }, null, 2), 'utf8');
originalLog(JSON.stringify({ wrote: target, summary }, null, 2));

if (strict && allViolations.length > 0) {
    process.exitCode = 2;
}
