import { describe, expect, it } from 'vitest';
import { parseLoadoutCatalog, validateLoadoutCatalog } from '../data/loadouts/parser';
import { DEFAULT_LOADOUT_DEFINITIONS } from '../data/loadouts/default-loadouts';
import { DEFAULT_LOADOUTS, validateDefaultLoadouts } from '../systems/loadout';
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
});

