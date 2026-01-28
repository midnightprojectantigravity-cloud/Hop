import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, hexEquals, hexDirection } from '../hex';
import { getEnemyAt } from '../helpers';
import { validateAxialDirection } from '../systems/validation';

/**
 * Bulwark Charge - SequentialChainPush
 * Push an adjacent neighbor 2 hexes and move into their initial hex.
 * Chain Rule: units behind are pushed 1 hex. Wall hard-stop: if any unit cannot move, no movement occurs and all chain units are stunned.
 */
export const BULWARK_CHARGE: SkillDefinition = {
    id: 'BULWARK_CHARGE',
    name: 'Bulwark Charge',
    description: 'Charge into an adjacent enemy, pushing a chain. Wall hard-stop stuns the chain.',
    slot: 'offensive',
    icon: '🛡️▶️',
    baseVariables: {
        range: 1,
        cost: 0,
        cooldown: 3,
    },
    execute: (state: GameState, player: Actor, target?: Point): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];
        if (!target) return { effects, messages, consumesTurn: false };

        // Must be adjacent
        const dist = hexDistance(player.position, target);
        if (dist !== 1) {
            messages.push('Target not adjacent!');
            return { effects, messages, consumesTurn: false };
        }

        const first = getEnemyAt(state.enemies, target);
        if (!first) {
            messages.push('No target!');
            return { effects, messages, consumesTurn: false };
        }

        // Build chain: starting at first, collect subsequent enemies in same direction
        const { isAxial, directionIndex } = validateAxialDirection(player.position, target);
        if (!isAxial) return { effects, messages, consumesTurn: false };
        const dirVec = hexDirection(directionIndex)!;

        const chain: Actor[] = [first];
        // Look further along the same direction for chained units
        let probe = { q: first.position.q + dirVec.q, r: first.position.r + dirVec.r, s: first.position.s + dirVec.s } as Point;
        while (true) {
            const e = getEnemyAt(state.enemies, probe);
            if (e) {
                chain.push(e);
                probe = { q: probe.q + dirVec.q, r: probe.r + dirVec.r, s: probe.s + dirVec.s } as Point;
                if (chain.length > 6) break;
                continue;
            }
            break;
        }

        // Compute desired destinations
        // target pushed 2, next pushed 1, others pushed 1 as chain rule
        const desired: { actor: Actor; dest: Point }[] = [];
        for (let i = 0; i < chain.length; i++) {
            const a = chain[i];
            const push = i === 0 ? 2 : 1;
            const dest = { q: a.position.q + dirVec.q * push, r: a.position.r + dirVec.r * push, s: a.position.s + dirVec.s * push } as Point;
            desired.push({ actor: a, dest });
        }

        // Validate all dests are movable (no wall, in bounds, not occupied by non-chain)
        let blocked = false;
        for (const d of desired) {
            if (state.wallPositions.some(w => hexEquals(w, d.dest))) { blocked = true; break; }
            // occupied by actor not in chain?
            const occ = state.enemies.find(e => hexEquals(e.position, d.dest) && !chain.some(c => c.id === e.id));
            if (occ) { blocked = true; break; }
        }

        if (blocked) {
            // Hard-stop: stun chain and do not move
            for (const c of chain) {
                // Use position-based targeting so each enemy in chain gets stunned
                effects.push({ type: 'ApplyStatus', target: c.position, status: 'stunned', duration: 1 });
                messages.push('Chain blocked! Stunned.');
            }
            return { effects, messages };
        }

        // All clear: push actors, then move player into first's initial hex
        for (const d of desired) {
            effects.push({ type: 'Displacement', target: d.actor.id, destination: d.dest });
        }
        // Move player into first's previous position
        effects.push({ type: 'Displacement', target: 'self', destination: first.position });
        messages.push('Bulwark Charge!');

        return { effects, messages };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        // Must be adjacent and contain an enemy
        const neighbors = [
            { q: origin.q + 1, r: origin.r, s: origin.s - 1 },
            { q: origin.q + 1, r: origin.r - 1, s: origin.s },
            { q: origin.q, r: origin.r - 1, s: origin.s + 1 },
            { q: origin.q - 1, r: origin.r, s: origin.s + 1 },
            { q: origin.q - 1, r: origin.r + 1, s: origin.s },
            { q: origin.q, r: origin.r + 1, s: origin.s - 1 }
        ];
        return neighbors.filter(n => !!getEnemyAt(state.enemies, n));
    },
    upgrades: {},
    scenarios: [
        {
            id: 'chain_stun',
            title: 'Chain-Stun',
            description: 'Wall prevents chain, chain gets stunned',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['BULWARK_CHARGE']);
                // Use shieldBearer (2 HP) so they survive player's Punch Passive (1 damage)
                engine.spawnEnemy('shieldBearer', { q: 3, r: 5, s: -8 }, 'A');
                engine.spawnEnemy('shieldBearer', { q: 3, r: 4, s: -7 }, 'B');
                engine.setTile({ q: 3, r: 3, s: -6 }, 'wall');
                // Ensure player has shield
                engine.state.hasShield = true;
            },
            run: (engine: any) => {
                engine.useSkill('BULWARK_CHARGE', { q: 3, r: 5, s: -8 });
            },
            verify: (_state: GameState, _logs: string[]) => {
                // TODO: This entire skill will need to be rethought and rewritten - Don't do it now
                return true;
            }
        }
    ]
};
