import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getBaseUnitDefinitionById, getBaseUnitDefinitionBySubtype } from '../systems/entities/base-unit-registry';
import { bootstrapTacticalData, resetTacticalDataBootstrap } from '../systems/tactical-data-bootstrap';
import { getEnemyCatalogEntry, listUnitDefinitions } from '../data/units';

describe('unit catalog registry', () => {
    beforeEach(() => {
        resetTacticalDataBootstrap();
        bootstrapTacticalData();
    });

    afterEach(() => {
        resetTacticalDataBootstrap();
    });

    it('registers archetypes, enemies, and companions in the same base-unit registry', () => {
        expect(getBaseUnitDefinitionBySubtype('VANGUARD')?.unitKind).toBe('archetype');
        expect(getBaseUnitDefinitionById('PLAYER_VANGUARD')?.unitKind).toBe('archetype');

        expect(getBaseUnitDefinitionBySubtype('archer')?.unitKind).toBe('enemy');
        expect(getBaseUnitDefinitionBySubtype('archer')?.skillLoadout.baseSkillIds).toContain('ARCHER_SHOT');

        expect(getBaseUnitDefinitionBySubtype('falcon')?.unitKind).toBe('companion');
        expect(getBaseUnitDefinitionById('COMPANION_FALCON')?.traits).toContain('COMPANION');
    });

    it('exposes the live registered catalog through the shared unit facade', () => {
        expect(listUnitDefinitions().some(def => def.id === 'PLAYER_VANGUARD')).toBe(true);
        expect(getBaseUnitDefinitionBySubtype('archer')?.unitKind).toBe('enemy');
        expect(getBaseUnitDefinitionBySubtype('falcon')?.unitKind).toBe('companion');
        expect(listUnitDefinitions().some(def => def.id === 'ENEMY_ARCHER_V1')).toBe(true);
        expect(getEnemyCatalogEntry('archer')?.subtype).toBe('archer');
    });
});
