import {
    hexAdd,
    getNeighbors,
    getDirectionFromTo,
    hexDistance,
    hexDirection,
    hexEquals
} from '../../hex';
import type {
    InformationProvider,
    InformationQuery,
    Actor,
    AtomicEffect,
    GameState,
    MovementProvider,
    MovementQuery,
    Point,
    SenseProvider,
    SenseQuery,
    SkillCapabilities,
    SkillDefinition
} from '../../types';
import { createRaiseDeadSkeletonId } from '../entities/companion-id-strategies';
import { createCompanion } from '../entities/entity-factory';
import { extractTrinityStats } from '../combat/combat-calculator';
import { createDamageEffectFromCombat, resolveSkillCombatDamage } from '../combat/combat-effect';
import { resolveForce } from '../combat/force';
import { createBombActor } from '../effects/bomb-runtime';
import { processKineticPulse } from '../movement/kinetic-kernel';
import { SpatialSystem } from '../spatial-system';
import { materializeSkillDefinitionCapabilityProviders } from './capability-materialization';
import { resolveSummonPlacement } from '../summon-placement';
import { validateMovementDestination } from '../capabilities/movement-policy';
import { UnifiedTileService } from '../tiles/unified-tile-service';
import { resolveRuntimeMovementExecutionPlan } from './movement';
import { resolveSkillRuntime } from './resolve';
import {
    applyInstructionPointFilters,
    expandSelectedHexPointPattern,
    resolveInstructionPointPattern,
    resolveInstructionPointTargets,
    resolveInstructionPoints,
    resolvePointSet
} from './point-resolution';
import type { PointResolutionContext } from './point-resolution';
import {
    resolveActorAtPoint
} from './presentation-materialization';
import {
    appendTrace,
    clonePoint,
    consumeRuntimeRandom,
    createTrace,
    syncActorPosition
} from './execution-context';
import {
    createLoweringExecutionContext,
    instructionPassesRuntimeConditions,
    type LoweringExecutionContext
} from './execution-lowering';
import { resolvePointRef as resolvePointReference } from './point-reference';
import { resolveProjectileTrace } from './projectile-resolution';
import { materializeRuntimeMessageInstruction } from './message-lowering';
import { preflightRuntimeExecution } from './execution-preflight';
import {
    adjustMagnitudeForWeightClass,
    resolveDirectionVector,
    resolveRuntimeStatusMultipliers,
    toCollisionPolicy
} from './physics-resolution';
import {
    createPointProxyTarget,
    resolveActorRef,
    resolveFalconCompanionState
} from './actor-resolution';
import {
    applyInitialStatuses,
    createBombActorId,
    syncDisplacementEffects
} from './spawn-resolution';
import { resolveJuiceMetadata } from './juice-resolution';
import {
    resolveDashStopPoint,
    resolveDirectionFromPath,
    resolvePathPenultimatePoint,
    resolvePathRef,
    resolveWithdrawalRetreatPoint
} from './path-resolution';
import {
    isRuntimeSkillTargetValid,
    resolveRuntimeSkillActorById,
    resolveRuntimeSkillTargetActor,
    resolveRuntimeSkillValidTargets
} from './targeting';
import {
    materializeApplyStatusInstruction,
    materializeHealInstruction,
    materializeSetStealthInstruction
} from './status-materialization';
import {
    materializeModifyResourceInstruction,
    materializePickupItemInstruction,
    materializeRemoveCorpseInstruction,
    materializeSpawnItemInstruction
} from './utility-materialization';
import {
    materializeUpdateBehaviorStateInstruction,
    materializeUpdateCompanionStateInstruction
} from './companion-state-materialization';
import {
    materializeEmitJuiceInstruction
} from './juice-materialization';
import {
    materializeApplyForceInstruction,
    materializeEmitPulseInstruction,
    materializeMoveActorInstruction,
    materializeTeleportActorInstruction
} from './movement-materialization';
import {
    materializeApplyAilmentInstruction,
    materializeDealDamageInstruction
} from './combat-materialization';
import {
    materializeSpawnActorInstruction
} from './spawn-materialization';
import {
    materializePlaceTrapInstruction,
    materializeRemoveTrapInstruction,
    materializeSetTrapCooldownInstruction
} from './trap-materialization';
import { materializePlaceSurfaceInstruction } from './surface-materialization';
import { materializeModifyCooldownInstruction } from './cooldown-materialization';
import { buildMaterializedSkillDefinition } from './skill-materialization';
import type {
    EmitJuiceInstruction,
    ResolutionTrace,
    ResolutionTraceMode,
    ResolvedSkillRuntime,
    RuntimePointFilter,
    RuntimePointSet,
    RuntimePathRef,
    RuntimePointPattern,
    RuntimeTargetFanOut,
    RuntimePointRef,
    SkillExecutionWithRuntimeResult,
    SkillRuntimeDefinition
} from './types';

