import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateInitialState, gameReducer } from '../src/logic';
import { isPlayerTurn } from '../src/systems/initiative';
import { createRng } from '../src/systems/rng';
import { getNeighbors } from '../src/hex';
import { UnifiedTileService } from '../src/systems/unified-tile-service';
import { applyEffects } from '../src/systems/effect-engine';
import { createEnemy } from '../src/systems/entity-factory';
import type { Action, GameState, Point, TimelineEvent } from '../src/types';

const originalLog = console.log.bind(console);
if (process.env.VERBOSE_ANALYSIS !== '1') {
    console.log = () => undefined;
    console.warn = () => undefined;
}

type Violation = {
    seed: string;
    turn: number;
    actorId?: string;
    groupId?: string;
    type:
    | 'phase_order'
    | 'missing_move_end'
    | 'damage_before_move_end'
    | 'hazard_before_move_end'
    | 'blocking_budget_exceeded';
    detail: string;
};

const phaseOrder: Record<string, number> = {
    INTENT_START: 0,
    MOVE_START: 1,
    MOVE_END: 2,
    ON_PASS: 3,
    ON_ENTER: 4,
    HAZARD_CHECK: 5,
    STATUS_APPLY: 6,
    DAMAGE_APPLY: 7,
    DEATH_RESOLVE: 8,
    INTENT_END: 9,
};

const count = Number(process.argv[2] || 20);
const maxTurns = Number(process.argv[3] || 80);
const outFile = process.argv[4] || 'docs/UPA_TIMELINE_AUDIT.json';
const blockingBudgetMs = Number(process.argv[5] || 1500);
const strict = (process.argv[6] || '0') === '1';

const target = resolve(process.cwd(), outFile);

const isOccupiedByEnemy = (state: GameState, p: Point): boolean =>
    state.enemies.some(e => e.hp > 0 && e.position.q === p.q && e.position.r === p.r && e.position.s === p.s);

const choosePlayerAction = (state: GameState, rng: ReturnType<typeof createRng>): Action => {
    const roll = rng.next();
    if (roll < 0.45) return { type: 'WAIT' };

    const origin = state.player.position;
    const candidates = getNeighbors(origin).filter(p =>
        UnifiedTileService.isWalkable(state, p) && !isOccupiedByEnemy(state, p)
    );
    if (candidates.length === 0) return { type: 'WAIT' };
    const idx = Math.floor(rng.next() * candidates.length);
    return { type: 'MOVE', payload: candidates[idx]! };
};

const ensureStimulusEnemy = (state: GameState, runIndex: number): GameState => {
    if (state.enemies.length > 0) return state;
    const p = state.player.position;
    const enemyPos = { q: p.q, r: p.r - 1, s: p.s + 1 };
    const enemy = createEnemy({
        id: `timeline-stimulus-${runIndex}`,
        subtype: 'footman',
        position: enemyPos,
        hp: 3,
        maxHp: 3,
        speed: 1,
        skills: ['BASIC_MOVE', 'BASIC_ATTACK', 'AUTO_ATTACK']
    });
    return { ...state, enemies: [enemy] };
};

const applyStimulusSequence = (state: GameState): GameState => {
    if (state.enemies.length === 0) return state;
    const enemy = state.enemies[0]!;
    const destination = { q: enemy.position.q + 1, r: enemy.position.r, s: enemy.position.s - 1 };
    return applyEffects(state, [
        {
            type: 'Displacement',
            target: enemy.id,
            destination,
        },
        {
            type: 'Damage',
            target: enemy.id,
            amount: 1,
            reason: 'lava_sink',
            source: state.player.position,
        }
    ], { sourceId: state.player.id, targetId: enemy.id });
};

