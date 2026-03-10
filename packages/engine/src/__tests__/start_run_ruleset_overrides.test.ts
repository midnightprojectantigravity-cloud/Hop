import { describe, expect, it } from 'vitest';
import { gameReducer, generateHubState } from '../logic';
import { isHexInRectangularGrid, isTileInDiamond } from '../hex';

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
    it('materializes both capability flags when hub ruleset is absent', () => {
        const hub = {
            ...generateHubState(),
            ruleset: undefined
        };
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: { loadoutId: 'VANGUARD', seed: 'start-run-capability-materialize-defaults' }
        });

        expect(run.ruleset?.capabilities?.loadoutPassivesEnabled).toBe(false);
        expect(run.ruleset?.capabilities?.movementRuntimeEnabled).toBe(false);
        expect(run.ruleset?.capabilities?.version).toBe('capabilities-v1');
    });

    it('applies explicit map size overrides from START_RUN payload', () => {
        const hub = generateHubState();
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'VANGUARD',
                seed: 'start-run-map-size-override',
                mapSize: { width: 9, height: 11 }
            }
        });

        expect(run.gridWidth).toBe(9);
        expect(run.gridHeight).toBe(11);
        expect(isTileInDiamond(run.player.position.q, run.player.position.r, run.gridWidth, run.gridHeight)).toBe(true);
        expect(isTileInDiamond(run.stairsPosition.q, run.stairsPosition.r, run.gridWidth, run.gridHeight)).toBe(true);
    });

    it('supports explicit rectangle map shape without forcing odd dimensions', () => {
        const hub = generateHubState();
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'VANGUARD',
                seed: 'start-run-map-shape-rectangle',
                mapSize: { width: 8, height: 10 },
                mapShape: 'rectangle'
            }
        });

        expect(run.mapShape).toBe('rectangle');
        expect(run.gridWidth).toBe(8);
        expect(run.gridHeight).toBe(10);
        expect(isHexInRectangularGrid(run.player.position, run.gridWidth, run.gridHeight, run.mapShape)).toBe(true);
        expect(isHexInRectangularGrid(run.stairsPosition, run.gridWidth, run.gridHeight, run.mapShape)).toBe(true);
        // Rectangle bounds are clipped by two parallel diagonals:
        // top-left -> top-right and bottom-left -> bottom-right.
        expect(isHexInRectangularGrid({ q: 0, r: 0, s: 0 }, run.gridWidth, run.gridHeight, run.mapShape)).toBe(false);
        expect(isHexInRectangularGrid({ q: 7, r: 9, s: -16 }, run.gridWidth, run.gridHeight, run.mapShape)).toBe(false);
        expect(isHexInRectangularGrid({ q: 7, r: 0, s: -7 }, run.gridWidth, run.gridHeight, run.mapShape)).toBe(true);
        expect(isHexInRectangularGrid({ q: 0, r: 9, s: -9 }, run.gridWidth, run.gridHeight, run.mapShape)).toBe(true);
        expect(isHexInRectangularGrid({ q: 1, r: 0, s: -1 }, run.gridWidth, run.gridHeight, run.mapShape)).toBe(false);
        expect(isHexInRectangularGrid({ q: 1, r: 3, s: -4 }, run.gridWidth, run.gridHeight, run.mapShape)).toBe(true);
        expect(isHexInRectangularGrid({ q: 7, r: 7, s: -14 }, run.gridWidth, run.gridHeight, run.mapShape)).toBe(false);
        expect(isHexInRectangularGrid({ q: 7, r: 6, s: -13 }, run.gridWidth, run.gridHeight, run.mapShape)).toBe(true);
    });

    it('clips rectangle shape to positive-only diagonal bounds for 13x15', () => {
        const hub = generateHubState();
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'VANGUARD',
                seed: 'start-run-map-shape-rectangle-13x15',
                mapSize: { width: 13, height: 15 },
                mapShape: 'rectangle'
            }
        });

        expect(isHexInRectangularGrid({ q: 0, r: 6, s: -6 }, run.gridWidth, run.gridHeight, run.mapShape)).toBe(true);
        expect(isHexInRectangularGrid({ q: 12, r: 0, s: -12 }, run.gridWidth, run.gridHeight, run.mapShape)).toBe(true);
        expect(isHexInRectangularGrid({ q: 0, r: 14, s: -14 }, run.gridWidth, run.gridHeight, run.mapShape)).toBe(true);
        expect(isHexInRectangularGrid({ q: 12, r: 8, s: -20 }, run.gridWidth, run.gridHeight, run.mapShape)).toBe(true);
        expect(isHexInRectangularGrid({ q: 0, r: 5, s: -5 }, run.gridWidth, run.gridHeight, run.mapShape)).toBe(false);
        expect(isHexInRectangularGrid({ q: 12, r: 9, s: -21 }, run.gridWidth, run.gridHeight, run.mapShape)).toBe(false);

        const playableHexes = run.rooms?.[0]?.hexes ?? [];
        expect(playableHexes.length).toBeGreaterThan(0);
        const columnCounts = new Map<number, number>();
        for (const hex of playableHexes) {
            columnCounts.set(hex.q, (columnCounts.get(hex.q) || 0) + 1);
        }
        expect(columnCounts.size).toBe(13);
        for (let q = 0; q < 13; q++) {
            expect(columnCounts.get(q)).toBe(9);
        }
    });

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
        expect(run.player.activeSkills.some(skill => skill.id === 'FLIGHT')).toBe(true);
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
        expect(run.player.activeSkills.some(skill => skill.id === 'FLIGHT')).toBe(false);
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
        expect(run.player.activeSkills.some(skill => skill.id === 'FLIGHT')).toBe(true);
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
