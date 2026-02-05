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
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['VAULT']);
                engine.setTile({ q: 3, r: 5, s: -8 }, 'lava');
                engine.spawnEnemy('footman', { q: 4, r: 4, s: -8 }, 'victim');
            },
            run: (engine: any) => {
                engine.useSkill('VAULT', { q: 3, r: 4, s: -7 });
            },
            verify: (_state: GameState, logs: string[]) => {
                const checks = {
                    stunned: logs.some(l => l.includes('Stun Vault executed!'))
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Vault Stun Failed:', checks);
                    console.log('Logs:', logs);
                }

                return Object.values(checks).every(v => v === true);
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
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['VAULT']);
                engine.setTile({ q: 3, r: 5, s: -8 }, 'lava');
                engine.spawnEnemy('footman', { q: 4, r: 3, s: -7 }, 'victim');
            },
            run: (engine: any) => {
                engine.wait();
                engine.useSkill('VAULT', { q: 3, r: 4, s: -7 });
            },
            verify: (_state: GameState, logs: string[]) => {
                const checks = {
                    vaulted: logs.some(l => l.includes('Vaulted!'))
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Vault Normal Failed:', checks);
                    console.log('Logs:', logs);
                }

                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
