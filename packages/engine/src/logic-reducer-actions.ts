import type { Action, GameState } from './types';
import { hexEquals } from './hex';
import { getEnemyAt } from './helpers';
import { SkillRegistry } from './skillRegistry';
import { appendTaggedMessage } from './systems/engine-messages';
import { StrategyRegistry } from './systems/ai/strategy-registry';
import { isPlayerTurn } from './systems/initiative';
import { applyLoadoutToPlayer, DEFAULT_LOADOUTS, type Loadout } from './systems/loadout';
import { createDailyObjectives, createDailySeed, toDateKey } from './systems/run-objectives';
import { ManualStrategy } from './strategy/manual';
import { resolvePendingStateAction, resolveSelectUpgradeAction } from './logic-rules';
import type { Intent } from './types/intent';

type ReducerDeps = {
    processNextTurn: (state: GameState, isResuming?: boolean) => GameState;
    generateInitialState: (
        floor?: number,
        seed?: string,
        initialSeed?: string,
        preservePlayer?: any,
        loadout?: Loadout
    ) => GameState;
    generateHubState: () => GameState;
    warnTurnStackInvariant: (message: string, payload?: Record<string, unknown>) => void;
};

const PLAYER_ACTION_TYPES = new Set<Action['type']>([
    'MOVE',
    'THROW_SPEAR',
    'WAIT',
    'USE_SKILL',
    'JUMP',
    'SHIELD_BASH',
    'ATTACK',
    'LEAP'
]);

const queueManualIntent = (state: GameState, intent: Intent): void => {
    const strategy = StrategyRegistry.resolve(state.player);
    if (strategy instanceof ManualStrategy) {
        strategy.pushIntent(intent);
    }
};

const playerInputMetadata = {
    expectedValue: 0,
    reasoningCode: 'PLAYER_INPUT',
    isGhost: false
} as const;

export const resolveGameStateAction = (
    s: GameState,
    a: Action,
    deps: ReducerDeps
): GameState => {
    if (PLAYER_ACTION_TYPES.has(a.type) && !isPlayerTurn(s)) {
        return s;
    }

    switch (a.type) {
        case 'SELECT_UPGRADE': {
            if (!('payload' in a)) return s;
            return resolveSelectUpgradeAction(s, a.payload);
        }

        case 'USE_SKILL': {
            const { skillId, target } = a.payload;
            queueManualIntent(s, {
                type: 'USE_SKILL',
                actorId: s.player.id,
                skillId,
                targetHex: target,
                priority: 10,
                metadata: playerInputMetadata
            });
            return deps.processNextTurn(s, true);
        }

        case 'MOVE': {
            if (!('payload' in a)) return s;
            const target = a.payload;

            const playerSkills = s.player.activeSkills || [];
            const enemyAtTarget = getEnemyAt(s.enemies, target);

            const preferredOrder = ['BASIC_ATTACK', 'BASIC_MOVE', 'DASH'];
            const passiveSkills = playerSkills.filter(sk => sk.slot === 'passive');
            const sortedSkills = [
                ...passiveSkills.filter(sk => preferredOrder.includes(sk.id)),
                ...passiveSkills.filter(sk => !preferredOrder.includes(sk.id))
            ];

            let chosenSkillId: string | undefined;
            for (const sk of sortedSkills) {
                const def = SkillRegistry.get(sk.id);
                if (!def?.getValidTargets) continue;
                const validTargets = def.getValidTargets(s, s.player.position);
                if (validTargets.some(v => hexEquals(v, target))) {
                    chosenSkillId = sk.id;
                    break;
                }
            }

            if (!chosenSkillId) {
                const hasBasicAttack = playerSkills.some(sk => sk.id === 'BASIC_ATTACK');
                const hasBasicMove = playerSkills.some(sk => sk.id === 'BASIC_MOVE');

                if (enemyAtTarget && hasBasicAttack) {
                    chosenSkillId = 'BASIC_ATTACK';
                } else if (!enemyAtTarget && hasBasicMove) {
                    chosenSkillId = 'BASIC_MOVE';
                } else {
                    return {
                        ...s,
                        message: appendTaggedMessage(
                            s.message,
                            enemyAtTarget ? 'No valid passive attack for target.' : 'No valid passive movement for target.',
                            'CRITICAL',
                            'SYSTEM'
                        )
                    };
                }
            }

            queueManualIntent(s, {
                type: enemyAtTarget ? 'ATTACK' : 'MOVE',
                actorId: s.player.id,
                skillId: chosenSkillId,
                targetHex: target,
                primaryTargetId: enemyAtTarget?.id,
                priority: 10,
                metadata: playerInputMetadata
            } as Intent);

            return deps.processNextTurn(s, true);
        }

        case 'WAIT': {
            queueManualIntent(s, {
                type: 'WAIT',
                actorId: s.player.id,
                skillId: 'WAIT',
                priority: 10,
                metadata: playerInputMetadata
            });
            return deps.processNextTurn(s, true);
        }

        case 'APPLY_LOADOUT': {
            if (!('payload' in a)) return s;
            const loadout = a.payload as Loadout;
            const applied = applyLoadoutToPlayer(loadout);
            return {
                ...s,
                player: {
                    ...s.player,
                    activeSkills: applied.activeSkills,
                    archetype: applied.archetype,
                },
                upgrades: applied.upgrades,
                hasSpear: loadout.startingSkills.includes('SPEAR_THROW'),
                hasShield: loadout.startingSkills.includes('SHIELD_THROW') || s.hasShield,
                selectedLoadoutId: loadout.id,
                message: appendTaggedMessage(s.message, `${loadout.name} selected.`, 'INFO', 'SYSTEM')
            };
        }

        case 'START_RUN': {
            const { loadoutId, seed, mode, date } = a.payload;
            const loadout = DEFAULT_LOADOUTS[loadoutId];
            if (!loadout) return s;
            if (mode === 'daily') {
                const dateKey = toDateKey(date);
                const dailySeed = createDailySeed(dateKey);
                const next = deps.generateInitialState(1, seed || dailySeed, undefined, undefined, loadout);
                return {
                    ...next,
                    dailyRunDate: dateKey,
                    runObjectives: createDailyObjectives(dailySeed),
                    hazardBreaches: 0
                };
            }
            return deps.generateInitialState(1, seed, undefined, undefined, loadout);
        }

        case 'ADVANCE_TURN': {
            if (s.pendingStatus || (s.pendingFrames?.length ?? 0) > 0) {
                deps.warnTurnStackInvariant('Ignored ADVANCE_TURN while pendingStatus is active.', {
                    status: s.pendingStatus?.status,
                    pendingFrames: s.pendingFrames?.length ?? 0,
                    turnNumber: s.turnNumber
                });
                return s;
            }
            return deps.processNextTurn(s, false);
        }

        case 'RESOLVE_PENDING': {
            return resolvePendingStateAction(s, { generateInitialState: deps.generateInitialState });
        }

        case 'EXIT_TO_HUB': {
            return deps.generateHubState();
        }

        default:
            return s;
    }
};
