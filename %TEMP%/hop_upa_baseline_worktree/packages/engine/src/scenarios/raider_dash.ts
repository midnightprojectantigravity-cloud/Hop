import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

const makeSkill = (id: string) => {
    const byId: Record<string, { slot: 'offensive' | 'passive' | 'utility' | 'defensive'; range: number; cooldown: number; name: string; description: string }> = {
        BASIC_MOVE: { slot: 'passive', range: 1, cooldown: 0, name: 'Walk', description: 'Move to adjacent tile.' },
        BASIC_ATTACK: { slot: 'passive', range: 1, cooldown: 0, name: 'Basic Attack', description: 'Strike adjacent target.' },
        DASH: { slot: 'passive', range: 4, cooldown: 0, name: 'Kinetic Dash', description: 'Dash in a straight line.' },
    };
    const def = byId[id] || { slot: 'offensive' as const, range: 1, cooldown: 0, name: id, description: id };
    return {
        id,
        name: def.name,
        description: def.description,
        slot: def.slot,
        cooldown: def.cooldown,
        currentCooldown: 0,
        range: def.range,
        upgrades: [],
        activeUpgrades: []
    } as any;
};

export const raiderDashScenarios: ScenarioCollection = {
    id: 'raider_dash',
    name: 'Raider Dash',
    description: 'Parity checks for enemy Raider reusing the player DASH contract.',
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
        },
        {
            id: 'raider_ai_uses_dash_with_player_contract',
            title: 'Parity: Raider Uses Same Dash Stop Rule',
            description: 'Raider AI selects DASH and lands on the same stop tile as player-owned DASH in mirrored geometry.',
            relatedSkills: ['DASH'],
            category: 'combat',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['parity', 'enemy-ai', 'dash'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 6, s: -10 }, []);
                engine.spawnEnemy('raider', { q: 4, r: 2, s: -6 }, 'raider');
                engine.state.hasShield = false;
                const raider = engine.getEnemy('raider');
                if (raider) {
                    raider.activeSkills = [
                        makeSkill('BASIC_MOVE'),
                        makeSkill('BASIC_ATTACK'),
                        makeSkill('DASH')
                    ];
                }
            },
            run: (engine: any) => {
                engine.wait();
            },
            verify: (state: GameState, logs: string[]) => {
                const raider = state.enemies.find(e => e.id === 'raider');
                const checks = {
                    raiderStillAlive: !!raider,
                    raiderStoppedBeforePlayer: !!raider && raider.position.q === 4 && raider.position.r === 5,
                    playerUnharmed: state.player.hp === state.player.maxHp,
                    dashResolved: logs.some(l =>
                        l.includes('Stopped by an obstacle') || l.includes('Dashed!') || l.includes('Shield Shunt')
                    ),
                };
                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
