


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
            title: 'Predator Mode: Apex Strike Geometry',
            description: `
                Tests the Falcon's flight path from its current position to the Target.
                Layout:
                   (F)  <- Falcon Start (6, 5, -11)
                      .
                         (T) <- Target/Prey (8, 5, -13)
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
                engine.wait(); // Turn 1
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
                    // VALIDATION: Falcon should have moved closer, but NOT deal damage yet
                    movedCloser: falcon && hexDistance(falcon.position, { q: 4, r: 2, s: -6 }) < 7,
                    preyHealthy: prey?.hp === prey?.maxHp,
                    // FALCON_COMMAND is an action skill, so it should consume 1 turn
                    turnSpent: state.turnsSpent === 2,
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
            title: 'Scout Mode: Hex Ring Orbit',
            description: `
                Ensures that in Scout mode, the Falcon rotates around the mark 
                on the flat-top hex ring.
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
                engine.wait(); // Turn 1
                engine.wait(); // Turn 2
            },
            verify: (state: GameState, _logs: string[]) => {
                const falcon = state.companions?.find(c => c.id === 'my-falcon');
                const markPos = { q: 3, r: 6, s: -9 };

                const checks = {
                    // VERIFICATION: Mode Transition
                    isScout: falcon?.companionState?.mode === 'scout',
                    // Tight logic: Distance should be EXACTLY 1
                    onOrbitRing: falcon && hexDistance(falcon.position, markPos) === 1,
                    hasRotated: falcon && !!falcon.previousPosition && !hexEquals(falcon.position, falcon.previousPosition),
                    // FALCON_COMMAND is an action skill, so it should consume 1 turn
                    turnSpent: state.turnsSpent === 3,
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
                engine.state.player.hp = 1; // Damage player
                engine.spawnFalcon({ q: 4, r: 8, s: -12 }, 'my-falcon');
                // Enemy with 1 HP
                engine.spawnEnemy('footman', { q: 4, r: 7, s: -11 }, 'prey');
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
