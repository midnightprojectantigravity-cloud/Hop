import { describe, expect, it } from 'vitest';
import type { Actor, GameState, Point } from '../types';
import { pointToKey } from '../hex';
import { FIREBALL } from '../skills/fireball';
import { getSurfaceSkillPowerMultiplier, getSurfaceStatus } from '../systems/tiles/surface-status';

const makeActor = (id: string, type: 'player' | 'enemy', factionId: string, position: Point): Actor => ({
    id,
    type,
    position,
    hp: 12,
    maxHp: 12,
    speed: 10,
    factionId,
    statusEffects: [],
    temporaryArmor: 0,
    activeSkills: []
});

const makeState = (player: Actor, enemies: Actor[], tiles: Map<string, any> = new Map()): GameState => ({
    turnNumber: 1,
    player,
    enemies,
    gridWidth: 9,
    gridHeight: 9,
    gameStatus: 'playing',
    message: [],
    hasSpear: false,
    stairsPosition: { q: 0, r: 0, s: 0 },
    tiles,
    occupancyMask: [0n],
    hasShield: false,
    floor: 1,
    upgrades: [],
    commandLog: [],
    undoStack: [],
    kills: 0,
    environmentalKills: 0,
    visualEvents: [],
    turnsSpent: 0
} as GameState);

describe('surface-status hooks', () => {
    it('classifies deterministic surface states from tile data', () => {
        const pLava = { q: 1, r: 0, s: -1 };
        const pWet = { q: 2, r: 0, s: -2 };
        const pIce = { q: 3, r: 0, s: -3 };
        const pVoid = { q: 4, r: 0, s: -4 };
        const pStone = { q: 5, r: 0, s: -5 };

        const tiles = new Map<string, any>([
            [pointToKey(pLava), { baseId: 'LAVA', position: pLava, traits: new Set(['LIQUID', 'HAZARDOUS']), effects: [] }],
            [pointToKey(pWet), { baseId: 'STONE', position: pWet, traits: new Set(['WALKABLE']), effects: [{ id: 'WET', duration: 2, potency: 1 }] }],
            [pointToKey(pIce), { baseId: 'ICE', position: pIce, traits: new Set(['WALKABLE', 'SLIPPERY']), effects: [] }],
            [pointToKey(pVoid), { baseId: 'VOID', position: pVoid, traits: new Set(['HAZARDOUS', 'VOID']), effects: [] }],
            [pointToKey(pStone), { baseId: 'STONE', position: pStone, traits: new Set(['WALKABLE']), effects: [] }]
        ]);

        const player = makeActor('player', 'player', 'player', { q: 0, r: 0, s: 0 });
        const state = makeState(player, [], tiles);

        expect(getSurfaceStatus(state, pLava)).toBe('MELTED');
        expect(getSurfaceStatus(state, pWet)).toBe('SOAKED');
        expect(getSurfaceStatus(state, pIce)).toBe('FROZEN');
        expect(getSurfaceStatus(state, pVoid)).toBe('VOID_TOUCHED');
        expect(getSurfaceStatus(state, pStone)).toBe('STABLE');
    });

    it('applies the melted-surface power bonus to fire skills', () => {
        const attacker = makeActor('player', 'player', 'player', { q: 0, r: 0, s: 0 });
        attacker.components = new Map([['trinity', { type: 'trinity', body: 0, mind: 24, instinct: 0 }]]);
        const target = { q: 0, r: 2, s: -2 };
        const enemy = makeActor('enemy-1', 'enemy', 'enemy', target);
        const normalState = makeState(attacker, [enemy]);
        const meltedTiles = new Map<string, any>([
            [pointToKey(target), { baseId: 'LAVA', position: target, traits: new Set(['LIQUID', 'HAZARDOUS']), effects: [] }]
        ]);
        const meltedState = makeState(attacker, [enemy], meltedTiles);

        const normal = FIREBALL.execute(normalState, attacker, target);
        const melted = FIREBALL.execute(meltedState, attacker, target);
        const isTargetDamage = (effect: any): boolean =>
            effect?.type === 'Damage'
            && effect.target
            && typeof effect.target === 'object'
            && effect.target.q === target.q
            && effect.target.r === target.r
            && effect.target.s === target.s;
        const normalDamage = normal.effects.find(isTargetDamage) as { amount: number } | undefined;
        const meltedDamage = melted.effects.find(isTargetDamage) as { amount: number } | undefined;

        expect(normalDamage?.amount).toBe(7);
        expect(meltedDamage?.amount).toBe(8);
    });

    it('returns 1.15 only for fire skills on melted surfaces', () => {
        expect(getSurfaceSkillPowerMultiplier('FIREBALL', 'MELTED')).toBe(1.15);
        expect(getSurfaceSkillPowerMultiplier('FIREWALL', 'MELTED')).toBe(1.15);
        expect(getSurfaceSkillPowerMultiplier('BASIC_ATTACK', 'MELTED')).toBe(1);
        expect(getSurfaceSkillPowerMultiplier('FIREBALL', 'STABLE')).toBe(1);
    });
});

