import { hexDistance } from '../hex';
import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

/**
 * Kinetic Tri-Trap Scenarios
 * Tests: Trap deployment
 * This file is work in progress, use it as TDD for the actual skill implementation
 */
export const kineticTriTrapScenarios: ScenarioCollection = {
    id: 'kinetic_tri_trap',
    name: 'Kinetic Tri-Trap',
    description: 'Tests for trap deployment and fling mechanics',

    scenarios: [
        {
            id: 'tri_trap_basic_deployment',
            title: 'Trap Deployment',
            description: 'Deploy 3 traps on axial tiles at range 2.',
            relatedSkills: ['KINETIC_TRI_TRAP'],
            category: 'deployment',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['trap', 'deployment'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 5, r: 5, s: -10 }, ['KINETIC_TRI_TRAP']);
                engine.state.player.archetype = 'HUNTER';
            },
            run: (engine: any) => {
                engine.useSkill('KINETIC_TRI_TRAP', null);
            },
            verify: (state: GameState, logs: string[]) => {
                const playerPos = state.player.position;
                const traps = state.traps || [];

                const checks = {
                    countIsThree: traps.length === 3,
                    isAtRangeTwo: traps.every(t => hexDistance(t.position, playerPos) === 2),
                    isAxialToPlayer: traps.every(t =>
                        t.position.q === playerPos.q ||
                        t.position.r === playerPos.r ||
                        t.position.s === playerPos.s
                    ),
                    trapsHidden: traps.every(t => !t.isRevealed)
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Scenario Tri-Trap Deployment Failed:', checks);
                    console.log('Traps:', state.traps);
                    console.log('Logs:', logs);
                }

                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'tri_trap_state_tracking',
            title: 'Trap State Tracking',
            description: 'Traps are tracked with correct owner and hidden state.',
            relatedSkills: ['KINETIC_TRI_TRAP'],
            category: 'state',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['trap', 'state'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 5, r: 5, s: -10 }, ['KINETIC_TRI_TRAP']);
                engine.state.player.archetype = 'HUNTER';
            },
            run: (engine: any) => {
                engine.useSkill('KINETIC_TRI_TRAP', null);
                engine.useSkill('KINETIC_TRI_TRAP', null);
            },
            verify: (state: GameState, logs: string[]) => {
                const traps = state.traps;
                // Check that the old trap is gone and exactly 3 new ones exist
                const checks = {
                    trapsExist: traps && traps.length > 0,
                    allHidden: traps?.every(t => !t.isRevealed) ?? false,
                    allZeroCooldown: traps?.every(t => t.cooldown === 0) ?? false,
                    deployMessage: logs.some(l => l.includes('trap') || l.includes('Trap')),
                    trapsCount: traps?.length === 3,
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Trap State Failed:', checks);
                    console.log('Traps:', state.traps);
                }

                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
