import type { GameState } from '../types';
import type { ScenarioCollection } from './types';
import { hexEquals } from '../hex';

/**
 * Basic Attack Scenarios
 * Tests: Melee combat, range validation, and move-attack interaction
 */
export const basicAttackScenarios: ScenarioCollection = {
    id: 'basic_attack',
    name: 'Basic Attack',
    description: 'Tests for basic melee attack mechanics including range and move-to-attack logic',

    scenarios: [
        {
            id: 'basic_attack_player_mechanics',
            title: 'Player Basic Attack: Range & Bump',
            description: 'Validates range enforcement, turn accounting, and bump-attack redirection.',
            relatedSkills: ['BASIC_ATTACK'],
            category: 'combat',
            tags: ['melee', 'targeting', 'bump-attack'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['BASIC_ATTACK']);
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'adj_victim');
                engine.spawnEnemy('footman', { q: 3, r: 4, s: -7 }, 'far_victim');
                // Use the engine's built-in state to track history if possible, 
                // or just use the end state for verification.
            },
            run: (engine: any) => {
                // 1. Attempt out-of-range attack
                engine.useSkill('BASIC_ATTACK', { q: 3, r: 4, s: -7 });

                // 2. Trigger "Bump Attack" (Moving into occupied tile)
                engine.move({ q: 3, r: 5, s: -8 });
            },
            verify: (state: GameState, logs: string[]) => {
                const adj = state.enemies.find(e => e.id === 'adj_victim');
                const far = state.enemies.find(e => e.id === 'far_victim');

                const checks = {
                    // VERIFICATION: Range Enforcement
                    // Should still have 1 HP because the attack was out of range.
                    farStaysAlive: far && far.hp === 1,
                    rangeError: logs.some(l => l.includes('out of range')),

                    // VERIFICATION: Bump Attack Success
                    // The adjacent enemy should be damaged/dead.
                    adjTookDamage: !adj || adj.hp <= 0,

                    // VERIFICATION: Spatial Integrity
                    // IMPORTANT: The player should NOT have moved into the enemy's hex.
                    playerPositionHeld: hexEquals(state.player.position, { q: 3, r: 6, s: -9 }),

                    // VERIFICATION: Turn Accounting
                    // If your GameState tracks total turns, we check it here.
                    // Assuming 1 successful action occurred, turnsSpent should be 1.
                    oneTurnConsumed: state.turnsSpent === 1,
                }

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Scenario Failed Details:', checks);
                    console.log('Current Player Pos:', state.player.position);
                    console.log('Logs found:', logs);
                }

                return Object.values(checks).every(v => v === true);

            }
        },
        {
            id: 'enemy_basic_attack_cycle',
            title: 'Enemy Basic Attack: Resolution',
            description: 'Verifies that enemies resolve telegraphed attacks correctly.',
            relatedSkills: ['BASIC_ATTACK'],
            category: 'combat',
            tags: ['enemy-ai', 'telegraph'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, []);
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'attacker');

                const attacker = engine.state.enemies.find((e: any) => e.id === 'attacker');
                attacker.intent = 'BASIC_ATTACK';
                attacker.intentPosition = { q: 3, r: 6, s: -9 };

                if (!attacker.activeSkills) attacker.activeSkills = [];
                attacker.activeSkills.push({
                    id: 'BASIC_ATTACK',
                    range: 1,
                    cooldown: 0,
                    currentCooldown: 0
                });
            },
            run: (engine: any) => {
                engine.wait(); // Resolves the enemy telegraph
            },
            verify: (state: GameState, logs: string[]) => {
                const checks = {
                    // Player should have taken 1 damage (assuming 3 is max HP)
                    playerHit: state.player.hp === 2,
                    hitLog: logs.some(l => l.includes('attacked you')),
                }

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Scenario Failed Details:', checks);
                    console.log('Current Player Pos:', state.player.position);
                    console.log('Logs found:', logs);
                }

                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
