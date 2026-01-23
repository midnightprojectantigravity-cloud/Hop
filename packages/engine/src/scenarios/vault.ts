import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

/**
 * Vault Scenarios
 * Tests: State-shifting identity (Stun vs Normal) based on turn parity
 */
export const vaultScenarios: ScenarioCollection = {
    id: 'vault',
    name: 'Vault',
    description: 'Tests for vault mechanics including state-shifting behavior between odd and even turns',

    scenarios: [
        {
            id: 'vault_shift_stun',
            title: 'Vault Stun (Odd Turn)',
            description: 'Verify vault stuns neighbors on Turn 1.',
            relatedSkills: ['VAULT'],
            category: 'movement',
            difficulty: 'intermediate',
            isTutorial: true,
            tags: ['state-shift', 'stun', 'movement'],

            setup: (engine: any) => {
                engine.setTurn(1);
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['VAULT']);
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'victim');
            },
            run: (engine: any) => {
                engine.useSkill('VAULT', { q: 3, r: 4, s: -7 });
            },
            verify: (_state: GameState, logs: string[]) => {
                return logs.some(l => l.includes('Stun Vault executed!'));
            }
        },
        {
            id: 'vault_shift_normal',
            title: 'Vault Normal (Even Turn)',
            description: 'Verify vault is normal on Turn 2.',
            relatedSkills: ['VAULT'],
            category: 'movement',
            difficulty: 'intermediate',
            isTutorial: true,
            tags: ['state-shift', 'movement'],

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
