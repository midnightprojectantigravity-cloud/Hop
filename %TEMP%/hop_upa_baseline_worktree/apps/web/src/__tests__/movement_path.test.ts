import { describe, expect, it } from 'vitest';
import type { Actor, MovementTrace } from '@hop/engine';
import { resolveMovementPath } from '../components/movement-path';

const mkActor = (overrides: Partial<Actor> = {}): Actor => ({
    id: 'player',
    type: 'player',
    position: { q: 1, r: 9, s: -10 },
    previousPosition: { q: 1, r: 9, s: -10 },
    hp: 10,
    maxHp: 10,
    statusEffects: [],
    temporaryArmor: 0,
    activeSkills: [],
    speed: 1,
    factionId: 'player',
    ...overrides
});

describe('resolveMovementPath', () => {
    it('uses engine trace path even when previousPosition already equals destination', () => {
        const entity = mkActor({
            position: { q: 1, r: 9, s: -10 },
            previousPosition: { q: 1, r: 9, s: -10 }
        });
        const movementTrace: MovementTrace = {
            actorId: 'player',
            origin: { q: 3, r: 7, s: -10 },
            destination: { q: 1, r: 9, s: -10 },
            movementType: 'slide',
            wasLethal: false,
            path: [
                { q: 3, r: 7, s: -10 },
                { q: 2, r: 7, s: -9 },
                { q: 1, r: 8, s: -9 },
                { q: 1, r: 9, s: -10 }
            ]
        };

        const resolved = resolveMovementPath(entity, movementTrace);
        expect(resolved.source).toBe('trace');
        expect(resolved.path?.length).toBe(4);
        expect(resolved.movementType).toBe('slide');
    });

    it('falls back to previous->current line when no valid trace exists', () => {
        const entity = mkActor({
            position: { q: 1, r: 9, s: -10 },
            previousPosition: { q: 3, r: 7, s: -10 }
        });

        const resolved = resolveMovementPath(entity, undefined);
        expect(resolved.source).toBe('fallback');
        expect((resolved.path?.length || 0) > 1).toBe(true);
    });

    it('returns none for static actor with no trace', () => {
        const entity = mkActor();
        const resolved = resolveMovementPath(entity, undefined);
        expect(resolved.source).toBe('none');
        expect(resolved.path).toBeNull();
    });
});