type ResolvedInstructionPointTarget = {
    point: Point;
    actor?: Actor;
    effectTarget: Point | string;
};

const resolvePointRef = (
    ref: RuntimePointRef,
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext
): Point | undefined => resolvePointReference(ref, attacker, state, context, resolveRuntimeSkillActorById);

const pointResolutionDeps = {
    resolvePointRef,
    resolveActorRef,
    resolveActorAtPoint,
    consumeRuntimeRandom
};

const lowerResolvedSkillRuntime = (
    resolved: ResolvedSkillRuntime,
    state: GameState,
    attacker: Actor,
    target?: Point,
    traceMode: ResolutionTraceMode = 'summary',
    runtimeContext: Record<string, any> = {}
): { effects: AtomicEffect[]; messages: string[]; executionTrace: ResolutionTrace; rngConsumption: number } => {
    const executionTrace = createTrace(traceMode);
    const effects: AtomicEffect[] = [];
    const messages: string[] = [];
    const context: LoweringExecutionContext = createLoweringExecutionContext(
        resolved,
        state,
        attacker,
        target,
        runtimeContext,
        executionTrace
    );

    for (const instruction of resolved.combatScript) {
        if (!instructionPassesRuntimeConditions(instruction, resolved, state, attacker, context, executionTrace, traceMode)) {
            continue;
        }

        appendTrace(executionTrace, {
            kind: 'instruction',
            path: `combatScript.${instruction.id || instruction.kind}`,
            message: `Lowering ${instruction.kind}.`,
            metadata: { phase: instruction.phase }
        });

        switch (instruction.kind) {
            case 'MOVE_ACTOR': {
                const materialized = materializeMoveActorInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolved,
                    {
                        resolveActorRef,
                        resolvePointRef,
                        resolveRuntimeMovementExecutionPlan,
                        syncActorPosition,
                        appendTrace,
                        createTrace,
                        resolveRuntimeSkillActorById
                    }
                );
                effects.push(...materialized.effects);
                messages.push(...materialized.messages);
                break;
            }
            case 'TRACE_PROJECTILE': {
                context.projectileTrace = resolveProjectileTrace(
                    instruction.mode,
                    attacker,
                    state,
                    context,
                    instruction.stopAtWalls,
                    instruction.stopAtActors
                );
                if (context.projectileTrace?.impactActorId) {
                    context.targetActorId = context.projectileTrace.impactActorId;
                }
                break;
            }
            case 'TELEPORT_ACTOR': {
                const materialized = materializeTeleportActorInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolved,
                    {
                        resolveActorRef,
                        resolvePointRef,
                        resolveRuntimeMovementExecutionPlan,
                        syncActorPosition,
                        appendTrace,
                        createTrace,
                        resolveRuntimeSkillActorById
                    }
                );
                effects.push(...materialized.effects);
                messages.push(...materialized.messages);
                break;
            }
            case 'APPLY_FORCE': {
                const materialized = materializeApplyForceInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolved,
                    {
                        resolveActorRef,
                        resolvePointRef,
                        resolveRuntimeMovementExecutionPlan,
                        syncActorPosition,
                        appendTrace,
                        createTrace,
                        resolveRuntimeSkillActorById
                    },
                    appendTrace,
                    resolveRuntimeStatusMultipliers,
                    resolveForce
                );
                effects.push(...materialized.effects);
                messages.push(...materialized.messages);
                break;
            }
            case 'EMIT_PULSE': {
                const materialized = materializeEmitPulseInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolveRuntimeSkillTargetActor(state, target),
                    resolved,
                    {
                        resolveActorRef,
                        resolvePointRef,
                        resolveRuntimeMovementExecutionPlan,
                        syncActorPosition,
                        appendTrace,
                        createTrace,
                        resolveRuntimeSkillActorById
                    },
                    appendTrace
                );
                effects.push(...materialized);
                syncDisplacementEffects((actorId, destination) => syncActorPosition(context, actorId, destination), materialized);
                break;
            }
            case 'RESOLVE_COLLISION':
                context.collisionPolicy = instruction.collision;
                break;
            case 'DEAL_DAMAGE': {
                effects.push(...materializeDealDamageInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolved,
                    {
                        resolveInstructionPointTargets,
                        resolveRuntimeSkillActorById,
                        pointResolutionDeps
                    }
                ));
                break;
            }
            case 'APPLY_AILMENT': {
                effects.push(...materializeApplyAilmentInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    {
                        resolveInstructionPointTargets,
                        resolveRuntimeSkillActorById,
                        pointResolutionDeps
                    }
                ));
                break;
            }
            case 'SET_STEALTH': {
                effects.push(...materializeSetStealthInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolveActorRef
                ));
                break;
            }
            case 'APPLY_STATUS': {
                const materialized = materializeApplyStatusInstruction(
                    instruction,
                    attacker,
                    state,
                    target,
                    context,
                    {
                        resolveActorRef,
                        resolveInstructionPointTargets,
                        pointResolutionDeps
                    }
                );
                effects.push(...materialized.effects);
                messages.push(...materialized.messages);
                break;
            }
            case 'HEAL': {
                effects.push(...materializeHealInstruction(
                    instruction,
                    attacker,
                    state,
                    target,
                    context,
                    resolveActorRef
                ));
                break;
            }
            case 'PLACE_SURFACE': {
                effects.push(...materializePlaceSurfaceInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolvePointRef,
                    resolveInstructionPoints,
                    pointResolutionDeps
                ));
                break;
            }
            case 'SPAWN_ACTOR': {
                const materialized = materializeSpawnActorInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    {
                        resolveActorRef,
                        resolvePointRef,
                        syncActorPosition
                    }
                );
                effects.push(...materialized.effects);
                messages.push(...materialized.messages);
                break;
            }
            case 'SPAWN_ITEM': {
                effects.push(...materializeSpawnItemInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolvePointRef
                ));
                break;
            }
            case 'PICKUP_ITEM':
                effects.push(...materializePickupItemInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolvePointRef
                ));
                break;
            case 'MODIFY_COOLDOWN':
                effects.push(...materializeModifyCooldownInstruction(instruction));
                break;
            case 'MODIFY_RESOURCE': {
                effects.push(...materializeModifyResourceInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolveActorRef
                ));
                break;
            }
            case 'REMOVE_CORPSE': {
                effects.push(...materializeRemoveCorpseInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolvePointRef
                ));
                break;
            }
            case 'PLACE_TRAP': {
                effects.push(...materializePlaceTrapInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolveActorRef,
                    resolvePointRef,
                    pointResolutionDeps
                ));
                break;
            }
            case 'REMOVE_TRAP': {
                effects.push(...materializeRemoveTrapInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolveActorRef,
                    resolvePointRef
                ));
                break;
            }
            case 'SET_TRAP_COOLDOWN': {
                effects.push(...materializeSetTrapCooldownInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolveActorRef,
                    resolvePointRef
                ));
                break;
            }
            case 'UPDATE_COMPANION_STATE': {
                effects.push(...materializeUpdateCompanionStateInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolveActorRef,
                    resolvePointRef
                ));
                break;
            }
            case 'UPDATE_BEHAVIOR_STATE': {
                effects.push(...materializeUpdateBehaviorStateInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolveActorRef,
                    resolvePointRef
                ));
                break;
            }
            case 'EMIT_JUICE': {
                effects.push(...materializeEmitJuiceInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolveInstructionPoints,
                    pointResolutionDeps
                ));
                break;
            }
            case 'MESSAGE': {
                const materialized = materializeRuntimeMessageInstruction(
                    instruction,
                    attacker,
                    state,
                    context,
                    resolved,
                    {
                        resolveActorRef,
                        resolveInstructionPointTargets,
                        pointResolutionDeps
                    }
                );
                messages.push(...materialized.messages);
                effects.push(...materialized.effects);
                break;
            }
        }
    }

    return {
        effects,
        messages,
        executionTrace,
        rngConsumption: context.rngConsumption
    };
};

