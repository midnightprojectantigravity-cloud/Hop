import { describe, expect, it } from 'vitest';
import { hexEquals } from '../hex';
import { generateInitialState } from '../logic';
import { SkillRegistry } from '../skillRegistry';
import { applyEffects } from '../systems/effect-engine';
import {
    validateMovementTargetParity,
    validateSkillTargetParity
} from '../systems/targeting-path-parity';
import type { AtomicEffect } from '../types';
import { createMockState, p, placeTile } from './test_utils';

describe('targeting/path parity', () => {
    it('accepts a valid BASIC_MOVE target for both skill and movement parity', () => {
        const state = generateInitialState(1, 'target-path-parity-basic-move');
        const targets = SkillRegistry.get('BASIC_MOVE')!.getValidTargets!(state, state.player.position);
        expect(targets.length).toBeGreaterThan(0);

        const target = targets[0]!;
        const base = validateSkillTargetParity(state, state.player.id, 'BASIC_MOVE', target);
        const movement = validateMovementTargetParity(state, state.player.id, 'BASIC_MOVE', target);

        expect(base.ok).toBe(true);
        expect(movement.ok).toBe(true);
    });

    it('rejects an invalid target that is not listed by getValidTargets', () => {
        const state = generateInitialState(1, 'target-path-parity-invalid-target');
        const result = validateSkillTargetParity(state, state.player.id, 'BASIC_MOVE', state.player.position);
        expect(result.ok).toBe(false);
        expect(result.bucket).toBe('target_invalid_but_listed');
    });

    it('keeps listed movement targets previewable for movement skills in current loadout', () => {
        const state = generateInitialState(1, 'target-path-parity-loadout');
        const movementSkills = state.player.activeSkills
            .map(skill => skill.id)
            .filter((id): id is 'BASIC_MOVE' | 'DASH' | 'JUMP' => id === 'BASIC_MOVE' || id === 'DASH' || id === 'JUMP');

        for (const skillId of movementSkills) {
            const targets = SkillRegistry.get(skillId)!.getValidTargets!(state, state.player.position);
            if (!targets.length) continue;
            const result = validateMovementTargetParity(state, state.player.id, skillId, targets[0]!);
            expect(result.ok).toBe(true);
        }
    });

    it('routes BASIC_MOVE around snare interrupts when an alternate path exists', () => {
        const state = createMockState();
        state.player = {
            ...state.player,
            position: p(5, 3),
            previousPosition: p(5, 3)
        };

        for (let q = 0; q < 9; q++) {
            for (let r = 0; r < 11; r++) {
                placeTile(state, p(q, r), [], 'STONE');
            }
        }

        const snare = p(3, 4);
        const target = p(2, 5);
        state.tiles.get(`${snare.q},${snare.r}`)!.effects = [{ id: 'SNARE', duration: -1, potency: 1 }];

        const moveDef = SkillRegistry.get('BASIC_MOVE')!;
        const validTargets = moveDef.getValidTargets!(state, state.player.position);
        expect(validTargets).toContainEqual(target);

        const execution = moveDef.execute(state, state.player, target);
        expect(execution.consumesTurn).toBe(true);
        const displacement = execution.effects.find(
            (effect): effect is Extract<AtomicEffect, { type: 'Displacement' }> => effect.type === 'Displacement'
        );
        expect(displacement?.path?.some(point => hexEquals(point, snare))).toBe(false);

        const next = applyEffects(state, execution.effects, { sourceId: state.player.id });
        expect(next.player.position).toEqual(target);
        expect(next.player.statusEffects.some(status => status.type === 'rooted')).toBe(false);
    });
});
