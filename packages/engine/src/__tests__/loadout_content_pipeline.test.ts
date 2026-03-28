import { describe, expect, it } from 'vitest';
import { parseLoadoutCatalog, validateLoadoutCatalog } from '../data/loadouts/parser';
import { DEFAULT_LOADOUT_DEFINITIONS } from '../data/loadouts/default-loadouts';
import {
    DEFAULT_LOADOUTS,
    applyLoadoutToPlayer,
    reconcileLoadoutCapabilityPassives,
    validateDefaultLoadouts
} from '../systems/loadout';
import { bootstrapTacticalData, resetTacticalDataBootstrap } from '../systems/tactical-data-bootstrap';

describe('loadout content pipeline', () => {
    it('parses the default loadout catalog and preserves key/id alignment', () => {
        const parsed = parseLoadoutCatalog(DEFAULT_LOADOUT_DEFINITIONS);
        expect(Object.keys(parsed)).toEqual(Object.keys(DEFAULT_LOADOUTS));
        for (const [key, loadout] of Object.entries(parsed)) {
            expect(loadout.id).toBe(key);
        }
    });

    it('rejects duplicate skill ids and key/id drift in catalog entries', () => {
        const issues = validateLoadoutCatalog({
            VANGUARD: {
                ...DEFAULT_LOADOUT_DEFINITIONS.VANGUARD,
                id: 'NOT_VANGUARD',
                startingSkills: ['BASIC_MOVE', 'BASIC_MOVE']
            }
        });

        expect(issues.some(issue => issue.path.endsWith('.id'))).toBe(true);
        expect(issues.some(issue => issue.path.includes('startingSkills[1]') && issue.message.includes('Duplicate'))).toBe(true);
    });

    it('validates default loadouts against the active skill registry and reports count at bootstrap', () => {
        const count = validateDefaultLoadouts();
        expect(count).toBeGreaterThan(0);

        resetTacticalDataBootstrap();
        const boot = bootstrapTacticalData();
        expect(boot.loadoutsValidated).toBe(count);
        resetTacticalDataBootstrap();
    });

    it('reconciles live capability passives deterministically', () => {
        const skirmisher = DEFAULT_LOADOUTS.SKIRMISHER;
        const base = applyLoadoutToPlayer(skirmisher);
        const baseIds = base.activeSkills.map(skill => skill.id);

        expect(baseIds.filter(id => id === 'STANDARD_VISION')).toHaveLength(1);
        expect(baseIds.filter(id => id === 'BASIC_AWARENESS')).toHaveLength(1);
        expect(baseIds.filter(id => id === 'TACTICAL_INSIGHT')).toHaveLength(1);
        expect(baseIds.filter(id => id === 'FLIGHT')).toHaveLength(1);

        const reconciled = reconcileLoadoutCapabilityPassives(skirmisher, base.activeSkills, true);
        expect(reconciled.map(skill => skill.id)).toEqual(baseIds);
    });

    it('maps movement capability passives to every archetype without duplicates', () => {
        const expectedMovementCapabilityByLoadout = {
            VANGUARD: 'BURROW',
            SKIRMISHER: 'FLIGHT',
            FIREMAGE: 'FLIGHT',
            NECROMANCER: 'BURROW',
            HUNTER: 'BURROW',
            ASSASSIN: 'PHASE_STEP'
        } as const;

        for (const [loadoutId, expectedMovementSkill] of Object.entries(expectedMovementCapabilityByLoadout) as Array<
            [keyof typeof expectedMovementCapabilityByLoadout, (typeof expectedMovementCapabilityByLoadout)[keyof typeof expectedMovementCapabilityByLoadout]]
        >) {
            const loadout = DEFAULT_LOADOUTS[loadoutId];
            const base = applyLoadoutToPlayer(loadout);
            const baseIds = base.activeSkills.map(skill => skill.id);

            expect(baseIds.filter(id => id === expectedMovementSkill)).toHaveLength(1);

            const reconciled = reconcileLoadoutCapabilityPassives(loadout, base.activeSkills, true);
            expect(reconciled.map(skill => skill.id)).toEqual(baseIds);
        }
    });
});
