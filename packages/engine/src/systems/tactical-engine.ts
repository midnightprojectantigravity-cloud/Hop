import type { Intent } from '../types/intent';
import type { GameState, Actor, AtomicEffect, Point, AtomicStackReactionHooks, ActionResourcePreview } from '../types';
import { SkillRegistry } from '../skillRegistry';
import { getActorAt } from '../helpers';
import { hexEquals } from '../hex';
import { isFreeMoveMode, resolveCombatPressureMode } from './free-move';
import { applyEffects } from './effect-engine';
import { recomputeVisibility } from './visibility';
import {
    computeSparkRecoveryIfEndedNow,
    ensureActorIres,
    resolveExhaustionState,
    resolveIresActionPreview,
    resolveIresRuleset,
    resolveRuntimeSkillResourceProfile,
    resolveWaitPreview
} from './ires';
import { resolveVirtualSkillDefinition } from './skill-upgrade-resolution';

type TacticalResolution = {
    effects: AtomicEffect[];
    messages: string[];
    consumesTurn?: boolean;
    rngConsumption?: number;
    targetId?: string;
    kills?: number;
    stackReactions?: AtomicStackReactionHooks;
    turnOutcome: 'reject' | 'continue' | 'end';
    resourcePreview?: ActionResourcePreview;
};

/**
 * Layer 3: The Tactical Executor (The "Body").
 * Pure & Deterministic execution of an Intent.
 */
export class TacticalEngine {
    private static clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    private static ignoresPlayerPerception(skillId: string): boolean {
        return skillId === 'FALCON_COMMAND';
    }

    private static resolveActorById(gameState: GameState, actorId?: string): Actor | undefined {
        if (!actorId) return undefined;
        if (gameState.player.id === actorId) return gameState.player;
        return gameState.enemies.find(enemy => enemy.id === actorId) || gameState.companions?.find(companion => companion.id === actorId);
    }

    static execute(intent: Intent, actor: Actor, gameState: GameState): TacticalResolution {
        const result = this.resolveExecution(intent, actor, gameState);
        return result;
    }

    /**
     * Layer 3b: The Simulator (The "Ghost").
     * Validates what WOULD happen without mutating the state.
     */
    static simulate(intent: Intent, actor: Actor, gameState: GameState): TacticalResolution {
        // Since getValidTargets and execute are pure, we just call the same logic.
        return this.resolveExecution(intent, actor, gameState);
    }

    private static adjustResourcePreviewForCombatPressure(
        gameState: GameState,
        actor: Actor,
        skillDef: NonNullable<ReturnType<typeof SkillRegistry.get>>,
        execution: {
            effects: AtomicEffect[];
            stackReactions?: AtomicStackReactionHooks;
        },
        basePreview: ActionResourcePreview,
        targetId?: string
    ): ActionResourcePreview {
        const modeBefore = resolveCombatPressureMode(gameState);
        const config = resolveIresRuleset(gameState.ruleset);
        const hydratedActor = ensureActorIres(actor, config);
        const current = hydratedActor.ires!;
        const profile = resolveRuntimeSkillResourceProfile(skillDef.id, skillDef, gameState.ruleset);
        const isPureMovement = profile.countsAsMovement && !profile.countsAsAction;
        const travelEligibleByProfile = profile.travelEligible ?? isPureMovement;
        const travelEligible =
            config.travelModeEnabled
            && hydratedActor.id === gameState.player.id
            && travelEligibleByProfile
            && (!config.travelMovementOnly || isPureMovement);

        let modeAfter = modeBefore;
        if (hydratedActor.id === gameState.player.id && profile.countsAsMovement) {
            const predictedState = recomputeVisibility(applyEffects(gameState, execution.effects, {
                sourceId: hydratedActor.id,
                targetId,
                stackReactions: execution.stackReactions
            }));
            modeAfter = resolveCombatPressureMode(predictedState);
        }

        if (!travelEligible) {
            return {
                ...basePreview,
                modeBefore,
                modeAfter,
                travelRecoveryApplied: false,
                travelRecoverySuppressedReason: modeBefore !== 'travel'
                    ? 'not_travel'
                    : (travelEligibleByProfile ? 'not_pure_movement' : 'not_travel_eligible')
            };
        }

        if (modeBefore !== 'travel') {
            return {
                ...basePreview,
                modeBefore,
                modeAfter,
                travelRecoveryApplied: false,
                travelRecoverySuppressedReason: 'not_travel'
            };
        }

        if (modeAfter !== 'travel') {
            return {
                ...basePreview,
                modeBefore,
                modeAfter,
                travelRecoveryApplied: false,
                travelRecoverySuppressedReason: 'alert_triggered'
            };
        }

        const sparkProjected = this.clamp(current.spark + basePreview.sparkDelta + config.travelSparkRecovery, 0, current.maxSpark);
        const manaProjected = this.clamp(
            current.mana + basePreview.manaDelta + config.travelManaRecovery,
            0,
            current.maxMana
        );
        const projectedState = resolveExhaustionState({
            ...current,
            spark: sparkProjected,
            mana: manaProjected,
            exhaustion: 0
        }, config);

        return {
            ...basePreview,
            sparkDelta: sparkProjected - current.spark,
            manaDelta: manaProjected - current.mana,
            exhaustionDelta: projectedState.exhaustion - current.exhaustion,
            nextActionCount: 0,
            bandAfter: projectedState.currentState,
            sparkBurnHpDelta: 0,
            sparkBurnOutcome: basePreview.sparkBurnOutcome === 'burn_now' ? 'travel_suppressed' : basePreview.sparkBurnOutcome,
            modeBefore,
            modeAfter,
            travelRecoveryApplied: true,
            travelRecoverySuppressedReason: undefined,
            turnProjection: {
                spark: {
                    current: current.spark,
                    projected: sparkProjected,
                    delta: sparkProjected - current.spark
                },
                mana: {
                    current: current.mana,
                    projected: manaProjected,
                    delta: manaProjected - current.mana
                },
                exhaustion: {
                    current: current.exhaustion,
                    projected: projectedState.exhaustion,
                    delta: projectedState.exhaustion - current.exhaustion
                },
                sparkStateBefore: current.currentState,
                sparkStateAfter: projectedState.currentState,
                projectedSparkRecoveryIfEndedNow: computeSparkRecoveryIfEndedNow(hydratedActor, projectedState, config),
                stateAfter: projectedState.currentState,
                actionCountAfter: 0,
                wouldRest: false
            }
        };
    }

