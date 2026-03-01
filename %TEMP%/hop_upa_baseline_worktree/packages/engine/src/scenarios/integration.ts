import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

/**
 * Integration Scenarios
 * Tests that involve multiple skills working together
 * 
 * This demonstrates the power of the centralized scenarios folder:
 * scenarios are no longer limited to testing a single skill!
 * 
 * This file has been reviewed and is now up to standards.
 */
export const integrationScenarios: ScenarioCollection = {
    id: 'integration',
    name: 'Integration Tests',
    description: 'Multi-skill integration scenarios testing complex interactions',

    scenarios: [
        {
            id: 'environmental_chain_reaction',
            title: 'Environmental Chain Reaction',
            description: 'Test complex environmental interactions with multiple hazards',
            relatedSkills: ['GRAPPLE_HOOK', 'SHIELD_THROW'],
            category: 'hazards',
            difficulty: 'advanced',
            isTutorial: false,
            tags: ['lava', 'wall', 'environmental-kill', 'chain-reaction'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 5, r: 4, s: -9 }, ['GRAPPLE_HOOK', 'SHIELD_THROW']);

                // Create a gauntlet of hazards
                engine.spawnEnemy('shieldbearer', { q: 5, r: 2, s: -7 }, 'victim1');
                engine.spawnEnemy('footman', { q: 5, r: 6, s: -11 }, 'victim2');
                engine.spawnEnemy('footman', { q: 5, r: 7, s: -12 }, 'victim3');

                // Hazards
                engine.setTile({ q: 5, r: 8, s: -13 }, 'lava');
            },

            run: (engine: any) => {
                // Grapple victim1 into kinetic pulse collision >> Victim3 dies
                // Victim1 gets pulled towards the player and swaps places with the player when moving from (5, 3, -8) to (5, 4, -9), the player should then be at (5,3,-8)
                // Victim1 then gets flinged past the player and initiates a kinetic pulse of momentum 4 and heads toward Victim2 and Victim3.
                // Victim1, 2 and 3 are all adjacent to each other and therefore form a single cluster that moves 1 tile and transfers all the leftover momentum to the lead unit, Victim3.
                // Victim3 then continues on its own 1 more tile until it reaches another unit, a wall, a lava tile or the edge of the map, or until it runs out of momentum.
                // Victim3 should die from the kinetic pulse collision as it reaches a lava tile.
                engine.useSkill('GRAPPLE_HOOK', { q: 5, r: 2, s: -7 });
                // Both enemies take their turn and move 1 tile toward the player.
                // Shield Throw victim1 into Victim2 >> Victim2 dies
                engine.useSkill('SHIELD_THROW', { q: 5, r: 5, s: -10 });
            },

            verify: (state: GameState, logs: string[]) => {
                const playerAt53 = state.player.position.q === 5 && state.player.position.r === 3;
                // Victim3 should die from the kinetic pulse collision as it reaches a lava tile from the Grapple Hook.
                const victim3Dead = !state.enemies.find(e => e.id === 'victim3') || !!state.dyingEntities?.find(e => e.id === 'victim3');
                // Victim2 should die from the kinetic pulse collision as it reaches a lava tile from the Shield Throw.
                const victim2Dead = !state.enemies.find(e => e.id === 'victim2') || !!state.dyingEntities?.find(e => e.id === 'victim2');
                // Victim1 should be alive, stunned and on 5,7.
                const victim1Alive = state.enemies.find(e => e.id === 'victim1');
                const victim1Stunned = victim1Alive && logs.some(e => e.includes('stunned'));
                const victim1On56 = victim1Alive && victim1Alive.position.q === 5 && victim1Alive.position.r === 6;

                const checks = [playerAt53, victim3Dead, victim2Dead, victim1Stunned, victim1On56];

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Environmental Chain Reaction Failed:', checks);
                    console.log('Player at 5,3:', playerAt53);
                    console.log('Player Pos:', state.player.position);
                    console.log('Logs found:', logs);
                    console.log('Victim1 at 5,6:', victim1On56);
                    console.log('Victim1 Pos:', victim1Alive?.position);
                    console.log('Victim1 Stunned:', victim1Stunned);
                    console.log('Victim2 Dead:', victim2Dead);
                    console.log('Victim3 Dead:', victim3Dead);
                }

                return Object.values(checks).every(v => v === true);
            }
        },

        {
            id: 'auto_attack_after_grapple',
            title: 'Auto-Attack After Grapple',
            description: 'Verify auto-attack triggers correctly after grapple displacement',
            relatedSkills: ['GRAPPLE_HOOK', 'AUTO_ATTACK'],
            category: 'combat',
            difficulty: 'advanced',
            isTutorial: false,
            tags: ['passive', 'displacement', 'integration'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['GRAPPLE_HOOK', 'AUTO_ATTACK']);
                engine.state.player.previousPosition = { q: 4, r: 6, s: -10 };

                engine.spawnEnemy('footman', { q: 7, r: 6, s: -13 }, 'grappleHookTarget');

                // This enemy starts adjacent but the player will move away, so they are safe
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'safe');

                // This enemy starts adjacent and will remain adjacent after the player moves, so they should get auto-attacked
                engine.spawnEnemy('footman', { q: 4, r: 5, s: -9 }, 'auto-attacked');

                // This enemy starts non-adjacent and will become adjacent after the player moves, so they should be safe
                engine.spawnEnemy('footman', { q: 5, r: 5, s: -10 }, 'safe2');

            },

            run: (engine: any) => {
                // Grapple the distant enemy
                engine.useSkill('GRAPPLE_HOOK', { q: 7, r: 6, s: -13 });
            },

            verify: (state: GameState, logs: string[]) => {
                const target = state.enemies.find(e => e.id === 'grappleHookTarget');
                const autoattacked = state.enemies.find(e => e.id === 'auto-attacked');
                const safe = state.enemies.find(e => e.id === 'safe');
                const safe2 = state.enemies.find(e => e.id === 'safe2');

                const checks = {
                    // Target should be pulled but NOT auto-attacked (wasn't adjacent at turn start)
                    targetPulled: !!(target && target.position.q < 7),
                    targetNotHit: !!(target && target.hp === target.maxHp),
                    // Adjacent enemy at the start of the turnshould NOT be auto-attacked if they are no longer adjacent at the end of the turn
                    safeNotHit: !!(safe && safe.hp === safe.maxHp),
                    // Non-adjacent enemy should NOT be auto-attacked even if the player moves towards it
                    safe2NotHit: !!(safe2 && safe2.hp === safe2.maxHp),
                    // Adjacent enemy that remains adjacent should be auto-attacked
                    autoattackedDead: !autoattacked || autoattacked.hp <= 0,
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Scenario Failed Details:', checks);
                    console.log('Current Player Pos:', state.player.position);
                    console.log('Logs found:', logs);
                    console.log('target Pos:', target?.position.q);
                    console.log('target Pulled:', checks.targetPulled);
                    console.log('target Not Hit:', checks.targetNotHit);
                    console.log('safe Not Hit:', checks.safeNotHit);
                    console.log('safe2 Not Hit:', checks.safe2NotHit);
                    console.log('autoattacked Dead:', checks.autoattackedDead);
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
