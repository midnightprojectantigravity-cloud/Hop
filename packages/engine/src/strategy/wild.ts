import type { IStrategyProvider, Intent } from '../types/intent';
import type { GameState, Actor } from '../types';
import { decideEnemyIntent } from '../systems/ai';
import { getNeighbors, hexDistance } from '../hex';
import { getActorAt } from '../helpers';
import { UnifiedTileService } from '../systems/tiles/unified-tile-service';
import { SpatialSystem } from '../systems/spatial-system';

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

        const playerPos = gameState.player.position;
        return decideEnemyIntent(
            actor,
            playerPos,
            { ...gameState, occupiedCurrentTurn: gameState.occupiedCurrentTurn }
        );
    }
}