    private static resolveExecution(intent: Intent, actor: Actor, gameState: GameState): TacticalResolution {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        // 1. Validation (Cooldowns, Resources)
        // Note: Strategy should ideally check this, but we double-check here.
        const skillDef = SkillRegistry.get(intent.skillId);
        if (!skillDef && intent.type !== 'WAIT') {
            // Fallback
            return { effects: [], messages: [`Failed to execute unknown skill: ${intent.skillId}`], consumesTurn: false, turnOutcome: 'reject' };
        }

        if (intent.type === 'WAIT') {
            return {
                effects: [],
                messages: [],
                consumesTurn: true,
                turnOutcome: 'end',
                resourcePreview: resolveWaitPreview(actor, gameState.ruleset, resolveCombatPressureMode(gameState))
            };
        }

        // VALIDATE LOADOUT: Non-wait intents may only execute actor-owned skills.
        const hasSkill = intent.skillId === 'WAIT_SKILL' ||
            actor.activeSkills.some(s => s.id === intent.skillId);

        if (!hasSkill) {
            return {
                effects: [],
                messages: [`Actor ${actor.id} does not have skill ${intent.skillId} in loadout!`],
                consumesTurn: false,
                turnOutcome: 'reject'
            };
        }

        const actorSkill = actor.activeSkills.find(s => s.id === intent.skillId);
        const cooldownsBypassed = actor.factionId === 'player' && isFreeMoveMode(gameState);
        if (!cooldownsBypassed && actorSkill && (actorSkill.currentCooldown || 0) > 0) {
            return {
                effects: [],
                messages: [`${intent.skillId} is on cooldown (${actorSkill.currentCooldown}).`],
                consumesTurn: actor.type === 'player' ? false : true,
                turnOutcome: 'reject'
            };
        }

        const targetPattern = skillDef?.intentProfile?.target?.pattern;
        // 2. Target Resolution (Search Phase)
        let targetHex = intent.targetHex;
        let finalTargetId = intent.primaryTargetId;

        // Self-pattern skills are valid when targeting self even if no explicit target was provided.
        if (!targetHex && targetPattern === 'self') {
            targetHex = actor.position;
        }

        // If no target specified but skill requires one, find the optimal hex
        if (!targetHex && skillDef) {
            targetHex = this.findOptimalTargetHex(intent, actor, gameState, skillDef.baseVariables.range);
        }

        if (!targetHex) {
            // Failed to find target
            return {
                effects: [],
                messages: [`No valid target found for ${intent.skillId}`],
                consumesTurn: actor.id === gameState.player.id ? false : true,
                turnOutcome: 'reject'
            };
        }

        if (skillDef?.getValidTargets) {
            const validTargets = skillDef.getValidTargets(gameState, actor.position);
            if (validTargets.length === 0) {
                const isSelfTarget = targetHex.q === actor.position.q
                    && targetHex.r === actor.position.r
                    && targetHex.s === actor.position.s;
                if (targetPattern === 'self' && isSelfTarget) {
                    // Continue to execution for self-pattern skills with empty explicit target lists.
                    finalTargetId = finalTargetId || actor.id;
                } else {
                    const probeMessages = this.getInvalidTargetProbeMessages(skillDef, gameState, actor, targetHex, actorSkill?.activeUpgrades || []);
                    return {
                        effects: [],
                        messages: [
                            `Invalid target for ${intent.skillId}.`,
                            ...probeMessages
                        ],
                        consumesTurn: actor.id === gameState.player.id ? false : true,
                        turnOutcome: 'reject'
                    };
                }
            } else {
                const isValidTarget = validTargets.some(point =>
                    point.q === targetHex!.q && point.r === targetHex!.r && point.s === targetHex!.s
                );
                if (isValidTarget) {
                    // Continue to execution.
                } else {
                    const probeMessages = this.getInvalidTargetProbeMessages(skillDef, gameState, actor, targetHex, actorSkill?.activeUpgrades || []);
                    return {
                        effects: [],
                        messages: [
                            `Invalid target for ${intent.skillId}.`,
                            ...probeMessages
                        ],
                        consumesTurn: actor.id === gameState.player.id ? false : true,
                        turnOutcome: 'reject'
                    };
                }
            }
        }

        // AUTO-DETECT: If we have a hex but no ID, resolve ID from hex.
        if (targetHex && !finalTargetId) {
            const found = getActorAt(gameState, targetHex);
            if (found) finalTargetId = found.id;
        }

        const finalTargetActor = this.resolveActorById(gameState, finalTargetId)
            || (targetHex ? getActorAt(gameState, targetHex) : undefined);
        if (
            actor.id === gameState.player.id
            && finalTargetActor
            && finalTargetActor.factionId !== actor.factionId
            && !this.ignoresPlayerPerception(intent.skillId)
            && gameState.visibility
        ) {
            const visible = new Set(gameState.visibility.playerFog.visibleActorIds || []);
            const detected = new Set(gameState.visibility.playerFog.detectedActorIds || []);
            if (!visible.has(finalTargetActor.id) && !detected.has(finalTargetActor.id)) {
                return {
                    effects: [],
                    messages: [`Target ${finalTargetActor.id} is outside your current perception.`],
                    consumesTurn: false,
                    turnOutcome: 'reject'
                };
            }
        }

        const runtimeSkillProfile = skillDef
            ? resolveRuntimeSkillResourceProfile(skillDef.id, skillDef, gameState.ruleset)
            : undefined;
        const baseResourcePreview = resolveIresActionPreview(
            actor,
            intent.skillId,
            runtimeSkillProfile || skillDef?.resourceProfile,
            gameState.ruleset,
            resolveCombatPressureMode(gameState),
            skillDef
        );
        if (baseResourcePreview.blockedReason) {
            return {
                effects: [],
                messages: [baseResourcePreview.blockedReason],
                consumesTurn: actor.id === gameState.player.id ? false : true,
                turnOutcome: 'reject',
                resourcePreview: baseResourcePreview
            };
        }

        // 3. Execution (Atomic Effects)
        // Find the specific skill instance on the actor to get upgrades
        const upgrades = actorSkill?.activeUpgrades || [];

        const execution = skillDef!.execute(gameState, actor, targetHex, upgrades);
        const resourcePreview = this.adjustResourcePreviewForCombatPressure(
            gameState,
            actor,
            skillDef!,
            execution,
            baseResourcePreview,
            finalTargetId
        );
        const turnOutcome = execution.turnOutcome
            || (execution.consumesTurn === false && execution.effects.length === 0 ? 'reject' : 'continue');
        if (turnOutcome === 'reject') {
            return {
                effects: execution.effects,
                messages: [...messages, ...execution.messages],
                consumesTurn: execution.consumesTurn ?? false,
                rngConsumption: execution.rngConsumption || 0,
                targetId: finalTargetId,
                kills: execution.kills || 0,
                stackReactions: execution.stackReactions,
                turnOutcome,
                resourcePreview
            };
        }

        const executionEffects = [...effects];
        const actionCountDelta = resourcePreview.nextActionCount - (actor.ires?.actionCountThisTurn || 0);
        if (
            resourcePreview.sparkDelta
            || resourcePreview.manaDelta
            || resourcePreview.exhaustionDelta
            || actionCountDelta
            || resourcePreview.travelRecoveryApplied
        ) {
            executionEffects.push({
                type: 'ApplyResources',
                target: actor.id,
                sparkDelta: resourcePreview.sparkDelta,
                manaDelta: resourcePreview.manaDelta,
                exhaustionDelta: resourcePreview.exhaustionDelta,
                actionCountDelta,
                sparkBurnActionsThisTurnDelta: resourcePreview.sparkBurnHpDelta > 0 ? 1 : 0,
                movedThisTurn: resourcePreview.travelRecoveryApplied ? false : (runtimeSkillProfile?.countsAsMovement || false),
                actedThisTurn: resourcePreview.travelRecoveryApplied ? false : (runtimeSkillProfile?.countsAsAction || false),
                resetTurnFlags: resourcePreview.travelRecoveryApplied || undefined,
                debug: {
                    skillId: intent.skillId,
                    actionKind: resourcePreview.travelRecoveryApplied
                        ? 'travel'
                        : (runtimeSkillProfile?.countsAsMovement ? 'move' : 'action'),
                    tax: resourcePreview.tax,
                    effectiveBfi: resourcePreview.effectiveBfi,
                    tempoSparkCost: resourcePreview.tempoSparkCost,
                    skillSparkSurcharge: resourcePreview.skillSparkSurcharge,
                    sparkCostTotal: resourcePreview.sparkCostTotal,
                    manaCost: resourcePreview.manaCost,
                    sparkBurnOutcome: resourcePreview.sparkBurnOutcome,
                    sparkBurnHpDelta: resourcePreview.sparkBurnHpDelta
                }
            });
        }
        if (resourcePreview.sparkBurnHpDelta > 0) {
            executionEffects.push({
                type: 'Damage',
                target: actor.id,
                amount: resourcePreview.sparkBurnHpDelta,
                reason: 'spark_burn',
                damageClass: 'true',
                damageSubClass: 'status',
                damageElement: 'neutral'
            });
        }
        executionEffects.push(...execution.effects);

        if (execution.consumesTurn !== false && !cooldownsBypassed) {
            const heldPosition = !!(actor.previousPosition && hexEquals(actor.previousPosition, actor.position));
            const resolvedSkill = resolveVirtualSkillDefinition(skillDef!, upgrades, { heldPosition });
            let cooldown = resolvedSkill.skill.baseVariables.cooldown || 0;
            cooldown = Math.max(0, cooldown);
            if (cooldown > 0) {
                executionEffects.push({
                    type: 'ModifyCooldown',
                    skillId: intent.skillId as any,
                    // Cooldowns are ticked at end of turn, so add one turn to preserve authored values.
                    amount: cooldown + 1,
                    setExact: true
                });
            }
        }

        return {
            effects: executionEffects,
            messages: [...messages, ...execution.messages],
            consumesTurn: execution.consumesTurn ?? true,
            rngConsumption: execution.rngConsumption || 0,
            targetId: finalTargetId,
            kills: execution.kills || 0,
            stackReactions: execution.stackReactions,
            turnOutcome,
            resourcePreview
        };
    }

