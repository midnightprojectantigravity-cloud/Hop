import type { GameState } from '../types';
import type { ScenarioCollection } from './types';
import { buildRunSummary, evaluateObjectives } from '../systems/run-objectives';

export const objectiveScenarios: ScenarioCollection = {
    id: 'objectives',
    name: 'Objectives',
    description: 'Daily objective validation for turn-limit and hazard constraints.',
    scenarios: [
        {
            id: 'objective_turn_limit_boundary',
            title: 'Objective: Turn Limit Boundary',
            description: 'Turn-limit objective passes at boundary and fails above boundary.',
            relatedSkills: ['BASIC_MOVE'],
            category: 'progression',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['objective', 'turn-limit'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 4, s: -8 }, []);
                engine.state.runObjectives = [
                    { id: 'TURN_LIMIT', label: 'Finish within 1 turns', target: 1 }
                ];
            },
            run: (engine: any) => {
                engine.wait(); // turnsSpent increments to 1
            },
            verify: (state: GameState) => {
                const resultsAtBoundary = evaluateObjectives(state);
                const boundaryPass = resultsAtBoundary[0]?.success === true;
                const boundaryScore = buildRunSummary(state).score;
                const syntheticOverLimit = evaluateObjectives({
                    ...state,
                    turnsSpent: (state.turnsSpent || 0) + 1
                } as GameState);
                const overLimitState = {
                    ...state,
                    turnsSpent: (state.turnsSpent || 0) + 1
                } as GameState;
                const overLimitScore = buildRunSummary(overLimitState).score;
                const overLimitFails = syntheticOverLimit[0]?.success === false;
                const scoreDropsWhenObjectiveFails = overLimitScore < boundaryScore;
                return boundaryPass && overLimitFails && scoreDropsWhenObjectiveFails;
            }
        },
        {
            id: 'objective_hazard_constraint_fail_on_hazard',
            title: 'Objective: Hazard Constraint',
            description: 'Hazard objective fails after prohibited hazard interaction.',
            relatedSkills: ['BASIC_MOVE'],
            category: 'hazards',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['objective', 'hazard'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 4, s: -8 }, []);
                engine.state.runObjectives = [
                    { id: 'HAZARD_CONSTRAINT', label: 'Take no hazard damage', target: 0 }
                ];
                engine.state.tiles.set('4,4', {
                    baseId: 'STONE',
                    position: { q: 4, r: 4, s: -8 },
                    traits: new Set(['WALKABLE']),
                    effects: [{ id: 'FIRE', duration: -1, potency: 1 }]
                });
            },
            run: (engine: any) => {
                engine.wait();
            },
            verify: (state: GameState) => {
                const result = evaluateObjectives(state)[0];
                return (state.hazardBreaches || 0) > 0 && !!result && result.success === false;
            }
        }
    ]
};
