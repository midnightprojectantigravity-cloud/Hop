import { describe, expect, it } from 'vitest';
import type { Actor, GameState, Point } from '../types';
import { BASIC_ATTACK } from '../skills/basic_attack';
import { FIREBALL } from '../skills/fireball';
import { CORPSE_EXPLOSION } from '../skills/corpse_explosion';
import { applyAtomicEffect } from '../systems/effect-engine';
import { getInitiativeScore } from '../systems/initiative';
import { pointToKey } from '../hex';

const makeActor = (id: string, type: 'player' | 'enemy', factionId: string, position: Point): Actor => ({
    id,
    type,
    position,
    hp: 10,
    maxHp: 10,
    speed: 10,
    factionId,
    statusEffects: [],
    temporaryArmor: 0,
    activeSkills: []
});

const makeState = (player: Actor, enemies: Actor[], tiles?: Map<string, any>): GameState => ({
    turnNumber: 1,
    player,
    enemies,
    gridWidth: 9,
    gridHeight: 10,
    gameStatus: 'playing',
    message: [],
    hasSpear: false,
    stairsPosition: { q: 0, r: 0, s: 0 },
    tiles: tiles || new Map(),
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

describe('trinity integration', () => {
    it('body stat increases BASIC_ATTACK damage via calculator', () => {
        const targetPos = { q: 1, r: 0, s: -1 };
        const player = makeActor('player', 'player', 'player', { q: 0, r: 0, s: 0 });
        player.components = new Map([['trinity', { type: 'trinity', body: 4, mind: 0, instinct: 0 }]]);
        const enemy = makeActor('enemy-1', 'enemy', 'enemy', targetPos);
        const state = makeState(player, [enemy]);

        const out = BASIC_ATTACK.execute(state, player, targetPos, []);
        const damage = out.effects.find(e => e.type === 'Damage');
        expect(damage && damage.type === 'Damage' ? damage.amount : 0).toBe(2);
    });

    it('mind stat increases FIREBALL and CORPSE_EXPLOSION base output', () => {
        const player = makeActor('player', 'player', 'player', { q: 0, r: 0, s: 0 });
        player.components = new Map([['trinity', { type: 'trinity', body: 0, mind: 5, instinct: 0 }]]);
        const enemy = makeActor('enemy-1', 'enemy', 'enemy', { q: 0, r: 2, s: -2 });

        const corpsePos = { q: 0, r: 1, s: -1 };
        const corpseTiles = new Map<string, any>([
            [pointToKey(corpsePos), { baseId: 'STONE', position: corpsePos, traits: new Set(['CORPSE']), effects: [] }]
        ]);

        const fireballState = makeState(player, [enemy]);
        const fireballOut = FIREBALL.execute(fireballState, player, enemy.position);
        const fbDamage = fireballOut.effects.find(e => e.type === 'Damage');
        expect(fbDamage && fbDamage.type === 'Damage' ? fbDamage.amount : 0).toBe(2);

        const corpseState = makeState(player, [enemy], corpseTiles);
        const corpseOut = CORPSE_EXPLOSION.execute(corpseState, player, corpsePos);
        const ceDamage = corpseOut.effects.find(e => e.type === 'Damage');
        expect(ceDamage && ceDamage.type === 'Damage' ? ceDamage.amount : 0).toBe(3);
    });

    it('mind lever extends applied status duration from source actor', () => {
        const player = makeActor('player', 'player', 'player', { q: 0, r: 0, s: 0 });
        player.components = new Map([['trinity', { type: 'trinity', body: 0, mind: 30, instinct: 0 }]]);
        const enemy = makeActor('enemy-1', 'enemy', 'enemy', { q: 1, r: 0, s: -1 });
        const state = makeState(player, [enemy]);

        const next = applyAtomicEffect(
            state,
            { type: 'ApplyStatus', target: enemy.id, status: 'stunned', duration: 1 },
            { sourceId: player.id, targetId: enemy.id }
        );

        expect(next.enemies[0].statusEffects[0]?.duration).toBe(3);
    });

    it('instinct lever adds deterministic initiative bonus', () => {
        const actor = makeActor('enemy-fast', 'enemy', 'enemy', { q: 0, r: 0, s: 0 });
        actor.components = new Map([['trinity', { type: 'trinity', body: 0, mind: 0, instinct: 4 }]]);
        expect(getInitiativeScore(actor)).toBe(18);
    });
});
