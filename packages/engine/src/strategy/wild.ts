import type { IStrategyProvider, Intent, IntentType } from '../types/intent';
import type { GameState, Actor } from '../types';
import { computeEnemyAction } from '../systems/ai';
import { SkillRegistry } from '../skillRegistry';
import { getNeighbors, hexDistance, hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { UnifiedTileService } from '../systems/unified-tile-service';
import { SpatialSystem } from '../systems/SpatialSystem';

export class WildStrategy implements IStrategyProvider {
    private getFalconIntent(gameState: GameState, actor: Actor): Intent {
        const mode = actor.companionState?.mode || 'roost';
        const hunter = actor.companionOf === gameState.player.id
            ? gameState.player
            : gameState.enemies.find(e => e.id === actor.companionOf);

        const baseMetadata = {
            expectedValue: 0,
            reasoningCode: `FALCON_${mode.toUpperCase()}`,
            isGhost: false,
            rngConsumption: 0
        };

        if (mode === 'scout') {
            return {
                type: 'USE_SKILL',
                actorId: actor.id,
                skillId: 'FALCON_SCOUT',
                targetHex: actor.position,
                priority: 10,
                metadata: baseMetadata
            };
        }

        if (mode === 'predator' && typeof actor.companionState?.markTarget === 'string') {
            const prey = gameState.enemies.find(e => e.id === actor.companionState!.markTarget && e.hp > 0);
            if (!prey) {
                return {
                    type: 'USE_SKILL',
                    actorId: actor.id,
                    skillId: 'FALCON_AUTO_ROOST',
                    targetHex: actor.position,
                    priority: 9,
                    metadata: { ...baseMetadata, reasoningCode: 'FALCON_AUTO_ROOST' }
                };
            }

            const dist = hexDistance(actor.position, prey.position);
            if (dist <= 4) {
                return {
                    type: 'USE_SKILL',
                    actorId: actor.id,
                    skillId: 'FALCON_APEX_STRIKE',
                    targetHex: prey.position,
                    primaryTargetId: prey.id,
                    priority: 10,
                    metadata: baseMetadata
                };
            }
            if (dist <= 1) {
                return {
                    type: 'USE_SKILL',
                    actorId: actor.id,
                    skillId: 'FALCON_PECK',
                    targetHex: prey.position,
                    primaryTargetId: prey.id,
                    priority: 9,
                    metadata: baseMetadata
                };
            }
            return {
                type: 'MOVE',
                actorId: actor.id,
                skillId: 'BASIC_MOVE',
                targetHex: this.findStepToward(gameState, actor, prey.position),
                primaryTargetId: prey.id,
                priority: 7,
                metadata: baseMetadata
            };
        }

        if (hunter) {
            const distToHunter = hexDistance(actor.position, hunter.position);
            if (distToHunter <= 1) {
                return {
                    type: 'USE_SKILL',
                    actorId: actor.id,
                    skillId: 'FALCON_HEAL',
                    targetHex: hunter.position,
                    primaryTargetId: hunter.id,
                    priority: 10,
                    metadata: baseMetadata
                };
            }
            return {
                type: 'MOVE',
                actorId: actor.id,
                skillId: 'BASIC_MOVE',
                targetHex: this.findStepToward(gameState, actor, hunter.position),
                primaryTargetId: hunter.id,
                priority: 7,
                metadata: baseMetadata
            };
        }

        return {
            type: 'WAIT',
            actorId: actor.id,
            skillId: 'WAIT_SKILL',
            priority: 1,
            metadata: { ...baseMetadata, reasoningCode: 'FALCON_WAIT' }
        };
    }

    private findStepToward(gameState: GameState, actor: Actor, target: { q: number; r: number; s: number }) {
        const neighbors = getNeighbors(actor.position)
            .filter(p => SpatialSystem.isWithinBounds(gameState, p))
            .filter(p => UnifiedTileService.isWalkable(gameState, p))
            .filter(p => {
                const occ = getActorAt(gameState, p);
                return !occ || occ.id === actor.id;
            });

        if (neighbors.length === 0) return actor.position;
        return neighbors.sort((a, b) => hexDistance(a, target) - hexDistance(b, target))[0];
    }

    getIntent(gameState: GameState, actor: Actor): Intent {
        if (actor.subtype === 'falcon') {
            return this.getFalconIntent(gameState, actor);
        }
        if (actor.subtype === 'bomb') {
            return {
                type: 'USE_SKILL',
                actorId: actor.id,
                skillId: 'TIME_BOMB',
                targetHex: actor.position,
                priority: 10,
                metadata: {
                    expectedValue: 0,
                    reasoningCode: 'BOMB_FUSE_TICK',
                    isGhost: false,
                    rngConsumption: 0
                }
            };
        }

        // 1. Prepare inputs for legacy AI
        // computeEnemyAction expects the player's *current* position (after they moved)
        // In the new turn order, the player might have already moved.
        const playerPos = gameState.player.position;

        // 2. Run the legacy AI simulation
        // We pass the current state. computeEnemyAction is pure-ish (returns new state/entity), 
        // so it won't mutate our input 'gameState'.
        // However, it consumes RNG from the state passed in. This is fine for the "Brain" decision.
        const result = computeEnemyAction(
            actor,
            playerPos,
            { ...gameState, occupiedCurrentTurn: gameState.occupiedCurrentTurn }
        );

        const { entity: plannedActor, message } = result;

        // 3. Map legacy "intent" string to new Intent object
        let type: IntentType = 'WAIT';
        let skillId = 'WAIT_SKILL';
        let targetHex: any = undefined; // Use Point or undefined
        let primaryTargetId = undefined;
        let priority = 10;

        // Legacy intents: 'Moving', 'BASIC_ATTACK', 'SPEAR_THROW', 'Bombing', 'SENTINEL_BLAST', etc.
        const legacyIntent = plannedActor.intent || 'Waiting';

        if (legacyIntent === 'Moving' || legacyIntent === 'Advancing' || legacyIntent === 'Repositioning' || legacyIntent === 'Lumbering') {
            type = 'MOVE';
            skillId = 'BASIC_MOVE';
            targetHex = plannedActor.position; // The AI returns the final position it wants to be at
        } else if (legacyIntent === 'BASIC_ATTACK') {
            type = 'ATTACK';
            skillId = 'BASIC_ATTACK';
            targetHex = plannedActor.intentPosition;
            if (targetHex) {
                // Try to resolve unit ID at target hex
                const targetUnit = gameState.player.position.q === targetHex.q && gameState.player.position.r === targetHex.r
                    ? gameState.player
                    : gameState.enemies.find(e => e.position.q === targetHex?.q && e.position.r === targetHex?.r);
                if (targetUnit && targetUnit.factionId !== actor.factionId) {
                    primaryTargetId = targetUnit.id;
                }
            }
        } else if (legacyIntent === 'SPEAR_THROW') {
            type = 'USE_SKILL';
            skillId = 'SPEAR_THROW';
            targetHex = plannedActor.intentPosition;
        } else if (legacyIntent === 'DASH') {
            type = 'USE_SKILL';
            skillId = 'DASH';
            targetHex = plannedActor.intentPosition;
        } else if (legacyIntent === 'GRAPPLE_HOOK') {
            type = 'USE_SKILL';
            skillId = 'GRAPPLE_HOOK';
            targetHex = plannedActor.intentPosition;
        } else if (legacyIntent === 'Bombing') {
            type = 'USE_SKILL';
            skillId = 'BOMB_TOSS'; // Assuming skill ID
            targetHex = plannedActor.intentPosition;
        } else if (legacyIntent === 'SENTINEL_BLAST') {
            type = 'USE_SKILL';
            skillId = 'SENTINEL_BLAST';
            targetHex = plannedActor.intentPosition;
        } else if (legacyIntent === 'SENTINEL_TELEGRAPH') {
            type = 'USE_SKILL';
            skillId = 'SENTINEL_TELEGRAPH';
            targetHex = plannedActor.intentPosition;
        } else if (legacyIntent === 'Charging Power' || legacyIntent === 'Preparing') {
            type = 'WAIT';
            skillId = 'WAIT_SKILL';
        }

        // Validate intent against skill loadout + valid targets to avoid zero-effect loops.
        const hasSkill = skillId === 'WAIT_SKILL'
            || actor.activeSkills?.some(s => s.id === skillId);

        if (!hasSkill) {
            type = 'WAIT';
            skillId = 'WAIT_SKILL';
            targetHex = undefined;
            primaryTargetId = undefined;
        } else if (skillId !== 'WAIT_SKILL') {
            const def = SkillRegistry.get(skillId);
            if (def?.getValidTargets && targetHex) {
                const validTargets = def.getValidTargets(gameState, actor.position);
                const isValid = validTargets.some(v => hexEquals(v, targetHex));
                if (!isValid) {
                    type = 'WAIT';
                    skillId = 'WAIT_SKILL';
                    targetHex = undefined;
                    primaryTargetId = undefined;
                }
            }
        }

        return {
            type,
            actorId: actor.id,
            skillId,
            primaryTargetId,
            targetHex,
            priority,
            metadata: {
                expectedValue: 0, // Legacy AI doesn't give a score easily
                reasoningCode: legacyIntent.toUpperCase().replace(' ', '_'),
                isGhost: false,
                // Track RNG consumed during decision making to ensure TacticalEngine doesn't reuse same values
                rngConsumption: (message?.includes('teleports') || message?.includes('Bombing')) ?
                    ((result.nextState.rngCounter || 0) - (gameState.rngCounter || 0)) :
                    ((result.nextState.rngCounter || 0) - (gameState.rngCounter || 0))
            }
        };
    }
}
