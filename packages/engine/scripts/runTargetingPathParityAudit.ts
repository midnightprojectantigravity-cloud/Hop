import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    DEFAULT_LOADOUTS,
    gameReducer,
    generateInitialState,
    isMovementSkillId,
    SkillRegistry,
    type TargetPathParityBucket,
    type Action,
    type GameState,
    type Point,
    validateMovementTargetParity,
    validateSkillTargetParity
} from '../src';

type LoadoutId = keyof typeof DEFAULT_LOADOUTS;

interface Violation {
    bucket: TargetPathParityBucket;
    loadoutId: LoadoutId;
    seed: string;
    step: number;
    actorId: string;
    skillId: string;
    target: Point;
    reason?: string;
}

const runsPerLoadout = Number(process.argv[2] || 2);
const maxSteps = Number(process.argv[3] || 6);
const outputPath = process.argv[4] || 'artifacts/upa/UPA_TARGET_PATH_PARITY_AUDIT.json';
const strict = (process.argv[5] || '0') === '1';

const movementSkillIds = new Set(['BASIC_MOVE', 'DASH', 'JUMP']);

const chooseDeterministicAction = (state: GameState, step: number): Action => {
    if (state.gameStatus === 'choosing_upgrade') {
        return { type: 'SELECT_UPGRADE', payload: state.shrineOptions?.[0] || 'EXTRA_HP' };
    }
    const isPlayerTurn = state.initiativeQueue?.entries[state.initiativeQueue.currentIndex]?.actorId === state.player.id;
    if (!isPlayerTurn) return { type: 'ADVANCE_TURN' };
    if (step % 2 === 0) return { type: 'WAIT' };
    const moveDef = SkillRegistry.get('BASIC_MOVE');
    const moveTargets = moveDef?.getValidTargets?.(state, state.player.position) || [];
    return moveTargets[0] ? { type: 'MOVE', payload: moveTargets[0] } : { type: 'WAIT' };
};

const collectActorSkillPairs = (state: GameState): Array<{ actorId: string; origin: Point; skillId: string }> => {
    const actors = [state.player, ...state.enemies, ...(state.companions || [])].filter(actor => actor.hp > 0);
    const pairs: Array<{ actorId: string; origin: Point; skillId: string }> = [];
    for (const actor of actors) {
        for (const skill of actor.activeSkills || []) {
            const def = SkillRegistry.get(skill.id);
            if (!def?.getValidTargets) continue;
            pairs.push({ actorId: actor.id, origin: actor.position, skillId: skill.id });
        }
    }
    return pairs;
};

const auditState = (state: GameState, meta: { loadoutId: LoadoutId; seed: string; step: number }): Violation[] => {
    const violations: Violation[] = [];
    const pairs = collectActorSkillPairs(state);

    for (const pair of pairs) {
        const def = SkillRegistry.get(pair.skillId);
        const targets = def?.getValidTargets?.(state, pair.origin) || [];
        for (const target of targets) {
            const base = validateSkillTargetParity(state, pair.actorId, pair.skillId, target);
            if (!base.ok && base.bucket) {
                violations.push({
                    ...meta,
                    bucket: base.bucket,
                    actorId: pair.actorId,
                    skillId: pair.skillId,
                    target,
                    reason: base.reason
                });
                continue;
            }

            if (movementSkillIds.has(pair.skillId) && isMovementSkillId(pair.skillId)) {
                const move = validateMovementTargetParity(
                    state,
                    pair.actorId,
                    pair.skillId as 'BASIC_MOVE' | 'DASH' | 'JUMP',
                    target
                );
                if (!move.ok && move.bucket) {
                    violations.push({
                        ...meta,
                        bucket: move.bucket,
                        actorId: pair.actorId,
                        skillId: pair.skillId,
                        target,
                        reason: move.reason
                    });
                }
            }
        }
    }

    return violations;
};

const runs: Array<{
    loadoutId: LoadoutId;
    seed: string;
    steps: number;
    violations: number;
}> = [];
const violations: Violation[] = [];

for (const loadoutId of Object.keys(DEFAULT_LOADOUTS) as LoadoutId[]) {
    for (let i = 0; i < runsPerLoadout; i++) {
        const seed = `target-path-parity-${loadoutId.toLowerCase()}-${i + 1}`;
        let state = generateInitialState(1, seed, seed, undefined, DEFAULT_LOADOUTS[loadoutId]);
        let step = 0;
        while (
            step < maxSteps
            && (state.gameStatus === 'playing' || state.gameStatus === 'choosing_upgrade')
        ) {
            step += 1;
            violations.push(...auditState(state, { loadoutId, seed, step }));
            const action = chooseDeterministicAction(state, step);
            state = gameReducer(state, action);
        }
        runs.push({
            loadoutId,
            seed,
            steps: step,
            violations: violations.filter(v => v.loadoutId === loadoutId && v.seed === seed).length
        });
    }
}

const byBucket = violations.reduce<Record<TargetPathParityBucket, number>>((acc, violation) => {
    acc[violation.bucket] = (acc[violation.bucket] || 0) + 1;
    return acc;
}, {
    target_invalid_but_listed: 0,
    movement_preview_missing: 0,
    execution_reject_after_valid_target: 0,
    path_interrupted_unexpected: 0,
    occupancy_or_tilehook_divergence: 0
});

const payload = {
    generatedAt: new Date().toISOString(),
    params: { runsPerLoadout, maxSteps, strict },
    summary: {
        totalRuns: runs.length,
        totalViolations: violations.length,
        byBucket
    },
    runs,
    violations
};

const targetFile = resolve(process.cwd(), outputPath);
writeFileSync(targetFile, JSON.stringify(payload, null, 2), 'utf8');
console.log(JSON.stringify({ wrote: targetFile, summary: payload.summary }, null, 2));

if (strict && violations.length > 0) {
    process.exitCode = 1;
}
