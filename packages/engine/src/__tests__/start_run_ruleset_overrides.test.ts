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
            },
            capabilities: {
                loadoutPassivesEnabled: hub.ruleset?.capabilities?.loadoutPassivesEnabled ?? false,
                movementRuntimeEnabled: hub.ruleset?.capabilities?.movementRuntimeEnabled ?? false,
                version: 'capabilities-v1' as const
            }
        }
    };
};

const withCapabilityLoadoutPassives = (enabled: boolean) => {
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
                sharedVectorCarry: hub.ruleset?.attachments?.sharedVectorCarry ?? false,
                version: 'attachment-v1' as const
            },
            capabilities: {
                loadoutPassivesEnabled: enabled,
                movementRuntimeEnabled: hub.ruleset?.capabilities?.movementRuntimeEnabled ?? false,
                version: 'capabilities-v1' as const
            }
        }
    };
};

const withCapabilityMovementRuntime = (enabled: boolean) => {
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
                sharedVectorCarry: hub.ruleset?.attachments?.sharedVectorCarry ?? false,
                version: 'attachment-v1' as const
            },
            capabilities: {
                loadoutPassivesEnabled: hub.ruleset?.capabilities?.loadoutPassivesEnabled ?? false,
                movementRuntimeEnabled: enabled,
                version: 'capabilities-v1' as const
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

    it('preserves hub capability passives flag when no override is provided', () => {
        const hub = withCapabilityLoadoutPassives(true);
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: { loadoutId: 'SKIRMISHER', seed: 'start-run-capability-preserve' }
        });

        expect(run.ruleset?.capabilities?.loadoutPassivesEnabled).toBe(true);
        expect(run.ruleset?.capabilities?.version).toBe('capabilities-v1');
        expect(run.player.activeSkills.some(skill => skill.id === 'STANDARD_VISION')).toBe(true);
        expect(run.player.activeSkills.some(skill => skill.id === 'BASIC_AWARENESS')).toBe(true);
        expect(run.player.activeSkills.some(skill => skill.id === 'TACTICAL_INSIGHT')).toBe(true);
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

    it('supports explicit override to disable capability passives even when hub enables them', () => {
        const hub = withCapabilityLoadoutPassives(true);
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'SKIRMISHER',
                seed: 'start-run-capability-disable',
                rulesetOverrides: {
                    capabilities: { loadoutPassivesEnabled: false }
                }
            }
        });

        expect(run.ruleset?.capabilities?.loadoutPassivesEnabled).toBe(false);
        expect(run.ruleset?.capabilities?.version).toBe('capabilities-v1');
        expect(run.player.activeSkills.some(skill => skill.id === 'STANDARD_VISION')).toBe(false);
        expect(run.player.activeSkills.some(skill => skill.id === 'BASIC_AWARENESS')).toBe(false);
        expect(run.player.activeSkills.some(skill => skill.id === 'TACTICAL_INSIGHT')).toBe(false);
    });

    it('preserves hub movement capability runtime flag when no override is provided', () => {
        const hub = withCapabilityMovementRuntime(true);
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: { loadoutId: 'SKIRMISHER', seed: 'start-run-capability-move-preserve' }
        });

        expect(run.ruleset?.capabilities?.movementRuntimeEnabled).toBe(true);
        expect(run.ruleset?.capabilities?.version).toBe('capabilities-v1');
    });

    it('supports explicit override to disable movement capability runtime', () => {
        const hub = withCapabilityMovementRuntime(true);
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'SKIRMISHER',
                seed: 'start-run-capability-move-disable',
                rulesetOverrides: {
                    capabilities: { movementRuntimeEnabled: false }
                }
            }
        });

        expect(run.ruleset?.capabilities?.movementRuntimeEnabled).toBe(false);
        expect(run.ruleset?.capabilities?.version).toBe('capabilities-v1');
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

    it('supports explicit override to enable capability passives in daily mode', () => {
        const hub = withCapabilityLoadoutPassives(false);
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'FIREMAGE',
                mode: 'daily',
                date: '2026-03-02',
                rulesetOverrides: {
                    capabilities: { loadoutPassivesEnabled: true }
                }
            }
        });

        expect(run.ruleset?.capabilities?.loadoutPassivesEnabled).toBe(true);
        expect(run.ruleset?.capabilities?.version).toBe('capabilities-v1');
        expect(run.player.activeSkills.some(skill => skill.id === 'STANDARD_VISION')).toBe(true);
        expect(run.player.activeSkills.some(skill => skill.id === 'BASIC_AWARENESS')).toBe(true);
        expect(run.player.activeSkills.some(skill => skill.id === 'COMBAT_ANALYSIS')).toBe(true);
        expect(run.dailyRunDate).toBe('2026-03-02');
    });

    it('supports explicit override to enable movement capability runtime in daily mode', () => {
        const hub = withCapabilityMovementRuntime(false);
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'FIREMAGE',
                mode: 'daily',
                date: '2026-03-02',
                rulesetOverrides: {
                    capabilities: { movementRuntimeEnabled: true }
                }
            }
        });

        expect(run.ruleset?.capabilities?.movementRuntimeEnabled).toBe(true);
        expect(run.ruleset?.capabilities?.version).toBe('capabilities-v1');
        expect(run.dailyRunDate).toBe('2026-03-02');
    });
});
