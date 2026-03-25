import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { gameReducer, generateInitialState } from '../logic';
import { previewActionOutcome, resolveMovementPreviewPath } from '../systems/action-preview';
import { buildInitiativeQueue } from '../systems/initiative';
import { SpatialSystem } from '../systems/spatial-system';
import { resolveCombatPressureMode } from '../systems/free-move';
import { recomputeVisibility, recomputeVisibilityFromScratch } from '../systems/visibility';
import { getSkillDefinition } from '../skillRegistry';
import { createMockState, p, placeTile } from './test_utils';

describe('action preview dry run', () => {
    it('simulates outcome without mutating live state', () => {
        const state = generateInitialState(1, 'preview-seed-01');
        const enemy = state.enemies[0]!;
        const playerPos = createHex(4, 5);
        const enemyPos = createHex(5, 5);
        const positioned = recomputeVisibilityFromScratch({
            ...state,
            player: { ...state.player, position: playerPos },
            enemies: state.enemies.map((e, idx) => idx === 0 ? { ...e, position: enemyPos } : e)
        });
        const beforeHp = positioned.enemies[0]!.hp;

        const result = previewActionOutcome(positioned, {
            actorId: positioned.player.id,
            skillId: 'BASIC_ATTACK',
            target: enemyPos
        });

        expect(result.ok).toBe(true);
        expect(result.predictedState).toBeTruthy();
        expect(positioned.enemies[0]!.hp).toBe(beforeHp);
        const previewEnemy = result.predictedState!.enemies.find(e => e.id === enemy.id);
        if (previewEnemy) {
            expect(previewEnemy.hp).toBeLessThan(beforeHp);
        } else {
            expect(true).toBe(true);
        }
        expect(result.simulationEvents.some(e => e.type === 'DamageTaken')).toBe(true);
        expect(result.stackTrace.length).toBeGreaterThan(0);
    });

    it('rejects invalid targets before simulation', () => {
        const state = generateInitialState(1, 'preview-seed-02');
        const result = previewActionOutcome(state, {
            actorId: state.player.id,
            skillId: 'BASIC_ATTACK',
            target: createHex(8, 8)
        });

        expect(result.ok).toBe(false);
        expect(result.reason?.toLowerCase()).toContain('invalid');
    });

    it('reports travel-settled movement metadata when alert is off', () => {
        const base = generateInitialState(1, 'preview-travel-settle');
        const positioned = recomputeVisibilityFromScratch({
            ...base,
            enemies: [],
            initiativeQueue: buildInitiativeQueue({ ...base, enemies: [] }),
            occupancyMask: SpatialSystem.refreshOccupancyMask({ ...base, enemies: [] })
        });
        const target = getSkillDefinition('BASIC_MOVE')!.getValidTargets!(positioned, positioned.player.position)[0]!;
        const result = previewActionOutcome(positioned, {
            actorId: positioned.player.id,
            skillId: 'BASIC_MOVE',
            target
        });

        expect(result.ok).toBe(true);
        expect(resolveCombatPressureMode(positioned)).toBe('travel');
        expect(result.resourcePreview?.modeBefore).toBe('travel');
        expect(result.resourcePreview?.modeAfter).toBe('travel');
        expect(result.resourcePreview?.travelRecoveryApplied).toBe(true);
    });

    it('reports alert-trigger suppression when a movement preview opens combat', () => {
        const base = generateInitialState(1, 'travel-flip-search');
        const playerPos = createHex(4, 8);
        const enemyPos = createHex(0, 2);
        const seeded = {
            ...base,
            player: { ...base.player, position: playerPos, previousPosition: playerPos },
            enemies: [{ ...base.enemies[0]!, position: enemyPos, previousPosition: enemyPos, hp: 99, maxHp: 99 }]
        };
        const positioned = gameReducer(recomputeVisibilityFromScratch({
            ...seeded,
            initiativeQueue: buildInitiativeQueue(seeded),
            occupancyMask: SpatialSystem.refreshOccupancyMask(seeded)
        }), { type: 'ADVANCE_TURN' });
        const target = createHex(4, 2);
        const result = previewActionOutcome(positioned, {
            actorId: positioned.player.id,
            skillId: 'BASIC_MOVE',
            target
        });

        expect(result.ok).toBe(true);
        expect(result.resourcePreview?.modeBefore).toBe('travel');
        expect(result.resourcePreview?.modeAfter).toBe('battle');
        expect(result.resourcePreview?.travelRecoveryApplied).toBe(false);
        expect(result.resourcePreview?.travelRecoverySuppressedReason).toBe('alert_triggered');
    });

    it('trims DASH movement preview to the snare interrupt tile', () => {
        const state = createMockState();
        state.player = {
            ...state.player,
            position: p(4, 4),
            previousPosition: p(4, 4)
        };

        for (let q = 0; q < 10; q++) {
            for (let r = 0; r < 10; r++) {
                placeTile(state, p(q, r), [], 'STONE');
            }
        }

        const snare = p(5, 4);
        const target = p(6, 4);
        state.tiles.get(`${snare.q},${snare.r}`)!.effects = [{ id: 'SNARE', duration: -1, potency: 1 }];

        const preview = previewActionOutcome(state, {
            actorId: state.player.id,
            skillId: 'DASH',
            target
        });
        expect(preview.ok).toBe(true);
        expect(preview.predictedState?.player.position).toEqual(snare);

        const movement = resolveMovementPreviewPath(state, state.player, 'DASH', target);
        expect(movement.ok).toBe(true);
        expect(movement.destination).toEqual(snare);
        expect(movement.path).toEqual([
            p(4, 4),
            snare
        ]);
    });
});