export const resolveAndExecuteSkillRuntime = (
    definition: SkillRuntimeDefinition,
    state: GameState,
    attacker: Actor,
    target?: Point,
    activeUpgradeIds: string[] = [],
    traceMode: ResolutionTraceMode = 'summary',
    runtimeContext: Record<string, any> = {}
): SkillExecutionWithRuntimeResult => {
    const preflight = preflightRuntimeExecution(
        definition,
        state,
        attacker,
        target,
        activeUpgradeIds,
        traceMode,
        runtimeContext
    );
    if (preflight.kind === 'stunned') return preflight.result;
    if (preflight.kind === 'empty') {
        return {
            effects: [],
            messages: [],
            consumesTurn: false,
            rngConsumption: 0,
            resolvedRuntime: preflight.resolved,
            executionTrace: createTrace(traceMode)
        };
    }
    if (preflight.kind === 'missing_target') {
        return {
            effects: [],
            messages: [preflight.message],
            consumesTurn: false,
            rngConsumption: 0,
            resolvedRuntime: preflight.resolved,
            executionTrace: preflight.executionTrace
        };
    }

    const lowered = lowerResolvedSkillRuntime(
        preflight.resolved,
        state,
        attacker,
        preflight.targetToUse,
        traceMode,
        preflight.runtimeContext
    );
    const consumesTurn = preflight.resolved.runtime.id === 'JUMP' && preflight.resolved.resolvedKeywords.includes('FREE_JUMP')
        ? false
        : true;
    return {
        effects: lowered.effects,
        messages: lowered.messages,
        consumesTurn,
        rngConsumption: lowered.rngConsumption,
        resolvedRuntime: preflight.resolved,
        executionTrace: lowered.executionTrace
    };
};

export const materializeSkillDefinition = (
    definition: SkillRuntimeDefinition
): SkillDefinition => {
    return buildMaterializedSkillDefinition(
        definition,
        (state, attacker, target, activeUpgrades = [], context = {}) => {
            const traceMode = (context.traceMode as ResolutionTraceMode | undefined) || 'summary';
            return resolveAndExecuteSkillRuntime(definition, state, attacker, target, activeUpgrades, traceMode, context);
        },
        (state, origin) => {
            const actor = resolveActorAtPoint(state, origin);
            if (!actor) return [];
            const activeUpgradeIds = actor.activeSkills.find(skill => skill.id === definition.id)?.activeUpgrades || [];
            const resolved = resolveSkillRuntime(definition, activeUpgradeIds, 'none', { state, attacker: actor });
            return resolveRuntimeSkillValidTargets(resolved, state, actor, createTrace('none'));
        }
    );
};
