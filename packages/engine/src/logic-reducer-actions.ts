import type { Action, GameState, GridSize, MapShape, RunRulesetOverrides } from './types';
import type { GenerationSpecInput, GenerationState } from './generation/schema';
import { getEnemyAt } from './helpers';
import { appendTaggedMessage } from './systems/engine-messages';
import { StrategyRegistry } from './systems/ai/strategy-registry';
import { isPlayerTurn } from './systems/initiative';
import { resolveAcaeRuleset } from './systems/ailments/runtime';
import {
    applyLoadoutToPlayer,
    DEFAULT_LOADOUTS,
    ensureMobilitySkill,
    ensurePlayerCoreVisionSkill,
    type Loadout
} from './systems/loadout';
import { createDailyObjectives, createDailySeed, toDateKey } from './systems/run-objectives';
import { ManualStrategy } from './strategy/manual';
import { resolvePendingStateAction, resolveSelectUpgradeAction } from './logic-rules';
import type { Intent } from './types/intent';
import { recomputeVisibility } from './systems/visibility';
import { buildIntentPreview } from './systems/telegraph-projection';
import { resolveIresRuleset } from './systems/ires';
import { resolvePassiveSkillForTarget } from './systems/passive-targeting';
import { mergeCombatRulesetOverride, resolveCombatRuleset } from './systems/combat/combat-ruleset';

type ReducerDeps = {
    processNextTurn: (state: GameState, isResuming?: boolean) => GameState;
    generateInitialState: (
        floor?: number,
        seed?: string,
        initialSeed?: string,
        preservePlayer?: any,
        loadout?: Loadout,
        mapSize?: GridSize,
        mapShape?: MapShape,
        generationOptions?: {
            generationSpec?: GenerationSpecInput;
            generationState?: GenerationState;
        }
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

const mergeRunRulesetOverrides = (
    base: GameState['ruleset'],
    overrides?: RunRulesetOverrides
): GameState['ruleset'] => {
    if (!overrides) return base;
    const baseIres = resolveIresRuleset(base);
    const nextAilments = base?.ailments
        ? {
            ...base.ailments,
            ...(overrides.ailments?.acaeEnabled !== undefined
                ? { acaeEnabled: overrides.ailments.acaeEnabled }
                : {})
        }
        : undefined;
    const nextAttachments = base?.attachments
        ? {
            ...base.attachments,
            ...(overrides.attachments?.sharedVectorCarry !== undefined
                ? { sharedVectorCarry: overrides.attachments.sharedVectorCarry }
                : {})
        }
        : undefined;
    const nextCapabilities = base?.capabilities
        ? {
            ...base.capabilities,
            ...(overrides.capabilities?.loadoutPassivesEnabled !== undefined
                ? { loadoutPassivesEnabled: overrides.capabilities.loadoutPassivesEnabled }
                : {}),
            ...(overrides.capabilities?.movementRuntimeEnabled !== undefined
                ? { movementRuntimeEnabled: overrides.capabilities.movementRuntimeEnabled }
                : {})
        }
        : undefined;
    return {
        ...mergeCombatRulesetOverride(base, overrides),
        ...(nextAilments ? { ailments: nextAilments } : {}),
        ...(nextAttachments ? { attachments: nextAttachments } : {}),
        ...(nextCapabilities ? { capabilities: nextCapabilities } : {}),
        combat: {
            version: overrides.combat?.version || resolveCombatRuleset(base)
        },
        ires: {
            ...baseIres,
            ...(overrides.ires || {}),
            fibonacciTable: [...(overrides.ires?.fibonacciTable || baseIres.fibonacciTable)]
        }
    };
};

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

            const enemyAtTarget = getEnemyAt(s.enemies, target);
            const chosenSkillId = resolvePassiveSkillForTarget(s, s.player, s.player.position, target);

            if (!chosenSkillId) {
                return {
                    ...s,
                    message: appendTaggedMessage(
                        s.message,
                        enemyAtTarget ? 'No valid passive attack for target.' : 'Target out of reach or blocked!',
                        'CRITICAL',
                        'SYSTEM'
                    )
                };
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
            const resolvedRuleset = resolveAcaeRuleset(s);
            const applied = applyLoadoutToPlayer(loadout, {
                capabilityPassivesEnabled: resolvedRuleset.capabilities?.loadoutPassivesEnabled === true
            });
            return {
                ...s,
                ruleset: resolvedRuleset,
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
            const { loadoutId, seed, mode, date, mapSize, mapShape, rulesetOverrides, generationSpec } = a.payload;
            const loadout = DEFAULT_LOADOUTS[loadoutId];
            if (!loadout) return s;
            if (mode === 'daily') {
                const dateKey = toDateKey(date);
                const dailySeed = createDailySeed(dateKey);
                const next = deps.generateInitialState(1, seed || dailySeed, undefined, undefined, loadout, mapSize, mapShape, { generationSpec });
                const mergedRuleset = resolveAcaeRuleset({
                    ...next,
                    ruleset: mergeRunRulesetOverrides(s.ruleset || next.ruleset, rulesetOverrides)
                });
                const reconciledLoadout = applyLoadoutToPlayer(loadout, {
                    capabilityPassivesEnabled: mergedRuleset.capabilities?.loadoutPassivesEnabled === true
                });
                const nextState: GameState = {
                    ...next,
                    player: {
                        ...next.player,
                        activeSkills: ensurePlayerCoreVisionSkill(
                            ensureMobilitySkill(reconciledLoadout.activeSkills)
                        ),
                        archetype: reconciledLoadout.archetype
                    },
                    ruleset: mergedRuleset,
                    dailyRunDate: dateKey,
                    runObjectives: createDailyObjectives(dailySeed),
                    hazardBreaches: 0
                };
                const withVisibility = recomputeVisibility(nextState);
                return {
                    ...withVisibility,
                    intentPreview: buildIntentPreview(withVisibility)
                };
            }
            const next = deps.generateInitialState(1, seed, undefined, undefined, loadout, mapSize, mapShape, { generationSpec });
            const mergedRuleset = resolveAcaeRuleset({
                ...next,
                ruleset: mergeRunRulesetOverrides(s.ruleset || next.ruleset, rulesetOverrides)
            });
            const reconciledLoadout = applyLoadoutToPlayer(loadout, {
                capabilityPassivesEnabled: mergedRuleset.capabilities?.loadoutPassivesEnabled === true
            });
            const nextState: GameState = {
                ...next,
                player: {
                    ...next.player,
                    activeSkills: ensurePlayerCoreVisionSkill(
                        ensureMobilitySkill(reconciledLoadout.activeSkills)
                    ),
                    archetype: reconciledLoadout.archetype
                },
                ruleset: mergedRuleset
            };
            const withVisibility = recomputeVisibility(nextState);
            return {
                ...withVisibility,
                intentPreview: buildIntentPreview(withVisibility)
            };
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
