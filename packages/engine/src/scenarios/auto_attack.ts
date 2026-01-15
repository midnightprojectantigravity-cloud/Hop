import type { GameState } from '../types';
import type { ScenarioCollection } from './types';
import { AUTO_ATTACK } from '../skills/auto_attack';

/**
 * Auto Attack Scenarios
 * Tests: Passive skill mechanics, turn-start memory, and friendly fire prevention
 */
export const autoAttackScenarios: ScenarioCollection = {
    id: 'auto_attack',
    name: 'Auto Attack',
    description: 'Tests for auto-attack passive skill including turn-start memory and friendly fire logic',

    scenarios: [
        {
            id: 'auto_attack_punch',
            title: 'Auto Attack Punch',
            description: 'Enemy that was adjacent and stays adjacent gets punched.',
            relatedSkills: ['AUTO_ATTACK'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['passive', 'auto-attack', 'basic'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['AUTO_ATTACK']);
                // shieldBearer has 2 HP so survives the punch
                engine.spawnEnemy('shieldBearer', { q: 3, r: 5, s: -8 }, 'adjacent');
                // Set previous position to current (simulating start of turn)
                engine.state.player.previousPosition = { q: 3, r: 6, s: -9 };
            },

            run: (engine: any) => {
                // Use the wait action which triggers the turn cycle including auto-attack
                engine.wait();
            },

            verify: (state: GameState, logs: string[]) => {
                const enemy = state.enemies.find(e => e.id === 'adjacent');
                // Should have taken 1 damage (2 HP -> 1 HP)
                const tookDamage = !!(enemy && enemy.hp === 1);
                const punchMessage = logs.some(l => l.includes('attacked'));
                return tookDamage && punchMessage;
            }
        },

        {
            id: 'enemy_auto_attack',
            title: 'Enemy Auto Attack',
            description: 'Verify enemies use AUTO_ATTACK passive.',
            relatedSkills: ['AUTO_ATTACK'],
            category: 'combat',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['passive', 'enemy-ai', 'auto-attack'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, []);
                // Spawn enemy with AUTO_ATTACK
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'puncher');
                const puncher = engine.state.enemies.find((e: any) => e.id === 'puncher');
                if (!puncher.activeSkills) puncher.activeSkills = [];
                puncher.activeSkills.push({
                    id: 'AUTO_ATTACK',
                    name: 'Auto Attack',
                    description: 'Passive strike',
                    slot: 'passive',
                    cooldown: 0,
                    currentCooldown: 0,
                    range: 1,
                    upgrades: [],
                    activeUpgrades: []
                });

                // Set previous positions to simulate staying adjacent
                puncher.previousPosition = { q: 3, r: 5, s: -8 };
                engine.state.player.previousPosition = { q: 3, r: 6, s: -9 };
            },

            run: (engine: any) => {
                // Wait triggers end-of-turn passives
                engine.wait();
            },

            verify: (state: GameState, logs: string[]) => {
                // Player should have taken 1 damage
                const playerDamaged = state.player.hp === 2;
                const punchMessage = logs.some(l => l.includes('attacked'));
                return playerDamaged && punchMessage;
            }
        },

        {
            id: 'auto_attack_no_punch_new_neighbor',
            title: 'No Auto Attack on New Neighbor',
            description: 'Enemy that just became adjacent does NOT get punched by AUTO_ATTACK skill logic.',
            relatedSkills: ['AUTO_ATTACK'],
            category: 'combat',
            difficulty: 'advanced',
            isTutorial: false,
            tags: ['passive', 'turn-memory', 'edge-case'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['AUTO_ATTACK']);
                // Enemy spawns adjacent but player "just moved here"
                engine.spawnEnemy('shieldBearer', { q: 3, r: 5, s: -8 }, 'new_neighbor');
                // Set previous position to somewhere else (simulating player moved in)
                engine.state.player.previousPosition = { q: 3, r: 7, s: -10 };
            },

            run: (engine: any) => {
                // Directly call this module's execute function 
                // to test AUTO_ATTACK logic in isolation
                const prevNeighbors = [
                    { q: 3, r: 8, s: -11 }, // Not the enemy position
                    { q: 2, r: 7, s: -9 },
                ];
                const result = AUTO_ATTACK.execute(
                    engine.state,
                    engine.state.player,
                    undefined,
                    [],
                    {
                        previousNeighbors: prevNeighbors,
                        persistentTargetIds: [] // Simulating that NO one was adjacent at start
                    }
                );
                // Store result messages for verification
                engine.state.message = [...engine.state.message, ...result.messages];
            },

            verify: (_state: GameState, logs: string[]) => {
                const noPunchFromAutoAttack = !logs.some(l => l.includes('attacked shieldBearer'));
                return noPunchFromAutoAttack;
            }
        },

        {
            id: 'auto_attack_multi_unit_stress',
            title: 'Symmetry & Persistence Stress Test',
            description: 'Validates friendly fire, persistence, and spatial boundaries.',
            relatedSkills: ['AUTO_ATTACK'],
            category: 'combat',
            difficulty: 'advanced',
            isTutorial: false,
            tags: ['passive', 'stress-test', 'friendly-fire', 'persistence'],

            setup: (engine: any) => {
                // 1. Setup Player at valid center (4,5)
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['AUTO_ATTACK']);
                engine.state.player.previousPosition = { q: 4, r: 5, s: -9 };

                // 2. Setup Persistent Enemy (5,5) - Neighbor to (4,5) and (4,6)
                engine.spawnEnemy('shieldBearer', { q: 5, r: 5, s: -10 }, 'persistent_foe');
                const e1 = engine.getEnemy('persistent_foe');
                e1.previousPosition = { q: 5, r: 5, s: -10 };

                // 3. Setup New Enemy (4,7) - Neighbor to (4,6) but NOT (4,5)
                engine.spawnEnemy('footman', { q: 4, r: 7, s: -11 }, 'new_foe');
            },

            run: (engine: any) => {
                // Player moves to 4,6
                // Persistent Foe (5,5) is neighbor to (4,5) and (4,6). HIT.
                // New Foe (4,7) is neighbor to (4,6) but not (4,5). MISS.
                engine.move({ q: 4, r: 6, s: -10 });
            },

            verify: (state: GameState, _logs: string[]) => {
                const e1 = state.enemies.find(e => e.id === 'persistent_foe');
                const e2 = state.enemies.find(e => e.id === 'new_foe');
                const hitPersistent = !!(e1 && e1.hp < e1.maxHp);
                const missedNew = !!(e2 && e2.hp === e2.maxHp);
                return hitPersistent && missedNew;
            }
        }
    ]
};
