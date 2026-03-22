import { describe, expect, it } from 'vitest';
import { generateInitialState } from '../logic';
import { SkillRegistry } from '../skillRegistry';
import {
    validateMovementTargetParity,
    validateSkillTargetParity
} from '../systems/targeting-path-parity';

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
});
