import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gameReducer, generateInitialState } from '../src/logic';
import { DEFAULT_LOADOUTS } from '../src/systems/loadout';
import { isPlayerTurn } from '../src/systems/initiative';
import { createRng } from '../src/systems/rng';
import { getNeighbors, hexEquals } from '../src/hex';
import { SkillRegistry } from '../src/skillRegistry';
import { UnifiedTileService } from '../src/systems/unified-tile-service';
import type { Action, GameState, Point } from '../src/types';
import type { ArchetypeLoadoutId } from '../src/systems/balance-harness';

const originalLog = console.log.bind(console);
if (process.env.VERBOSE_ANALYSIS !== '1') {
    console.log = () => undefined;
    console.warn = () => undefined;
}

type ExpectationId =
    | 'message_tagged'
    | 'jump_before_stun'
    | 'stunned_actor_does_not_attack_same_step'
    | 'no_consecutive_duplicate_messages'
    | 'no_target_preview_mismatch_message';

type Violation = {
    expectation: ExpectationId;
    loadoutId: ArchetypeLoadoutId;
    seed: string;
    turnNumber: number;
    turnsSpent: number;
    detail: string;
    messages: string[];
};

type RunSummary = {
    loadoutId: ArchetypeLoadoutId;
    seed: string;
    turnsSpent: number;
    gameStatus: GameState['gameStatus'];
    violations: number;
};

const TAG_PATTERN = /^\[(INFO|VERBOSE|DEBUG|CRITICAL)\|([A-Z_]+)\]\s*/;

const stripTag = (message: string): string => message.replace(TAG_PATTERN, '').trim();

const parseStunnedActor = (message: string): string | undefined => {
    const text = stripTag(message);
    let m = text.match(/^(.+?) is stunned!?$/i);
    if (m?.[1]) return m[1].trim().toLowerCase();
    m = text.match(/^(.+?) stunned by landing impact!?$/i);
    if (m?.[1]) return m[1].trim().toLowerCase();
    return undefined;
};

const parseAttackerActor = (message: string): string | undefined => {
    const text = stripTag(message);
    const m = text.match(/^(.+?) attacked you!?$/i);
    if (!m?.[1]) return undefined;
    return m[1].trim().toLowerCase();
};

