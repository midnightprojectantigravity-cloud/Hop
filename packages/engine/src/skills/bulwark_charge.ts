import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, hexEquals, getDirectionFromTo, hexDirection } from '../hex';
import { getEnemyAt } from '../helpers';

/**
 * Bulwark Charge (Enyo Melee Mode) - SequentialChainPush
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
        const dirIdx = getDirectionFromTo(player.position, first.position);
        if (dirIdx === -1) return { effects, messages, consumesTurn: false };
        const dirVec = hexDirection(dirIdx)!;

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
            effects.push({ type: 'Displacement', target: 'targetActor', destination: d.dest });
        }
        // Move player into first's previous position
        effects.push({ type: 'Displacement', target: 'self', destination: first.position });
        messages.push('Bulwark Charge!');

        return { effects, messages };
    },
    upgrades: {},
    scenarios: [
        {
            id: 'enyo_chain_stun',
            title: 'The Enyo Chain-Stun',
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
            verify: (state: GameState, logs: string[]) => {
                // Player should not have moved (blocked scenario)
                const playerOk = state.player.position.q === 3 && state.player.position.r === 6;
                // Enemies should still be in original positions
                const a = state.enemies.find((e: Actor) => e.id === 'A');
                const b = state.enemies.find((e: Actor) => e.id === 'B');
                const aPos = !!(a && a.position.q === 3 && a.position.r === 5);
                const bPos = !!(b && b.position.q === 3 && b.position.r === 4);
                // Check logs for stun messages (stuns clear at end of enemy turn)
                const stunMessages = logs.filter(l => l.includes('Chain blocked! Stunned.')).length >= 2;
                return playerOk && aPos && bPos && stunMessages;
            }
        }
    ]
};
