import { describe, expect, it } from 'vitest';
import type { Actor, GameState, Point } from '../types';
import { createEmptyRunTelemetry } from '../generation';
import { BASIC_ATTACK } from '../skills/basic_attack';
import { FIREBALL } from '../skills/fireball';
import { DEATH_TOUCH } from '../skills/death_touch';
import { CORPSE_EXPLOSION } from '../skills/corpse_explosion';
import { applyAtomicEffect, applyEffects } from '../systems/effect-engine';
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
    turnsSpent: 0,
    runTelemetry: createEmptyRunTelemetry()
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
        expect(damage && damage.type === 'Damage' ? damage.amount : 0).toBe(5);
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
        expect(fbDamage && fbDamage.type === 'Damage' ? fbDamage.amount : 0).toBe(8);

        const corpseState = makeState(player, [enemy], corpseTiles);
        const corpseOut = CORPSE_EXPLOSION.execute(corpseState, player, corpsePos);
        const ceDamage = corpseOut.effects.find(e => e.type === 'Damage');
        expect(ceDamage && ceDamage.type === 'Damage' ? ceDamage.amount : 0).toBe(2);
    });

    it('death touch resolves to a positive damage effect at melee range', () => {
        const player = makeActor('necromancer', 'player', 'player', { q: 4, r: 4, s: -8 });
        player.components = new Map([['trinity', { type: 'trinity', body: 0, mind: 6, instinct: 0 }]]);
        const enemy = makeActor('target', 'enemy', 'enemy', { q: 5, r: 4, s: -9 });
        const state = { ...makeState(player, [enemy]), mapShape: 'rectangle' as const };
        const validTargets = DEATH_TOUCH.getValidTargets?.(state, player.position) || [];
        const validTarget = validTargets[0];
        expect(validTarget).toBeDefined();

        const out = DEATH_TOUCH.execute(state, player, validTarget!);
        const damage = out.effects.find(e => e.type === 'Damage');

        expect(out.consumesTurn).toBe(true);
        expect(damage && damage.type === 'Damage' ? damage.amount : 0).toBeGreaterThan(0);
    });

    it('death touch damage persists through the effect engine on a lethal hit', () => {
        const player = makeActor('necromancer', 'player', 'player', { q: 4, r: 4, s: -8 });
        player.components = new Map([['trinity', { type: 'trinity', body: 0, mind: 6, instinct: 4 }]]);
        const enemy = makeActor('target', 'enemy', 'enemy', { q: 5, r: 4, s: -9 });
        const state = { ...makeState(player, [enemy]), mapShape: 'rectangle' as const };
        const validTarget = DEATH_TOUCH.getValidTargets?.(state, player.position)?.[0];

        const out = DEATH_TOUCH.execute(state, player, validTarget!);
        const resolved = applyEffects(state, out.effects, { sourceId: player.id, targetId: enemy.id });

        expect(resolved.enemies.find(actor => actor.id === enemy.id)).toBeUndefined();
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

        expect(next.enemies[0].statusEffects[0]?.duration).toBe(30);
    });

    it('instinct lever adds deterministic initiative bonus', () => {
        const actor = makeActor('enemy-fast', 'enemy', 'enemy', { q: 0, r: 0, s: 0 });
        actor.components = new Map([['trinity', { type: 'trinity', body: 0, mind: 0, instinct: 4 }]]);
        expect(getInitiativeScore(actor)).toBe(12.8);
    });
});
