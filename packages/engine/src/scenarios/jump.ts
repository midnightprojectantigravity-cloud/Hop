import type { GameState } from '../types';
import type { ScenarioCollection } from './types';
import { hexEquals } from '../hex';
import { isOccupiedMask } from '../systems/mask';

/**
 * Jump Scenarios
 * Tests: Range, Obstacles (Lava/Walls), and Stunning Landing
 */
export const jumpScenarios: ScenarioCollection = {
    id: 'jump',
    name: 'Jump',
    description: 'Tests for jump mechanics including range validation and stunning landing',

    scenarios: [
        {
            id: 'jump_basic',
            title: 'Basic Jump',
            description: 'Jump to a tile.',
            relatedSkills: ['JUMP'],
            category: 'movement',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['movement', 'leap'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['JUMP']);
                // Jumping over lava should not trigger damage
                engine.setTile({ q: 3, r: 5, s: -8 }, 'lava');
            },
            run: (engine: any) => {
                engine.useSkill('JUMP', { q: 3, r: 4, s: -7 });
            },
            verify: (state: GameState, logs: string[]) => {
                const isAtTarget = hexEquals(state.player.position, { q: 3, r: 4, s: -7 });
                const maskRefreshed = isOccupiedMask(state.occupancyMask, { q: 3, r: 4, s: -7 });
                const oldPosEmpty = !isOccupiedMask(state.occupancyMask, { q: 3, r: 6, s: -9 });

                const checks = {
                    playerInPosition: isAtTarget,
                    spatialMaskRefreshed: maskRefreshed && oldPosEmpty,
                    noLavaDamage: state.player.hp === state.player.maxHp,
                    jumpedSuccessfully: logs.some(l => l.includes('Jumped'))
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.error('❌ Jump Basic Failed:', checks);
                    console.error('Final State:', state.player.position);
                    console.error('Logs:', logs);
                }

                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'jump_stunning_landing',
            title: 'Stunning Landing',
            description: 'Jump into a group of enemies and ensure neighbors are stunned.',
            relatedSkills: ['JUMP'],
            category: 'movement',
            difficulty: 'intermediate',
            isTutorial: true,
            tags: ['movement', 'stun', 'aoe'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['JUMP']);
                engine.spawnEnemy('footman', { q: 3, r: 7, s: -10 }, 'neighbor_1');
                engine.spawnEnemy('footman', { q: 4, r: 7, s: -11 }, 'neighbor_2');
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'distant_enemy');
            },
            run: (engine: any) => {
                engine.useSkill('JUMP', { q: 3, r: 8, s: -11 });
            },
            verify: (state: GameState, logs: string[], events: any[] = []) => {
                const checks = {
                    // TRANSIENT CHECK: Status might be gone due to autonomous loop, so check logs
                    n1StunnedMessage: logs.some(l => l.includes('stunned by landing impact')),

                    // JUICE CHECK: Verify visual events were triggered
                    hasShakeJuice: events.some(e => e.type === 'shake'),
                    hasStunBurstVFX: events.some(e => e.type === 'vfx' && e.payload.type === 'stunBurst'),
                    hasStunnedCombatText: events.some(e => e.type === 'combat_text' && e.payload.text === 'STUNNED'),

                    playerAtTarget: hexEquals(state.player.position, { q: 3, r: 8, s: -11 }),

                    oneTurnSpent: state.turnsSpent === 1
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.error('❌ Jump Stunning Landing Failed:', checks);
                    console.error('Final State:', state.player.position);
                    console.error('turnsSpent:', state.turnsSpent);
                    console.error('Logs:', logs);
                }

                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
