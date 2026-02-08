import type { Intent } from '../types/intent';
import type { GameState, Actor, AtomicEffect, Point } from '../types';
import { SkillRegistry } from '../skillRegistry';
import { getActorAt } from '../helpers';

/**
 * Layer 3: The Tactical Executor (The "Body").
 * Pure & Deterministic execution of an Intent.
 */
export class TacticalEngine {
    static execute(intent: Intent, actor: Actor, gameState: GameState): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean; targetId?: string; kills?: number } {
        const result = this.resolveExecution(intent, actor, gameState);
        return result;
    }

    /**
     * Layer 3b: The Simulator (The "Ghost").
     * Validates what WOULD happen without mutating the state.
     */
    static simulate(intent: Intent, actor: Actor, gameState: GameState): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean; targetId?: string; kills?: number } {
        // Since getValidTargets and execute are pure, we just call the same logic.
        return this.resolveExecution(intent, actor, gameState);
    }

    private static resolveExecution(intent: Intent, actor: Actor, gameState: GameState): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean; targetId?: string; kills?: number } {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        // 1. Validation (Cooldowns, Resources)
        // Note: Strategy should ideally check this, but we double-check here.
        const skillDef = SkillRegistry.get(intent.skillId);
        if (!skillDef && intent.type !== 'WAIT') {
            // Fallback
            return { effects: [], messages: [`Failed to execute unknown skill: ${intent.skillId}`], consumesTurn: false };
        }

        if (intent.type === 'WAIT') {
            return { effects: [], messages: [], consumesTurn: true };
        }

        // VALIDATE LOADOUT: Non-wait intents may only execute actor-owned skills.
        const hasSkill = intent.skillId === 'WAIT_SKILL' ||
            actor.activeSkills.some(s => s.id === intent.skillId);

        if (!hasSkill) {
            return {
                effects: [],
                messages: [`Actor ${actor.id} does not have skill ${intent.skillId} in loadout!`],
                consumesTurn: false
            };
        }

        // 2. Target Resolution (Search Phase)
        let targetHex = intent.targetHex;
        let finalTargetId = intent.primaryTargetId;

        // If no target specified but skill requires one, find the optimal hex
        if (!targetHex && skillDef) {
            targetHex = this.findOptimalTargetHex(intent, actor, gameState, skillDef.baseVariables.range);
        }

        if (!targetHex) {
            // Failed to find target
            return { effects: [], messages: [`No valid target found for ${intent.skillId}`], consumesTurn: false };
        }

        // AUTO-DETECT: If we have a hex but no ID, resolve ID from hex.
        if (targetHex && !finalTargetId) {
            const found = getActorAt(gameState, targetHex);
            if (found) finalTargetId = found.id;
        }

        // 3. Execution (Atomic Effects)
        // Find the specific skill instance on the actor to get upgrades
        const actorSkill = actor.activeSkills.find(s => s.id === intent.skillId);
        const upgrades = actorSkill?.activeUpgrades || [];

        const execution = skillDef!.execute(gameState, actor, targetHex, upgrades);

        return {
            effects: [...effects, ...execution.effects],
            messages: [...messages, ...execution.messages],
            consumesTurn: execution.consumesTurn ?? true,
            targetId: finalTargetId,
            kills: execution.kills || 0
        };
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
