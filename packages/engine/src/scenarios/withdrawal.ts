import type { GameState } from '../types';
import type { ScenarioCollection } from './types';
import { hexEquals } from '../hex';

/**
 * Withdrawal Scenarios
 * Tests: Active shot + backroll, passive reaction
 * User Feedback: 
 * - The movement part of the skill should follow the same logic as any other movement skill and check for hazards so the actor doesn't commit suicide by passing on or ending on lava for example.
 * - The skill should trigger automatically when an enemy moves to a neighbor of the player, if the skill is not on cooldown.
 */
export const withdrawalScenarios: ScenarioCollection = {
    id: 'withdrawal',
    name: 'Withdrawal',
    description: 'Tests for shot + backroll mechanics and passive reaction',

    scenarios: [
        {
            id: 'withdrawal_basic',
            title: 'Shot and Backroll',
            description: 'Shoot adjacent enemy and backroll to safety.',
            relatedSkills: ['WITHDRAWAL'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['shot', 'backroll', 'displacement'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 5, r: 5, s: -10 }, ['WITHDRAWAL']);
                engine.state.player.archetype = 'HUNTER';
                engine.spawnEnemy('footman', { q: 6, r: 5, s: -11 }, 'target');
            },
            run: (engine: any) => {
                engine.useSkill('WITHDRAWAL', { q: 6, r: 5, s: -11 });
            },
            verify: (state: GameState, logs: string[]) => {
                const target = state.enemies.find(e => e.id === 'target');

                const checks = {
                    enemyDamagedOrDead: !target || target.hp < target.maxHp,
                    playerMoved: state.player.position.q !== 5 || state.player.position.r !== 5,
                    playerBackrolled: state.player.position.q < 5, // Moved away from enemy
                    shotFired: logs.some(l => l.includes('Withdrawal') || l.includes('shot')),
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Withdrawal Failed:', checks);
                    console.log('Player:', state.player.position);
                    console.log('Target HP:', target?.hp);
                }

                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'withdrawal_wall_block',
            title: 'Backroll Blocked by Wall',
            description: 'Backroll finds alternate safe spot when wall blocks retreat.',
            relatedSkills: ['WITHDRAWAL'],
            category: 'collision',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['backroll', 'wall', 'pathfinding'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 5, r: 5, s: -10 }, ['WITHDRAWAL']);
                engine.state.player.archetype = 'HUNTER';

                // Wall directly behind player
                engine.setTile({ q: 4, r: 5, s: -9 }, 'wall');
                engine.setTile({ q: 3, r: 5, s: -8 }, 'wall');

                engine.spawnEnemy('footman', { q: 6, r: 5, s: -11 }, 'target');
            },
            run: (engine: any) => {
                engine.useSkill('WITHDRAWAL', { q: 6, r: 5, s: -11 });
            },
            verify: (state: GameState, _logs: string[]) => {
                const checks = {
                    playerNotOnWall: !hexEquals(state.player.position, { q: 4, r: 5, s: -9 }),
                    playerMoved: state.player.position.q !== 5 || state.player.position.r !== 5,
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Wall Block Failed:', checks);
                    console.log('Player:', state.player.position);
                }

                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
