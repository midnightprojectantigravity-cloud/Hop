import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, hexEquals, getNeighbors } from '../hex';
import { getEnemyAt } from '../helpers';

/**
 * Implementation of the Vault skill (Enyo Utility)
 * State-Shifting: Identity toggles between "Vault" and "Stun Vault" based on turn parity.
 */
export const VAULT: SkillDefinition = {
    id: 'VAULT',
    name: (state: GameState) => (state.turnNumber % 2 !== 0) ? 'Stun Vault' : 'Vault',
    description: (state: GameState) => (state.turnNumber % 2 !== 0)
        ? 'Leap to an empty tile and stun neighbors. (Odd Turn)'
        : 'Leap to an empty tile. (Even Turn)',
    slot: 'utility',
    icon: '🏃',
    baseVariables: {
        range: 2,
        cost: 0,
        cooldown: 0,
    },
    execute: (state: GameState, attacker: Actor, target?: Point, _activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const dist = hexDistance(attacker.position, target);
        if (dist < 1 || dist > 2) {
            messages.push('Out of range!');
            return { effects, messages, consumesTurn: false };
        }

        const isWall = state.wallPositions.some(w => hexEquals(w, target));
        const isLava = state.lavaPositions.some(l => hexEquals(l, target));
        const isOccupiedByEnemy = !!getEnemyAt(state.enemies, target);

        if (isWall || isLava || isOccupiedByEnemy) {
            messages.push('Blocked!');
            return { effects, messages, consumesTurn: false };
        }

        // State-Shifting Logic: Identity toggle based on turn parity
        // Turn 1 (Odd): Stun Vault
        // Turn 2 (Even): Vault
        const isStunTurn = state.turnNumber % 2 !== 0;

        effects.push({ type: 'Displacement', target: 'self', destination: target });

        if (isStunTurn) {
            messages.push('Stun Vault executed!');
            const neighbors = getNeighbors(target);
            for (const n of neighbors) {
                const enemy = getEnemyAt(state.enemies, n);
                if (enemy) {
                    effects.push({ type: 'ApplyStatus', target: n, status: 'stunned', duration: 1 });
                }
            }
            effects.push({ type: 'Juice', effect: 'shake' });
            messages.push('Slam landing! Neighbors stunned.');
        } else {
            messages.push('Vaulted!');
        }

        return { effects, messages };
    },
    upgrades: {},
    scenarios: [
        {
            id: 'vault_shift_stun',
            title: 'Vault State-Shifting: Stun (Turn 1)',
            description: 'Verify vault stuns on Turn 1 (Odd).',
            setup: (engine: any) => {
                engine.setTurn(1);
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['VAULT']);
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'victim');
            },
            run: (engine: any) => {
                // Vault adjacent to victim
                engine.useSkill('VAULT', { q: 3, r: 4, s: -7 });
            },
            verify: (_state: GameState, logs: string[]) => {
                return logs.some(l => l.includes('Stun Vault executed!'));
            }
        },
        {
            id: 'vault_shift_normal',
            title: 'Vault State-Shifting: Normal (Turn 2)',
            description: 'Verify vault is normal on Turn 2 (Even).',
            setup: (engine: any) => {
                engine.setTurn(2);
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['VAULT']);
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'victim');
            },
            run: (engine: any) => {
                engine.useSkill('VAULT', { q: 3, r: 4, s: -7 });
            },
            verify: (_state: GameState, logs: string[]) => {
                return logs.some(l => l.includes('Vaulted!')) && !logs.some(l => l.includes('Slam landing!'));
            }
        }
    ]
};
