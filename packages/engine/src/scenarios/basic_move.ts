import type { GameState } from '../types';
import type { ScenarioCollection } from './types';
import { hexEquals } from '../hex';

/**
 * Basic Move Scenarios
 * Tests: Standard movement and spatial state updates
 */
/**
 * Basic Move Scenarios
 * Adjusted to center map coordinates (4, 5, -9)
 */
export const basicMoveScenarios: ScenarioCollection = {
    id: 'basic_move',
    name: 'Basic Move',
    description: 'Fundamental movement mechanics',

    scenarios: [
        {
            id: 'walk_to_tile',
            title: 'Movement 101',
            description: 'Move your character from the center to an adjacent tile.',
            relatedSkills: ['BASIC_MOVE'],
            category: 'movement',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['movement', 'basics'],

            setup: (engine: any) => {
                // Starting at the new center
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['BASIC_MOVE']);
                engine.setTile({ q: 4, r: 6, s: -10 }, 'wall');
            },
            run: (engine: any) => {
                // Moving one step "Down" in flat-top coordinates
                // (q remains 4, r increases to 6, s decreases to -10)
                // Should fail due to wall
                engine.move({ q: 4, r: 6, s: -10 });
                // Moving one step "Up" in flat-top coordinates
                // (q remains 4, r decreases to 4 from original 5, s increases to -8 from original -9)
                // Should succeed only if the wall successfully blocked previous movement attempt.
                engine.move({ q: 4, r: 4, s: -8 });
            },
            verify: (state: GameState, logs: string[]) => {
                const checks = {
                    positionCorrect: hexEquals(state.player.position, { q: 4, r: 4, s: -8 }),
                    logFound: logs.some(l => l.includes('blocked')),
                    oneTurnSpent: state.turnsSpent === 1
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Scenario Failed Details:', checks);
                    console.log('Final Position:', state.player.position);
                }

                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};