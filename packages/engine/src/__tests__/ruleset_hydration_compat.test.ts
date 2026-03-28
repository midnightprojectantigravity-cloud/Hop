import { describe, expect, it } from 'vitest';
import { gameReducer, generateHubState, generateInitialState } from '../logic';

describe('ruleset hydration compatibility', () => {
    it('strips retired runtime flag branches from legacy loaded state', () => {
        const baseline = generateInitialState(1, 'legacy-ruleset-hydration');
        // Legacy payload keys remain here intentionally to verify load-time normalization.
        const legacySnapshot = {
            ...baseline,
            ruleset: {
                ...(baseline.ruleset || {}),
                ailments: {
                    acaeEnabled: false,
                    version: 'acae-v1' as const
                },
                attachments: {
                    sharedVectorCarry: false,
                    version: 'attachment-v1' as const
                },
                capabilities: {
                    loadoutPassivesEnabled: false,
                    movementRuntimeEnabled: false,
                    version: 'capabilities-v1' as const
                }
            }
        };

        const loaded = gameReducer(generateHubState(), {
            type: 'LOAD_STATE',
            payload: legacySnapshot as any
        });

        expect((loaded.ruleset as any)?.ailments).toBeUndefined();
        expect((loaded.ruleset as any)?.attachments).toBeUndefined();
        expect((loaded.ruleset as any)?.capabilities).toBeUndefined();
        expect(loaded.ruleset?.combat).toBeDefined();
        expect(loaded.ruleset?.ires).toBeDefined();
    });
});