const isBlockedTargetMessage = (message: string): boolean => {
    const text = stripTag(message).toLowerCase();
    return text.includes('target out of reach or blocked');
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

const choosePlayerAction = (state: GameState, rng: ReturnType<typeof createRng>): Action => {
    const actions: Action[] = [{ type: 'WAIT' }];

    for (const target of legalMoveTargets(state).slice(0, 6)) {
        actions.push({ type: 'MOVE', payload: target });
    }

    for (const skill of state.player.activeSkills || []) {
        if ((skill.currentCooldown || 0) > 0) continue;
        if (skill.id === 'AUTO_ATTACK') continue;
        const def = SkillRegistry.get(skill.id as any);
        if (!def?.getValidTargets) continue;
        const targets = def.getValidTargets(state, state.player.position);
        if (!targets.length) continue;

        const picks = Math.min(3, targets.length);
        for (let i = 0; i < picks; i++) {
            const idx = Math.floor(rng.next() * targets.length);
            const target = targets[idx]!;
            actions.push({ type: 'USE_SKILL', payload: { skillId: skill.id, target } });
        }
    }

    const selected = actions[Math.floor(rng.next() * actions.length)];
    return selected || { type: 'WAIT' };
};

const collectStepViolations = (
    loadoutId: ArchetypeLoadoutId,
    seed: string,
    before: GameState,
    after: GameState,
    newMessages: string[]
): Violation[] => {
    const violations: Violation[] = [];
    if (newMessages.length === 0) return violations;

    const base = {
        loadoutId,
        seed,
        turnNumber: after.turnNumber,
        turnsSpent: after.turnsSpent,
        messages: newMessages,
    };

    for (const msg of newMessages) {
        if (!TAG_PATTERN.test(msg)) {
            violations.push({
                ...base,
                expectation: 'message_tagged',
                detail: `Message is not tagged: ${msg}`,
            });
        }
    }

    const jumpIdx = newMessages.findIndex(m => stripTag(m).toLowerCase() === 'jumped!');
    const stunIdx = newMessages.findIndex(m => stripTag(m).toLowerCase().includes('stunned'));
    if (jumpIdx >= 0 && stunIdx >= 0 && stunIdx < jumpIdx) {
        violations.push({
            ...base,
            expectation: 'jump_before_stun',
            detail: `Stun message was emitted before Jumped! (stunIdx=${stunIdx}, jumpIdx=${jumpIdx})`,
        });
    }

    const stunnedActors = new Set<string>();
    const attackingActors = new Set<string>();
    for (const msg of newMessages) {
        const stunned = parseStunnedActor(msg);
        if (stunned) stunnedActors.add(stunned);
        const attacker = parseAttackerActor(msg);
        if (attacker) attackingActors.add(attacker);
    }
    for (const actor of stunnedActors) {
        if (attackingActors.has(actor)) {
            violations.push({
                ...base,
                expectation: 'stunned_actor_does_not_attack_same_step',
                detail: `Actor ${actor} is both stunned and attacks in same step`,
            });
        }
    }

    for (let i = 1; i < newMessages.length; i++) {
        const prev = stripTag(newMessages[i - 1]!).toLowerCase();
        const cur = stripTag(newMessages[i]!).toLowerCase();
        if (prev && prev === cur) {
            violations.push({
                ...base,
                expectation: 'no_consecutive_duplicate_messages',
                detail: `Consecutive duplicate message: ${stripTag(newMessages[i]!)}`,
            });
        }
    }

    for (const msg of newMessages) {
        if (isBlockedTargetMessage(msg)) {
            violations.push({
                ...base,
                expectation: 'no_target_preview_mismatch_message',
                detail: `Target preview mismatch surfaced by engine: ${msg}`,
            });
        }
    }

    // Extra guard: prevent log explosion from unchanged-latent spam in same turn.
    const growth = (after.message?.length || 0) - (before.message?.length || 0);
    if (growth > 25) {
        violations.push({
            ...base,
            expectation: 'no_consecutive_duplicate_messages',
            detail: `Large message burst in one reducer step: +${growth}`,
        });
    }

    return violations;
};

const runSingle = (
    loadoutId: ArchetypeLoadoutId,
    seed: string,
    maxTurns: number,
    maxReducerSteps: number
): { summary: RunSummary; violations: Violation[] } => {
    const loadout = DEFAULT_LOADOUTS[loadoutId];
    const rng = createRng(`${seed}:message-audit`);
    let state = generateInitialState(1, seed, seed, undefined, loadout);
    const violations: Violation[] = [];

    let steps = 0;
    while (steps < maxReducerSteps && state.gameStatus === 'playing' && state.turnsSpent < maxTurns) {
        steps++;
        const before = state;
        const beforeCount = before.message?.length || 0;

        if (before.gameStatus === 'choosing_upgrade') {
            const pick = before.shrineOptions?.[0] || 'EXTRA_HP';
            state = gameReducer(before, { type: 'SELECT_UPGRADE', payload: pick });
        } else if (isPlayerTurn(before)) {
            const action = choosePlayerAction(before, rng);
            state = gameReducer(before, action);
        } else {
            state = gameReducer(before, { type: 'ADVANCE_TURN' });
        }

        const newMessages = (state.message || []).slice(beforeCount);
        violations.push(...collectStepViolations(loadoutId, seed, before, state, newMessages));
    }

    return {
        summary: {
            loadoutId,
            seed,
            turnsSpent: state.turnsSpent || 0,
            gameStatus: state.gameStatus,
            violations: violations.length,
        },
        violations,
    };
};

const count = Number(process.argv[2] || 12);
const maxTurns = Number(process.argv[3] || 80);
const outFile = process.argv[4] || 'docs/UPA_MESSAGE_AUDIT.json';
const maxReducerSteps = Number(process.argv[5] || 3000);

const archetypes = Object.keys(DEFAULT_LOADOUTS) as ArchetypeLoadoutId[];
const summaries: RunSummary[] = [];
const allViolations: Violation[] = [];

for (const loadoutId of archetypes) {
    for (let i = 0; i < count; i++) {
        const seed = `message-audit-${loadoutId.toLowerCase()}-${i + 1}`;
        const run = runSingle(loadoutId, seed, maxTurns, maxReducerSteps);
        summaries.push(run.summary);
        allViolations.push(...run.violations);
    }
}

const byExpectation = allViolations.reduce<Record<string, number>>((acc, v) => {
    acc[v.expectation] = (acc[v.expectation] || 0) + 1;
    return acc;
}, {});

const byLoadout = summaries.reduce<Record<string, { runs: number; violations: number; avgTurns: number }>>((acc, s) => {
    if (!acc[s.loadoutId]) {
        acc[s.loadoutId] = { runs: 0, violations: 0, avgTurns: 0 };
    }
    acc[s.loadoutId].runs += 1;
    acc[s.loadoutId].violations += s.violations;
    acc[s.loadoutId].avgTurns += s.turnsSpent;
    return acc;
}, {});

for (const entry of Object.values(byLoadout)) {
    entry.avgTurns = Number((entry.avgTurns / Math.max(1, entry.runs)).toFixed(2));
}

const target = resolve(process.cwd(), outFile);
const payload = {
    generatedAt: new Date().toISOString(),
    params: {
        runsPerArchetype: count,
        maxTurns,
        maxReducerSteps,
        archetypes,
    },
    expectations: [
        {
            id: 'message_tagged',
            description: 'Every emitted message must be engine-tagged ([LEVEL|CHANNEL]).',
        },
        {
            id: 'jump_before_stun',
            description: 'When Jump occurs, jump action message should appear before stun result messages.',
        },
        {
            id: 'stunned_actor_does_not_attack_same_step',
            description: 'A stunned actor should not also attack in the same reducer step.',
        },
        {
            id: 'no_consecutive_duplicate_messages',
            description: 'Avoid adjacent duplicate log lines and runaway spam bursts in one step.',
        },
        {
            id: 'no_target_preview_mismatch_message',
            description: 'No target preview mismatch errors should surface for legal intents.',
        },
    ],
    summary: {
        totalRuns: summaries.length,
        totalViolations: allViolations.length,
        byExpectation,
        byLoadout,
    },
    runSummaries: summaries,
    violations: allViolations,
};

writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
originalLog(JSON.stringify({ wrote: target, summary: payload.summary }, null, 2));