    private static getInvalidTargetProbeMessages(
        skillDef: NonNullable<ReturnType<typeof SkillRegistry.get>>,
        gameState: GameState,
        actor: Actor,
        targetHex: Point,
        upgrades: string[]
    ): string[] {
        try {
            const probe = skillDef.execute(gameState, actor, targetHex, upgrades);
            if (probe.consumesTurn !== false || !Array.isArray(probe.messages)) {
                return [];
            }
            const seen = new Set<string>();
            const out: string[] = [];
            for (const message of probe.messages) {
                if (typeof message !== 'string') continue;
                const trimmed = message.trim();
                if (!trimmed || seen.has(trimmed)) continue;
                seen.add(trimmed);
                out.push(trimmed);
            }
            return out;
        } catch {
            return [];
        }
    }

    /**
     * Search Phase: Finds the best hex to target/move to.
     * Uses strict determinism.
     */
    private static findOptimalTargetHex(intent: Intent, _actor: Actor, gameState: GameState, _range: number): Point | undefined {
        // 1. Candidate Selection: Reachable hexes (or attackable hexes)
        // This depends on Intent Type.
        // For MOVE: Reachable hexes.
        // For ATTACK: Hexes with enemies in range.

        // Simplified implementation for now:
        // Use BFS for Move range? Or just scan neighbors for Attack?

        // Let's assume ATTACK for now (common case where target is implicit in "Attack Closest")
        // But Intent usually has a TargetID if it's an attack.
        // If Intent has NO TargetHex and NO TargetID, it's ambiguous.
        // The Strategy should really provide a Target.

        // However, the User Request mentioned: "Search (If No Hex Specified)... Check if Target is in Skill Range."
        // This implies primaryTargetId might be set, but not the Hex?

        if (intent.primaryTargetId) {
            const targetUnit = gameState.enemies.find(e => e.id === intent.primaryTargetId) ||
                (gameState.player.id === intent.primaryTargetId ? gameState.player : undefined);

            if (targetUnit) {
                // If the skill is ranged/targeted, the "targetHex" is the Unit's hex.
                // UNLESS it's a "Move to Range" intent?
                // The Intent Type clarifies.
                if (intent.type === 'ATTACK' || intent.type === 'USE_SKILL') {
                    return targetUnit.position;
                }
            }
        }

        return undefined; // TODO: Implement full search if needed
    }
}
