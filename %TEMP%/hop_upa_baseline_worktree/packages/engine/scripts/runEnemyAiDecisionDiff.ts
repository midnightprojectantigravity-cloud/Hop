import { generateInitialState } from '../src/logic';
import { pointToKey } from '../src/hex';
import { selectEnemyDecisionWithOracleDiff } from '../src/systems/ai/enemy/selector';
import type { Entity } from '../src/types';

const argValue = (flag: string): string | undefined => {
    const idx = process.argv.indexOf(flag);
    if (idx === -1) return undefined;
    return process.argv[idx + 1];
};

let floorArg = argValue('--floor');
let seed = argValue('--seed');
let enemyId = argValue('--enemyId');
let subtype = argValue('--subtype');
let topArg = argValue('--top');

// npm workspace script forwarding can strip unknown `--flag` names and pass only positional values.
const positional = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
if (!floorArg && positional[0]) floorArg = positional[0];
if (!seed && positional[1]) seed = positional[1];
if (!enemyId && !subtype && positional[2]) subtype = positional[2];
if (!topArg && positional[3]) topArg = positional[3];
const top = Math.max(1, Number(topArg || 8));

if (!floorArg || !seed) {
    console.error('Usage: npx tsx ./scripts/runEnemyAiDecisionDiff.ts --floor <n> --seed <seed> [--enemyId <id> | --subtype <subtype>] [--top <n>]');
    process.exit(1);
}

const floor = Number(floorArg);
if (!Number.isFinite(floor) || floor < 1) {
    console.error(`Invalid --floor value: ${floorArg}`);
    process.exit(1);
}

const state = generateInitialState(floor, seed, seed);
const livingEnemies = state.enemies.filter(e => e.hp > 0);

const pickEnemy = (): Entity | undefined => {
    if (enemyId) return livingEnemies.find(e => e.id === enemyId);
    if (subtype) return livingEnemies.find(e => e.subtype === subtype);
    return livingEnemies[0];
};

const enemy = pickEnemy();
if (!enemy) {
    console.error(`No enemy found for floor=${floor}, seed=${seed}${enemyId ? `, enemyId=${enemyId}` : ''}${subtype ? `, subtype=${subtype}` : ''}`);
    console.error(`Available enemies: ${livingEnemies.map(e => `${e.id}:${e.subtype || 'unknown'}@${pointToKey(e.position)}`).join(', ')}`);
    process.exit(1);
}

const result = selectEnemyDecisionWithOracleDiff({
    enemy,
    playerPos: state.player.position,
    state: { ...state, occupiedCurrentTurn: state.occupiedCurrentTurn }
});

const summarizeEntity = (e: Entity) => ({
    id: e.id,
    subtype: e.subtype,
    position: e.position,
    intent: e.intent,
    intentPosition: e.intentPosition,
    actionCooldown: e.actionCooldown,
    facing: e.facing,
    isVisible: e.isVisible
});

const output = {
    state: {
        floor,
        seed,
        player: {
            id: state.player.id,
            position: state.player.position,
            stealthCounter: state.player.stealthCounter || 0
        },
        turnNumber: state.turnNumber,
        rngCounter: state.rngCounter,
    },
    enemy: summarizeEntity(enemy),
    selected: {
        usedOracleFallback: result.usedOracleFallback,
        mismatchReason: result.mismatchReason,
        entity: summarizeEntity(result.selected.plannedEntity),
        nextStateRngCounter: result.selected.nextState.rngCounter,
        message: result.selected.message,
        decision: {
            action: result.selected.decision.action,
            reasoningCode: result.selected.decision.reasoningCode,
            expectedValue: result.selected.decision.expectedValue,
            rngConsumption: result.selected.decision.rngConsumption
        }
    },
    oracle: {
        entity: summarizeEntity(result.oracle.plannedEntity),
        nextStateRngCounter: result.oracle.nextState.rngCounter,
        message: result.oracle.message,
        decision: {
            action: result.oracle.decision.action,
            reasoningCode: result.oracle.decision.reasoningCode,
            expectedValue: result.oracle.decision.expectedValue,
            rngConsumption: result.oracle.decision.rngConsumption
        }
    },
    scoredCandidates: result.scoredCandidates.slice(0, top).map(c => ({
        rankIndex: c.index,
        id: c.id,
        source: c.source,
        reasoningCode: c.reasoningCode,
        preScore: c.preScore,
        total: c.total,
        intent: c.intent,
        intentPosition: c.intentPosition,
        position: c.position,
        nextStateRngCounter: c.rngCounter,
        message: c.message,
        topContributions: Object.entries(c.breakdown.contributions)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .slice(0, 8)
    }))
};

console.log(JSON.stringify(output, null, 2));
