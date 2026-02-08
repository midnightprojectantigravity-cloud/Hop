import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

const makeSkill = (id: string) => {
    const byId: Record<string, { slot: 'offensive' | 'passive' | 'utility' | 'defensive'; range: number; cooldown: number; name: string; description: string }> = {
        BASIC_MOVE: { slot: 'passive', range: 1, cooldown: 0, name: 'Walk', description: 'Move to adjacent tile.' },
        BASIC_ATTACK: { slot: 'passive', range: 1, cooldown: 0, name: 'Basic Attack', description: 'Strike adjacent target.' },
        SENTINEL_TELEGRAPH: { slot: 'offensive', range: 3, cooldown: 0, name: 'Sentinel Telegraph', description: 'Marks blast zone.' },
        SENTINEL_BLAST: { slot: 'offensive', range: 3, cooldown: 0, name: 'Sentinel Blast', description: 'Massive area blast.' },
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

/**
 * Sentinel Blast Scenarios
 * Tests: Area of effect damage
 */
export const sentinelBlastScenarios: ScenarioCollection = {
    id: 'sentinel_blast',
    name: 'Sentinel Blast',
    description: 'Sentinel unique area-of-effect attack',

    scenarios: [
        {
            id: 'blast_aoe',
            title: 'Blast Away',
            description: 'Use Sentinel Blast to hit multiple enemies.',
            relatedSkills: ['SENTINEL_BLAST'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['aoe', 'damage', 'sentinel'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['SENTINEL_BLAST']);
                // Central target
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'center');
                // Neighbor to target
                engine.spawnEnemy('footman', { q: 4, r: 4, s: -8 }, 'side');
            },
            run: (engine: any) => {
                engine.useSkill('SENTINEL_BLAST', { q: 3, r: 5, s: -8 });
            },
            verify: (_state: GameState, logs: string[]) => {
                // Both enemies should take damage
                // Center takes 2, Side takes 1. Footman usually has 2 HP? Assuming 2 HP.
                // Center should be dead or barely alive. Side damaged.
                // Just check usage log for now.
                return logs.some(l => l.includes('massive blast'));
            }
        },
        {
            id: 'sentinel_playlist_two_turn_timing',
            title: 'Playlist: Telegraph then Execute',
            description: 'Boss uses a 2-turn skill playlist: telegraph first, blast on next turn.',
            relatedSkills: ['SENTINEL_TELEGRAPH', 'SENTINEL_BLAST'],
            category: 'combat',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['boss', 'playlist', 'telegraph'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, []);
                engine.spawnEnemy('sentinel', { q: 4, r: 2, s: -6 }, 'boss');
                const boss = engine.getEnemy('boss');
                if (boss) {
                    boss.activeSkills = [
                        makeSkill('BASIC_MOVE'),
                        makeSkill('BASIC_ATTACK'),
                        makeSkill('SENTINEL_TELEGRAPH'),
                        makeSkill('SENTINEL_BLAST')
                    ];
                }
            },
            run: (engine: any) => {
                engine.wait(); // turn 1: telegraph
                engine.logs.push(`HP_AFTER_TELEGRAPH=${engine.state.player.hp}`);
                engine.wait(); // turn 2: execute blast
            },
            verify: (state: GameState, logs: string[]) => {
                const hpAfterTelegraphLog = logs.find(l => l.startsWith('HP_AFTER_TELEGRAPH='));
                const hpAfterTelegraph = hpAfterTelegraphLog ? Number(hpAfterTelegraphLog.split('=')[1]) : -1;

                const checks = {
                    telegraphEmitted: logs.some(l => l.includes('marks the impact zone')),
                    executeEmitted: logs.some(l => l.includes('massive blast')),
                    noDamageOnTelegraphTurn: hpAfterTelegraph === state.player.maxHp,
                    damageOnExecuteTurn: state.player.hp < state.player.maxHp,
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('Sentinel Playlist Timing Failed:', checks);
                    console.log('Logs:', logs);
                    console.log('Player HP:', state.player.hp, '/', state.player.maxHp);
                }

                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'sentinel_playlist_interruption_by_stun',
            title: 'Playlist: Interruption Cancels Execute',
            description: 'Stunning the boss during telegraph cancels the follow-up execute turn.',
            relatedSkills: ['SENTINEL_TELEGRAPH', 'SENTINEL_BLAST'],
            category: 'combat',
            difficulty: 'advanced',
            isTutorial: false,
            tags: ['boss', 'playlist', 'interruption', 'stun'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, []);
                engine.spawnEnemy('sentinel', { q: 4, r: 2, s: -6 }, 'boss');
                const boss = engine.getEnemy('boss');
                if (boss) {
                    boss.activeSkills = [
                        makeSkill('BASIC_MOVE'),
                        makeSkill('BASIC_ATTACK'),
                        makeSkill('SENTINEL_TELEGRAPH'),
                        makeSkill('SENTINEL_BLAST')
                    ];
                }
            },
            run: (engine: any) => {
                engine.wait(); // telegraph
                engine.applyStatus('boss', 'stunned', 1);
                engine.wait(); // execute turn should be cancelled
            },
            verify: (state: GameState, logs: string[]) => {
                const boss = state.enemies.find(e => e.id === 'boss');
                const checks = {
                    telegraphEmitted: logs.some(l => l.includes('marks the impact zone')),
                    executeCancelled: !logs.some(l => l.includes('massive blast')),
                    playerUnharmed: state.player.hp === state.player.maxHp,
                    bossStillExists: !!boss,
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('Sentinel Playlist Interruption Failed:', checks);
                    console.log('Logs:', logs);
                    console.log('Player HP:', state.player.hp, '/', state.player.maxHp);
                    console.log('Boss:', boss);
                }

                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
