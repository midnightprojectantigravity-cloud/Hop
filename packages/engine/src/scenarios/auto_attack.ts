import type { GameState } from '../types';
import type { ScenarioCollection } from './types';


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
            id: 'auto_attack_persistence_stress_test',
            title: 'Persistence: Three-Point Validation',
            description: 'Verifies that Auto-Attack only hits units that were adjacent at BOTH start and end.',
            relatedSkills: ['AUTO_ATTACK', 'BASIC_MOVE'],
            category: 'combat',
            difficulty: 'advanced',
            isTutorial: false,
            tags: ['passive', 'spatial-memory', 'edge-case'],

            setup: (engine: any) => {
                // Player starts at (4,5)
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['AUTO_ATTACK', 'BASIC_MOVE']);

                // FOE 1 (Persistent): At (5,5). Neighbor to start (4,5) and end (4,6).
                engine.spawnEnemy('footman', { q: 5, r: 5, s: -10 }, 'persistent_foe');

                // FOE 2 (New): At (4,7). NOT neighbor to start (4,5), but is to end (4,6).
                engine.spawnEnemy('footman', { q: 4, r: 7, s: -11 }, 'new_neighbor');

                // FOE 3 (Moving Away): At (5,4). Neighbor to start (4,5), but NOT to end (4,6).
                engine.spawnEnemy('footman', { q: 5, r: 4, s: -9 }, 'former_neighbor');

                // Mock the Identity Phase memory
                engine.state.player.previousPosition = { q: 4, r: 5, s: -9 };
            },
            run: (engine: any) => {
                // Player moves to (4, 6)
                engine.move({ q: 4, r: 6, s: -10 });
            },
            verify: (state: GameState, logs: string[]) => {
                const pFoe = state.enemies.find(e => e.id === 'persistent_foe');
                const nFoe = state.enemies.find(e => e.id === 'new_neighbor');
                const fFoe = state.enemies.find(e => e.id === 'former_neighbor');

                const checks = {

                    // 1. HIT: Persistent foe took damage and is now dead
                    persistentDead: !pFoe || pFoe.hp < pFoe.maxHp,

                    // 2. SAFE: New neighbor ignored (wasn't there at start)
                    ignoredNew: nFoe && nFoe.hp === nFoe.maxHp,

                    // 3. SAFE: Former neighbor ignored (is too far now)
                    ignoredFormer: fFoe && fFoe.hp === fFoe.maxHp,

                    // 4. LOGS: Check for correct feedback
                    logFound: logs.some(l => l.includes('attacked footman')),

                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Scenario Failed Details:', checks);
                    console.log('Current Player Pos:', state.player.position);
                    console.log('Logs found:', logs);
                }

                /**
                 * WHY THIS VERIFICATION:
                 * This "Triple Check" ensures the skill logic correctly intersects 
                 * the set of START neighbors and END neighbors.
                 */

                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'enemy_auto_attack_no_friendly_fire',
            title: 'Enemy Auto-Attack: Team Alignment',
            description: 'Ensures enemy passives only target the player and not their own allies.',
            relatedSkills: ['AUTO_ATTACK'],
            category: 'combat',
            difficulty: 'advanced',
            isTutorial: false,
            tags: ['passive', 'alignment', 'friendly-fire'],

            setup: (engine: any) => {
                // 1. Setup Player at (3,6)
                engine.setPlayer({ q: 3, r: 6, s: -9 }, []);

                // 2. Setup Enemy Attacker at (3,5) with AUTO_ATTACK
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'enemy_attacker');
                const attacker = engine.state.enemies.find((e: any) => e.id === 'enemy_attacker');
                if (attacker) {
                    attacker.activeSkills = [{ id: 'AUTO_ATTACK', range: 1 }];
                    attacker.previousPosition = { q: 3, r: 5, s: -8 };
                }

                // 3. Setup another Enemy (Ally to Attacker) at (2,6)
                // Both (3,6) [Player] and (2,6) [Enemy Ally] are neighbors to (3,5)
                engine.spawnEnemy('shieldBearer', { q: 2, r: 6, s: -8 }, 'enemy_ally');

                // Mock spatial memory for the enemy
                attacker.previousPosition = { q: 3, r: 5, s: -8 };
                engine.state.player.previousPosition = { q: 3, r: 6, s: -9 };
            },
            run: (engine: any) => {
                // Enemy stands still (Wait) to trigger the persistence check
                engine.wait();
            },
            verify: (state: GameState, logs: string[]) => {
                const playerHp = state.player.hp;
                const enemyAlly = state.enemies.find(e => e.id === 'enemy_ally');

                const checks = {

                    // VERIFICATION: Target Discrimination
                    // Player should be hit, but the Enemy Ally must be safe.
                    playerHit: playerHp < 3, // Assuming 3 is starting HP
                    allySafe: enemyAlly && enemyAlly.hp === enemyAlly.maxHp,

                    // VERIFICATION: Logs
                    hitPlayerLog: logs.some(l => l.includes('attacked you')),
                    hitAllyLog: !logs.some(l => l.includes('attacked enemy_ally'))
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Scenario Failed Details:', checks);
                    console.log('Current Player Pos:', state.player.position);
                    console.log('Logs found:', logs);
                }

                /**
                 * WHY THIS VERIFICATION:
                 * This proves the skill's target selection logic includes an 
                 * alignment filter (Target != Attacker.alignment).
                 */
                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
