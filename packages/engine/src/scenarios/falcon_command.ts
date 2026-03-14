


import { hexDistance, hexEquals } from '../hex';
import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

/**
 * REFINED FALCON COMMAND
 * Focus: State transitions and Hex-Orbit validation.
 * 
 * User Feedback: 
 * - This file is work in progress, use it as TDD for the actual skill implementation
 * - Falcon should not be allowed to move and use a skill (peck, heal or Apex Strike) in the same turn. - DONE but not for heal skill, this should be a general rule, falcon should have BASIC_MOVE skill which consumes turn, skill consumes turn, so it should NOT be allowed to move and use a skill in the same turn.
 * - Falcon flies and should therefore not fall into lava or other ground hazards. - DONE but not 100%, there should be only one single place in code that checks for lava sink and it should be skipped if unit is flying.
 */
export const falconCommandScenarios: ScenarioCollection = {
    id: 'falcon_command_v2',
    name: "Falcon's Command",
    description: 'Validates Predator/Scout mode transitions and spatial orbit logic.',

    scenarios: [
        {
            id: 'falcon_predator_strike_path',
            title: 'Predator Mode: Mark and Lock',
            description: `
                Under IRES the command itself should set Predator mode and lock the prey target
                while keeping the player's turn open until they explicitly end it.
            `,
            relatedSkills: ['FALCON_COMMAND'],
            category: 'summon',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['falcon', 'summon', 'companion'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 9, s: -13 }, ['FALCON_COMMAND']);
                // Manual spawn to ensure exact start position for the test
                engine.spawnFalcon({ q: 3, r: 9, s: -12 }, 'my-falcon');
                engine.spawnEnemy('footman', { q: 4, r: 2, s: -6 }, 'prey');

            },
            run: (engine: any) => {
                engine.useSkill('FALCON_COMMAND', { q: 4, r: 2, s: -6 });
            },
            verify: (state: GameState, _logs: string[]) => {
                // const falcon = state.enemies.find(e =>
                //     e.subtype === 'falcon' && e.companionOf === state.player.id
                // ); // falcon should be allied to player so it seems weird to be finding it in the enemies array
                const falcon = state.companions?.find(c => c.id === 'my-falcon');

                const prey = state.enemies.find(e => e.id === 'prey');

                const checks = {
                    // VERIFICATION: Mode Transition
                    modeSet: falcon?.companionState?.mode === 'predator',
                    targetLocked: falcon?.companionState?.markTarget === 'prey',
                    preyHealthy: prey?.hp === prey?.maxHp,
                    turnRemainsOpen: state.turnsSpent === 0,
                };


                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Scenario Falcon Predator Strike Failed:', checks);
                    console.log('Falcon:', falcon);
                }

                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'falcon_scout_orbit',
            title: 'Scout Mode: Patrol Mark',
            description: `
                Ensures that in Scout mode, the command plants the patrol mark
                and keeps the turn open for further player decisions.
            `,
            relatedSkills: ['FALCON_COMMAND'],
            category: 'summon',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['falcon', 'summon', 'companion'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 9, s: -13 }, ['FALCON_COMMAND']);
                // Manual spawn to ensure exact start position for the test
                engine.spawnFalcon({ q: 3, r: 9, s: -12 }, 'my-falcon');
            },
            run: (engine: any) => {
                engine.useSkill('FALCON_COMMAND', { q: 3, r: 6, s: -9 });
            },
            verify: (state: GameState, _logs: string[]) => {
                const falcon = state.companions?.find(c => c.id === 'my-falcon');
                const markPos = { q: 3, r: 6, s: -9 };

                const checks = {
                    // VERIFICATION: Mode Transition
                    isScout: falcon?.companionState?.mode === 'scout',
                    patrolMarkSet: !!falcon
                        && typeof falcon.companionState?.markTarget === 'object'
                        && hexEquals(falcon.companionState.markTarget as any, markPos),
                    turnRemainsOpen: state.turnsSpent === 0,
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Scenario Falcon Scout Orbit Failed:', checks);
                    console.log('Falcon:', falcon);
                }

                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'falcon_roost_mode',
            title: 'Roost Mode: Return and Heal',
            description: `
                Ensures that when targeting self, the Falcon returns to the Hunter
                and provides a heal on arrival.
            `,
            relatedSkills: ['FALCON_COMMAND'],
            category: 'summon',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['falcon', 'roost', 'heal'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 9, s: -13 }, ['FALCON_COMMAND']);
                engine.state.player.hp = 2; // Damage player
                // Falcon far away
                engine.spawnFalcon({ q: 3, r: 6, s: -9 }, 'my-falcon');
            },
            run: (engine: any) => {
                // Target self to trigger roost
                engine.useSkill('FALCON_COMMAND', { q: 4, r: 9, s: -13 });
                // Move toward player
                engine.wait();
                engine.wait();
            },
            verify: (state: GameState, _logs: string[]) => {
                const falcon = state.companions?.find(c => c.id === 'my-falcon');
                const player = state.player;

                const checks = {
                    modeRoost: falcon?.companionState?.mode === 'roost',
                    healed: player.hp > 2,
                    closeToHunter: falcon && hexDistance(falcon.position, player.position) <= 1,
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Scenario Falcon Roost Heal Failed:', checks);
                }

                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'falcon_predator_auto_return',
            title: 'Predator Mode: Auto-Roost on Kill',
            description: `
                Ensures that if a marked predator target dies, the Falcon
                automatically reverts to Roost mode.
            `,
            relatedSkills: ['FALCON_COMMAND'],
            category: 'summon',
            difficulty: 'intermediate',
            isTutorial: true,
            tags: ['falcon', 'predator', 'cleanup'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 9, s: -13 }, ['FALCON_COMMAND']);
                engine.state.player.hp = 10; // Leave enough buffer that the scenario isolates falcon behavior
                engine.spawnFalcon({ q: 4, r: 8, s: -12 }, 'my-falcon');
                // Enemy with 1 HP
                engine.spawnEnemy('footman', { q: 4, r: 7, s: -11 }, 'prey');
                const prey = engine.getEnemy('prey');
                if (prey) {
                    prey.activeSkills = [];
                }
            },
            run: (engine: any) => {
                // Mark enemy
                engine.useSkill('FALCON_COMMAND', { q: 4, r: 7, s: -11 });
                // Turn 1: Falcon moves/pecks -> Kill
                engine.wait();
                // Turn 2: Target lost -> Auto-Roost
                engine.wait();
                engine.wait();
            },
            verify: (state: GameState, _logs: string[]) => {
                const falcon = state.companions?.find(c => c.id === 'my-falcon');
                const prey = state.enemies.find(e => e.id === 'prey');
                const player = state.player;

                const checks = {
                    preyDead: !prey,
                    autoRoost: falcon?.companionState?.mode === 'roost',
                    healed: player.hp > 1,
                };

                if (Object.values(checks).some(v => v === false)) {
                }

                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'falcon_command_metadata_null_safety',
            title: 'Command Metadata Null-Safety',
            description: `
                Ensures FALCON_COMMAND name/description resolution is safe
                when player context is remapped in harness-like states.
            `,
            relatedSkills: ['FALCON_COMMAND'],
            category: 'summon',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['falcon', 'null-safety', 'metadata'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 9, s: -13 }, ['FALCON_COMMAND']);
                engine.state.player.id = 'hunter_remapped';
            },
            run: (engine: any) => {
                engine.wait();
            },
            verify: (state: GameState, logs: string[]) => {
                const checks = {
                    playerIdRemapped: state.player.id === 'hunter_remapped',
                    noRuntimeReferenceError: !logs.some(l => l.toLowerCase().includes('cannot read properties')),
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('Falcon Command Metadata Null-Safety Failed:', checks);
                }

                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
