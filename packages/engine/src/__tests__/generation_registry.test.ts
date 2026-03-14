import { describe, expect, it } from 'vitest';
import type { ModuleRegistryEntry } from '../generation';
import { indexModuleRegistry } from '../generation';

const buildModule = (id: string, collisionSignature: string, collisionKeys: string[]): ModuleRegistryEntry => ({
    id,
    theme: 'inferno',
    footprint: [{ dq: 0, dr: 0 }],
    tileStamps: [{ dq: 0, dr: 0, baseId: 'STONE' }],
    capability: {
        tacticalTags: ['choke'],
        narrativeTags: ['watch_post'],
        moodTags: ['alert'],
        evidenceTags: ['warning_marker'],
        encounterPostures: ['crossfire_screen'],
        sceneRoles: ['perch'],
        anchorKinds: ['center'],
        forbiddenNeighborTags: []
    },
    collisionMask: {
        signature: collisionSignature,
        keys: collisionKeys
    }
});

describe('generation registry equivalence classes', () => {
    it('does not merge modules with differing collision masks', () => {
        const index = indexModuleRegistry([
            buildModule('a', '0,0', ['0,0']),
            buildModule('b', '1,0', ['1,0'])
        ]);

        expect(index.equivalenceClasses).toHaveLength(2);
    });

    it('merges modules only when the collision mask and capability signature match', () => {
        const index = indexModuleRegistry([
            buildModule('a', '0,0', ['0,0']),
            buildModule('b', '0,0', ['0,0'])
        ]);

        expect(index.equivalenceClasses).toHaveLength(1);
        expect(index.equivalenceClasses[0].moduleIds).toEqual(['a', 'b']);
    });
});
