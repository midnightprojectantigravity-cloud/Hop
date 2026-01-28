import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexEquals, getNeighbors, getHexLine } from '../hex';
import { getEnemyAt } from '../helpers';
import { SKILL_JUICE_SIGNATURES } from '../systems/juice-manifest';
import { isBlockedByWall, isBlockedByLava, isBlockedByActor, validateRange } from '../systems/validation';
import { getAreaTargets } from '../systems/navigation';

/**
 * Implementation of the Vault skill
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

        if (!validateRange(attacker.position, target, 2)) {
            messages.push('Out of range!');
            return { effects, messages, consumesTurn: false };
        }

        if (isBlockedByWall(state, target) || isBlockedByLava(state, target) || isBlockedByActor(state, target)) {
            messages.push('Blocked!');
            return { effects, messages, consumesTurn: false };
        }

        // State-Shifting Logic: Identity toggle based on turn parity
        const isStunTurn = state.turnNumber % 2 !== 0;

        // JUICE: Anticipation - Cyan trajectory arc
        effects.push(...SKILL_JUICE_SIGNATURES.VAULT.anticipation(attacker.position, target));

        // JUICE: Execution - Vault leap animation
        const vaultPath = getHexLine(attacker.position, target);
        effects.push(...SKILL_JUICE_SIGNATURES.VAULT.execution(vaultPath));

        effects.push({
            type: 'Displacement',
            target: 'self',
            destination: target,
            path: vaultPath,
            animationDuration: 250  // Slower, acrobatic leap
        });

        if (isStunTurn) {
            messages.push('Stun Vault executed!');
            const neighbors = getNeighbors(target);
            for (const n of neighbors) {
                const enemy = getEnemyAt(state.enemies, n);
                if (enemy) {
                    effects.push({ type: 'ApplyStatus', target: n, status: 'stunned', duration: 1 });
                }
            }

            // JUICE: Impact - Heavy (stun landing)
            effects.push(...SKILL_JUICE_SIGNATURES.VAULT.impact(target, true));

            messages.push('Slam landing! Neighbors stunned.');
        } else {
            // JUICE: Impact - Light (normal landing)
            effects.push(...SKILL_JUICE_SIGNATURES.VAULT.impact(target, false));

            messages.push('Vaulted!');
        }

        return { effects, messages };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const range = 2;
        return getAreaTargets(state, origin, range).filter(p => {
            if (hexEquals(p, origin)) return false;
            return !isBlockedByWall(state, p) && !isBlockedByLava(state, p) && !isBlockedByActor(state, p);
        });
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
