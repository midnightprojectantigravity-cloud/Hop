import type { GameState } from '../types';
import type { ScenarioCollection } from './types';
import { pointToKey } from '../hex';

export const necromancerScenarios: ScenarioCollection = {
    id: 'necromancer',
    name: 'Necromancer',
    description: 'Corpse persistence and summon migration contracts.',
    scenarios: [
        {
            id: 'necromancer_corpse_persistence',
            title: 'Corpse Persists Until Consumed',
            description: 'Kill an enemy, wait 5 turns, then Raise Dead succeeds from corpse tile trait.',
            relatedSkills: ['BASIC_ATTACK', 'RAISE_DEAD'],
            category: 'summon',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['necromancer', 'corpse', 'persistence'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 4, s: -8 }, ['BASIC_ATTACK', 'RAISE_DEAD'], 'VANGUARD');
                engine.spawnEnemy('footman', { q: 5, r: 4, s: -9 }, 'dummy');
                const enemy = engine.getEnemy('dummy');
                if (enemy) {
                    enemy.hp = 1;
                    enemy.maxHp = 1;
                }
            },
            run: (engine: any) => {
                const corpsePos = { q: 5, r: 4, s: -9 };
                engine.useSkill('BASIC_ATTACK', corpsePos);
                for (let i = 0; i < 5; i++) {
                    engine.wait();
                }
                engine.useSkill('RAISE_DEAD', corpsePos);
            },
            verify: (state: GameState) => {
                const corpseKey = pointToKey({ q: 5, r: 4, s: -9 });
                const tile = state.tiles.get(corpseKey);
                const skeleton = state.enemies.find(e => e.subtype === 'skeleton' && e.factionId === 'player');
                const companion = state.companions?.find(c => c.id === skeleton?.id);
                const skillIds = new Set((skeleton?.activeSkills || []).map(s => s.id));
                const checks = {
                    corpseConsumed: !tile?.traits?.has('CORPSE'),
                    skeletonRaised: !!skeleton,
                    skeletonOnCorpseTile: !!skeleton && skeleton.position.q === 5 && skeleton.position.r === 4,
                    companionRegistered: !!companion,
                    hasBasicLoadout: skillIds.has('BASIC_MOVE') && skillIds.has('BASIC_ATTACK')
                };
                return Object.values(checks).every(Boolean);
            }
        },
        {
            id: 'summon_floor_transition',
            title: 'Summon Persists Across Floor Transition',
            description: 'Raised skeleton migrates with player to floor 2.',
            relatedSkills: ['RAISE_DEAD'],
            category: 'summon',
            difficulty: 'advanced',
            isTutorial: false,
            tags: ['necromancer', 'summon', 'floor-transition'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 4, s: -8 }, ['RAISE_DEAD'], 'VANGUARD');
                const corpsePos = { q: 5, r: 4, s: -9 };
                const key = pointToKey(corpsePos);
                const tile = engine.getTileAt(corpsePos);
                engine.state.tiles.set(key, {
                    ...tile,
                    position: corpsePos,
                    traits: new Set([...(tile?.traits || []), 'CORPSE'])
                });
            },
            run: (engine: any) => {
                const corpsePos = { q: 5, r: 4, s: -9 };
                engine.useSkill('RAISE_DEAD', corpsePos);
                engine.state.player = { ...engine.state.player, position: { ...engine.state.stairsPosition } };
                engine.wait();
                engine.dispatchSync({ type: 'RESOLVE_PENDING' });
            },
            verify: (state: GameState) => {
                const migrated = state.enemies.find(e => e.subtype === 'skeleton' && e.factionId === 'player' && e.companionOf === state.player.id);
                const checks = {
                    floorAdvanced: state.floor === 2,
                    summonStillPresent: !!migrated,
                    summonTracksOwner: !!migrated && migrated.companionOf === state.player.id
                };
                return Object.values(checks).every(Boolean);
            }
        },
        {
            id: 'companion_does_not_block_free_move',
            title: 'Companion Does Not Block Exploration Free Move',
            description: 'Friendly skeleton companion should not count as hostile for BASIC_MOVE exploration range.',
            relatedSkills: ['BASIC_MOVE'],
            category: 'movement',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['necromancer', 'companion', 'movement'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['BASIC_MOVE'], 'VANGUARD');
                engine.spawnEnemy('footman', { q: 5, r: 5, s: -10 }, 'friendly_skeleton');
                const companion = engine.getEnemy('friendly_skeleton');
                if (companion) {
                    companion.subtype = 'skeleton';
                    companion.factionId = 'player';
                    companion.companionOf = engine.state.player.id;
                    companion.activeSkills = companion.activeSkills || [];
                    engine.state.companions = [...(engine.state.companions || []), companion];
                }
            },
            run: (engine: any) => {
                // Distance > 1 move should be legal in exploration mode when no hostile enemies exist.
                engine.move({ q: 7, r: 1, s: -8 });
            },
            verify: (state: GameState) => {
                const checks = {
                    movedFar: state.player.position.q === 7 && state.player.position.r === 1,
                    turnsAdvanced: state.turnsSpent >= 1
                };
                return Object.values(checks).every(Boolean);
            }
        },
        {
            id: 'raise_dead_pushes_ally_from_target_hex',
            title: 'Raise Dead Pushes Ally Occupant',
            description: 'If corpse tile is occupied by an ally, ally is displaced and summon succeeds without overlap.',
            relatedSkills: ['RAISE_DEAD'],
            category: 'summon',
            difficulty: 'advanced',
            isTutorial: false,
            tags: ['necromancer', 'occupancy', 'push'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['RAISE_DEAD'], 'VANGUARD');
                const corpsePos = { q: 5, r: 5, s: -10 };
                const corpseKey = pointToKey(corpsePos);
                const tile = engine.getTileAt(corpsePos);
                engine.state.tiles.set(corpseKey, {
                    ...tile,
                    position: corpsePos,
                    traits: new Set([...(tile?.traits || []), 'CORPSE'])
                });

                engine.spawnEnemy('footman', corpsePos, 'ally_blocker');
                const ally = engine.getEnemy('ally_blocker');
                if (ally) {
                    ally.subtype = 'skeleton';
                    ally.factionId = 'player';
                    ally.companionOf = engine.state.player.id;
                    engine.state.companions = [...(engine.state.companions || []), ally];
                }
            },
            run: (engine: any) => {
                engine.useSkill('RAISE_DEAD', { q: 5, r: 5, s: -10 });
            },
            verify: (state: GameState) => {
                const skeletons = state.enemies.filter(e => e.subtype === 'skeleton' && e.factionId === 'player');
                const occupied = new Set<string>();
                let hasOverlap = false;
                skeletons.forEach(s => {
                    const k = pointToKey(s.position);
                    if (occupied.has(k)) hasOverlap = true;
                    occupied.add(k);
                });
                const raisedAtCorpse = skeletons.some(s => s.position.q === 5 && s.position.r === 5);
                const pushedExists = skeletons.some(s => s.id === 'ally_blocker' && !(s.position.q === 5 && s.position.r === 5));
                const checks = {
                    raisedAtCorpse,
                    pushedExists,
                    noOverlap: !hasOverlap,
                };
                return Object.values(checks).every(Boolean);
            }
        }
    ]
};
