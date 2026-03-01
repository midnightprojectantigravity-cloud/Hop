import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { createEntity } from '../systems/entities/entity-factory';
import { resolveActorForceScalars } from '../systems/combat/force-scalars';

describe('force scalars', () => {
    it('maps deterministic mass/velocity/momentum from actor components and trinity', () => {
        const actor = createEntity({
            id: 'force-scalar-heavy',
            type: 'enemy',
            subtype: 'footman',
            position: createHex(3, 3),
            speed: 2,
            factionId: 'enemy',
            skills: ['BASIC_MOVE'],
            weightClass: 'Heavy',
            trinity: { body: 12, mind: 6, instinct: 8 }
        });

        const scalars = resolveActorForceScalars(actor);
        expect(scalars.mass).toBeGreaterThan(1.2);
        expect(scalars.velocity).toBe(2);
        expect(scalars.momentum).toBeGreaterThan(0);
    });

    it('remains deterministic for identical actor inputs', () => {
        const actor = createEntity({
            id: 'force-scalar-standard',
            type: 'player',
            position: createHex(2, 2),
            speed: 1,
            factionId: 'player',
            skills: ['BASIC_MOVE'],
            weightClass: 'Standard',
            trinity: { body: 8, mind: 8, instinct: 8 }
        });

        const a = resolveActorForceScalars(actor);
        const b = resolveActorForceScalars(actor);
        expect(a).toEqual(b);
    });
});

