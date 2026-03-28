import { hexEquals } from '../hex';
import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

export const falconCommandScenarios: ScenarioCollection = {
    id: 'falcon_command_v2',
    name: "Falcon's Command",
    description: 'Validates the live falcon command overlay and targeting contracts.',

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
                engine.spawnFalcon({ q: 3, r: 9, s: -12 }, 'my-falcon');
                engine.spawnEnemy('footman', { q: 4, r: 2, s: -6 }, 'prey');
            },
            run: (engine: any) => {
                engine.useSkill('FALCON_COMMAND', { q: 4, r: 2, s: -6 });
            },
            verify: (state: GameState) => {
                const falcon = state.companions?.find(c => c.id === 'my-falcon');
                const prey = state.enemies.find(e => e.id === 'prey');

                const checks = {
                    modeSet: falcon?.companionState?.mode === 'predator',
                    targetLocked: falcon?.companionState?.markTarget === 'prey',
                    preyHealthy: prey?.hp === prey?.maxHp,
                    turnRemainsOpen: state.turnsSpent === 0,
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('Falcon Predator scenario failed:', checks);
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
                engine.spawnFalcon({ q: 3, r: 9, s: -12 }, 'my-falcon');
            },
            run: (engine: any) => {
                engine.useSkill('FALCON_COMMAND', { q: 3, r: 6, s: -9 });
            },
            verify: (state: GameState) => {
                const falcon = state.companions?.find(c => c.id === 'my-falcon');
                const markPos = { q: 3, r: 6, s: -9 };

                const checks = {
                    isScout: falcon?.companionState?.mode === 'scout',
                    patrolMarkSet: !!falcon
                        && typeof falcon.companionState?.markTarget === 'object'
                        && hexEquals(falcon.companionState.markTarget as any, markPos),
                    turnRemainsOpen: state.turnsSpent === 0,
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('Falcon Scout scenario failed:', checks);
                    console.log('Falcon:', falcon);
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
                    console.log('Falcon metadata null-safety failed:', checks);
                }

                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
