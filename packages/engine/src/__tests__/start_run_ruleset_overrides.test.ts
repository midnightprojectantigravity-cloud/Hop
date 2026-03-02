import { describe, expect, it } from 'vitest';
import { gameReducer, generateHubState } from '../logic';

const withAttachmentCarry = (enabled: boolean) => {
    const hub = generateHubState();
    return {
        ...hub,
        ruleset: {
            ...(hub.ruleset || {}),
            ailments: {
                acaeEnabled: hub.ruleset?.ailments?.acaeEnabled ?? false,
                version: 'acae-v1' as const
            },
            attachments: {
                sharedVectorCarry: enabled,
                version: 'attachment-v1' as const
            }
        }
    };
};

describe('START_RUN ruleset overrides', () => {
    it('preserves hub attachment carry flag when no override is provided', () => {
        const hub = withAttachmentCarry(true);
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: { loadoutId: 'SKIRMISHER', seed: 'start-run-ruleset-preserve' }
        });

        expect(run.ruleset?.attachments?.sharedVectorCarry).toBe(true);
        expect(run.ruleset?.attachments?.version).toBe('attachment-v1');
    });

    it('supports explicit override to disable attachment carry', () => {
        const hub = withAttachmentCarry(true);
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'SKIRMISHER',
                seed: 'start-run-ruleset-disable',
                rulesetOverrides: {
                    attachments: { sharedVectorCarry: false }
                }
            }
        });

        expect(run.ruleset?.attachments?.sharedVectorCarry).toBe(false);
        expect(run.ruleset?.attachments?.version).toBe('attachment-v1');
    });

    it('supports explicit override to enable attachment carry in daily mode', () => {
        const hub = withAttachmentCarry(false);
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'SKIRMISHER',
                mode: 'daily',
                date: '2026-03-02',
                rulesetOverrides: {
                    attachments: { sharedVectorCarry: true }
                }
            }
        });

        expect(run.ruleset?.attachments?.sharedVectorCarry).toBe(true);
        expect(run.ruleset?.attachments?.version).toBe('attachment-v1');
        expect(run.dailyRunDate).toBe('2026-03-02');
    });
});
