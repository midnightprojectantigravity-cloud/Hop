import type { GameState } from '../types';
import type { TestScenario, ScenarioCollection } from './types';

/**
 * Integration Scenarios
 * Tests that involve multiple skills working together
 * 
 * This demonstrates the power of the centralized scenarios folder:
 * scenarios are no longer limited to testing a single skill!
 */
export const integrationScenarios: ScenarioCollection = {
    id: 'integration',
    name: 'Integration Tests',
    description: 'Multi-skill integration scenarios testing complex interactions',

    scenarios: [
        {
            id: 'combo_grapple_shield',
            title: 'Grapple + Shield Combo',
            description: 'Test using grapple hook followed by shield throw in sequence',
            relatedSkills: ['GRAPPLE_HOOK', 'SHIELD_THROW'],
            category: 'combat',
            difficulty: 'advanced',
            isTutorial: true,
            tags: ['combo', 'displacement', 'multi-skill'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 6, s: -10 }, ['GRAPPLE_HOOK', 'SHIELD_THROW']);
                engine.spawnEnemy('footman', { q: 7, r: 6, s: -13 }, 'target1');
                engine.spawnEnemy('footman', { q: 4, r: 3, s: -7 }, 'target2');
                engine.setTile({ q: 4, r: 2, s: -6 }, 'lava');
            },

            run: (engine: any) => {
                // 1. Grapple target1 to pull them closer
                engine.useSkill('GRAPPLE_HOOK', { q: 7, r: 6, s: -13 });
                // 2. Shield throw target2 into lava
                engine.useSkill('SHIELD_THROW', { q: 4, r: 3, s: -7 });
            },

            verify: (state: GameState) => {
                const target1 = state.enemies.find(e => e.id === 'target1');
                const target2Dead = !state.enemies.find(e => e.id === 'target2');
                // Target1 should be closer, target2 should be dead in lava
                return target1 !== undefined && target1.position.q < 7 && target2Dead;
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
                engine.setPlayer({ q: 4, r: 6, s: -10 }, ['GRAPPLE_HOOK', 'AUTO_ATTACK']);
                // Enemy starts far, will be pulled adjacent
                engine.spawnEnemy('shieldBearer', { q: 7, r: 6, s: -13 }, 'victim');
                // This enemy starts adjacent and should get auto-attacked
                engine.spawnEnemy('footman', { q: 4, r: 5, s: -9 }, 'adjacent');
                engine.state.player.previousPosition = { q: 4, r: 6, s: -10 };
            },

            run: (engine: any) => {
                // Grapple the distant enemy
                engine.useSkill('GRAPPLE_HOOK', { q: 7, r: 6, s: -13 });
            },

            verify: (state: GameState, logs: string[]) => {
                const victim = state.enemies.find(e => e.id === 'victim');
                const adjacent = state.enemies.find(e => e.id === 'adjacent');

                // Victim should be pulled but NOT auto-attacked (wasn't adjacent at turn start)
                const victimPulled = !!(victim && victim.position.q < 7);
                const victimNotHit = !!(victim && victim.hp === victim.maxHp);

                // Adjacent enemy should be auto-attacked
                const adjacentHit = !!(adjacent && adjacent.hp < adjacent.maxHp);

                return victimPulled && victimNotHit && adjacentHit;
            }
        },

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
                engine.setPlayer({ q: 5, r: 5, s: -10 }, ['GRAPPLE_HOOK', 'SHIELD_THROW']);

                // Create a gauntlet of hazards
                engine.spawnEnemy('footman', { q: 5, r: 3, s: -8 }, 'victim1');
                engine.spawnEnemy('footman', { q: 5, r: 7, s: -12 }, 'victim2');
                engine.spawnEnemy('footman', { q: 8, r: 5, s: -13 }, 'victim3');

                // Hazards
                engine.setTile({ q: 5, r: 2, s: -7 }, 'lava');
                engine.setTile({ q: 5, r: 8, s: -13 }, 'lava');
                engine.setTile({ q: 9, r: 5, s: -14 }, 'wall');
            },

            run: (engine: any) => {
                // Push victim1 into lava
                engine.useSkill('SHIELD_THROW', { q: 5, r: 3, s: -8 });
                // Push victim2 into lava
                engine.useSkill('SHIELD_THROW', { q: 5, r: 7, s: -12 });
                // Pull victim3 (should hit wall and get stunned)
                engine.useSkill('GRAPPLE_HOOK', { q: 9, r: 5, s: -14 });
            },

            verify: (state: GameState) => {
                const victim1Dead = !state.enemies.find(e => e.id === 'victim1');
                const victim2Dead = !state.enemies.find(e => e.id === 'victim2');
                const victim3 = state.enemies.find(e => e.id === 'victim3');

                // Victims 1 and 2 should be dead, victim 3 should be alive but closer
                return victim1Dead && victim2Dead && victim3 !== undefined && victim3.position.q < 9;
            }
        }
    ]
};