const groupEvents = (events: TimelineEvent[]): Map<string, TimelineEvent[]> => {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of events) {
        const key = ev.groupId || `${ev.turn}:${ev.actorId || 'system'}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ev);
    }
    return map;
};

const auditGroups = (seed: string, events: TimelineEvent[], budgetMs: number): Violation[] => {
    const violations: Violation[] = [];
    const groups = groupEvents(events);

    for (const [groupId, list] of groups.entries()) {
        const idx = (phase: string) => list.findIndex(e => e.phase === phase);
        const moveStart = idx('MOVE_START');
        const moveEnd = idx('MOVE_END');
        const hazard = idx('HAZARD_CHECK');
        const damage = idx('DAMAGE_APPLY');

        if (moveStart >= 0 && moveEnd < 0) {
            violations.push({
                seed,
                turn: list[0]?.turn || 0,
                actorId: list[0]?.actorId,
                groupId,
                type: 'missing_move_end',
                detail: 'MOVE_START without MOVE_END',
            });
        }

        if (moveEnd >= 0 && hazard >= 0 && hazard < moveEnd) {
            violations.push({
                seed,
                turn: list[0]?.turn || 0,
                actorId: list[0]?.actorId,
                groupId,
                type: 'hazard_before_move_end',
                detail: 'HAZARD_CHECK emitted before MOVE_END',
            });
        }

        if (moveEnd >= 0 && damage >= 0 && damage < moveEnd) {
            violations.push({
                seed,
                turn: list[0]?.turn || 0,
                actorId: list[0]?.actorId,
                groupId,
                type: 'damage_before_move_end',
                detail: 'DAMAGE_APPLY emitted before MOVE_END',
            });
        }

        const blockingTotal = list
            .filter(e => e.blocking)
            .reduce((sum, e) => sum + (e.suggestedDurationMs || 0), 0);
        if (blockingTotal > budgetMs) {
            violations.push({
                seed,
                turn: list[0]?.turn || 0,
                actorId: list[0]?.actorId,
                groupId,
                type: 'blocking_budget_exceeded',
                detail: `${blockingTotal}ms > ${budgetMs}ms`,
            });
        }
    }

    return violations;
};

const runs: Array<{
    seed: string;
    turnsSpent: number;
    timelineEvents: number;
    groups: number;
    playerGroups: number;
    avgPlayerBlockingMs: number;
    maxPlayerBlockingMs: number;
    violations: number;
}> = [];
const allViolations: Violation[] = [];

for (let i = 0; i < count; i++) {
    const seed = `timeline-audit-${i + 1}`;
    const rng = createRng(`${seed}:audit`);
    let state = generateInitialState(1, seed, seed);
    state = ensureStimulusEnemy(state, i);
    let guard = 0;

    while (guard < 2000 && state.turnsSpent < maxTurns && state.gameStatus === 'playing') {
        guard++;

        if (state.gameStatus === 'choosing_upgrade') {
            const pick = state.shrineOptions?.[0] || 'EXTRA_HP';
            state = gameReducer(state, { type: 'SELECT_UPGRADE', payload: pick });
            continue;
        }

        if (isPlayerTurn(state)) {
            // High-signal timeline stimulus: every third player turn inject a deterministic
            // displacement + hazard-style damage sequence before normal action selection.
            if (((state.turnsSpent || 0) % 3) === 0) {
                state = applyStimulusSequence(state);
            } else {
                state = gameReducer(state, choosePlayerAction(state, rng));
            }
        } else {
            state = gameReducer(state, { type: 'ADVANCE_TURN' });
        }
    }

    const events = state.timelineEvents || [];
    const groups = groupEvents(events);
    const playerGroupDurations = [...groups.values()]
        .filter(g => g[0]?.actorId === state.player.id)
        .map(g => g.filter(e => e.blocking).reduce((sum, e) => sum + (e.suggestedDurationMs || 0), 0));

    const violations = auditGroups(seed, events, blockingBudgetMs);
    allViolations.push(...violations);

    runs.push({
        seed,
        turnsSpent: state.turnsSpent || 0,
        timelineEvents: events.length,
        groups: groups.size,
        playerGroups: playerGroupDurations.length,
        avgPlayerBlockingMs: playerGroupDurations.length
            ? playerGroupDurations.reduce((a, b) => a + b, 0) / playerGroupDurations.length
            : 0,
        maxPlayerBlockingMs: playerGroupDurations.length ? Math.max(...playerGroupDurations) : 0,
        violations: violations.length,
    });
}

const summary = {
    generatedAt: new Date().toISOString(),
    runs: count,
    maxTurns,
    blockingBudgetMs,
    totals: {
        totalTimelineEvents: runs.reduce((a, r) => a + r.timelineEvents, 0),
        totalGroups: runs.reduce((a, r) => a + r.groups, 0),
        avgPlayerBlockingMs: runs.length ? runs.reduce((a, r) => a + r.avgPlayerBlockingMs, 0) / runs.length : 0,
        maxPlayerBlockingMs: runs.length ? Math.max(...runs.map(r => r.maxPlayerBlockingMs)) : 0,
        violations: allViolations.length,
    },
    violationBreakdown: allViolations.reduce<Record<string, number>>((acc, v) => {
        acc[v.type] = (acc[v.type] || 0) + 1;
        return acc;
    }, {}),
};

const payload = { summary, runs, violations: allViolations };
writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
originalLog(JSON.stringify({ wrote: target, summary }, null, 2));

if (strict && allViolations.length > 0) {
    process.exitCode = 2;
}
