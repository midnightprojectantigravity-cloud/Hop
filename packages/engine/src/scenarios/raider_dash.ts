import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

export const raiderDashScenarios: ScenarioCollection = {
    id: 'raider_dash',
    name: 'Raider Dash',
    description: 'Player dash contract coverage for the live movement pipeline.',
    scenarios: [
        {
            id: 'player_dash_stops_before_adjacent_enemy',
            title: 'Parity Baseline: Player Dash Stops Before Blocker',
            description: 'Player DASH should stop on the tile before an occupied target.',
            relatedSkills: ['DASH'],
            category: 'movement',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['parity', 'dash', 'reuse'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 2, s: -6 }, ['DASH']);
                engine.spawnEnemy('footman', { q: 4, r: 6, s: -10 }, 'blocker');
                engine.state.hasShield = false;
            },
            run: (engine: any) => {
                engine.useSkill('DASH', { q: 4, r: 6, s: -10 });
            },
            verify: (state: GameState, logs: string[]) => {
                const checks = {
                    playerStoppedBeforeBlocker: state.player.position.q === 4 && state.player.position.r === 5,
                    dashResolved: logs.some(l =>
                        l.includes('Stopped by an obstacle') || l.includes('Dashed!') || l.includes('Shield Shunt')
                    ),
                };
                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
