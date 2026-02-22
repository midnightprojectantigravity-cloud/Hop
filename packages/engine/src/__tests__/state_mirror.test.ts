import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { generateInitialState } from '../logic';
import { buildEngineMirrorSnapshot, validateStateMirrorSnapshot } from '../systems/state-mirror';

describe('state mirror validation', () => {
    it('passes when UI snapshot matches engine snapshot', () => {
        const state = generateInitialState(1, 'mirror-seed-01');
        const engineSnapshot = buildEngineMirrorSnapshot(state);
        const uiSnapshot = buildEngineMirrorSnapshot(state);

        const result = validateStateMirrorSnapshot(engineSnapshot, uiSnapshot);
        expect(result.ok).toBe(true);
        expect(result.mismatches.length).toBe(0);
    });

    it('reports mismatches for position drift and missing actor', () => {
        const state = generateInitialState(1, 'mirror-seed-02');
        const engineSnapshot = buildEngineMirrorSnapshot(state);
        const uiSnapshot = buildEngineMirrorSnapshot(state);

        uiSnapshot.actors[0] = {
            ...uiSnapshot.actors[0]!,
            position: createHex(uiSnapshot.actors[0]!.position.q + 1, uiSnapshot.actors[0]!.position.r)
        };
        uiSnapshot.actors.pop();

        const result = validateStateMirrorSnapshot(engineSnapshot, uiSnapshot);
        expect(result.ok).toBe(false);
        expect(result.mismatches.some(m => m.reason === 'position_mismatch')).toBe(true);
        expect(result.mismatches.some(m => m.reason === 'missing_in_ui')).toBe(true);
    });
});

