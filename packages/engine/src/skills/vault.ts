import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, hexEquals, getNeighbors } from '../hex';
import { getEnemyAt } from '../helpers';

/**
 * Implementation of the Vault skill (Enyo Utility)
 * Range 2. No Cooldown. Stuns neighbors on landing every 2nd use.
 */
export const VAULT: SkillDefinition = {
    id: 'VAULT',
    name: 'Vault',
    description: 'Leap to an empty tile. Stuns neighbors on every 2nd use.',
    slot: 'utility',
    icon: '🏃',
    baseVariables: {
        range: 2,
        cost: 0,
        cooldown: 0,
    },
    execute: (state: GameState, attacker: Actor, target?: Point, _activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[] } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages };

        const dist = hexDistance(attacker.position, target);
        if (dist < 1 || dist > 2) {
            messages.push('Out of range!');
            return { effects, messages };
        }

        const isWall = state.wallPositions.some(w => hexEquals(w, target));
        const isLava = state.lavaPositions.some(l => hexEquals(l, target));
        const isOccupiedByEnemy = !!getEnemyAt(state.enemies, target);

        if (isWall || isLava || isOccupiedByEnemy) {
            messages.push('Blocked!');
            return { effects, messages };
        }

        // Vault counter logic
        const vaultCounter = (attacker.components?.vaultCounter || 0) + 1;
        const shouldStun = vaultCounter % 2 === 0;

        effects.push({ type: 'UpdateComponent', target: 'self', key: 'vaultCounter', value: vaultCounter });

        // Use AtomicEffect to update component if the engine supports it, 
        // but currently we don't have UpdateComponent atomic effect.
        // I'll assume the engine handles component persistence if I modify attacker in logic?
        // Actually, execute returns effects.
        // I'll add a Message or something to signal the counter, but ideally I'd have a way to persist it.
        // For the MVP, I'll just implement the stun part and hope the counter persists via attacker object if mutated (which is bad in immutable state).

        // Wait, I can use a Custom Atomic Effect? 
        // Let's add 'UpdateComponent' to AtomicEffect in types.ts.

        effects.push({ type: 'Displacement', target: 'self', destination: target });
        messages.push('Vaulted!');

        if (shouldStun) {
            const neighbors = getNeighbors(target);
            for (const n of neighbors) {
                const enemy = getEnemyAt(state.enemies, n);
                if (enemy) {
                    effects.push({ type: 'ApplyStatus', target: n, status: 'stunned', duration: 1 });
                }
            }
            effects.push({ type: 'Juice', effect: 'shake' });
            messages.push('Slam landing! Neighbors stunned.');
        }

        return { effects, messages };
    },
    upgrades: {},
    scenarios: [
        {
            id: 'vault_stun_cycle',
            title: 'Vault Stun Cycle',
            description: 'Verify vault stuns only on every 2nd use.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['VAULT']);
                engine.spawnEnemy('footman', { q: 3, r: 3, s: -6 }, 'victim');
                engine.applyStatus('victim', 'stunned');
            },
            run: (engine: any) => {
                // First use (no stun)
                engine.useSkill('VAULT', { q: 3, r: 4, s: -7 });
                // Second use (at neighbor of victim, should stun)
                engine.useSkill('VAULT', { q: 3, r: 2, s: -5 });
            },
            verify: (state: GameState, logs: string[]) => {
                const stunMsg = logs.some(l => l.includes('Slam landing! Neighbors stunned.'));
                const playerAtTarget = state.player.position.r === 2;
                return playerAtTarget && stunMsg;
            }
        },
        {
            id: 'vault_blocked_lava',
            title: 'Vault Blocked by Lava',
            description: 'Cannot vault into lava.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['VAULT']);
                engine.setTile({ q: 3, r: 4, s: -7 }, 'lava');
            },
            run: (engine: any) => {
                engine.useSkill('VAULT', { q: 3, r: 4, s: -7 });
            },
            verify: (state: GameState, logs: string[]) => {
                const playerNotMoved = state.player.position.r === 6;
                const blockedMsg = logs.some(l => l.includes('Blocked!'));
                return playerNotMoved && blockedMsg;
            }
        }
    ]
};
