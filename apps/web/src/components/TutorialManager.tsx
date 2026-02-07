import React from 'react';
import { COMPOSITIONAL_SKILLS, SkillRegistry, generateInitialState, ENEMY_STATS, addStatus, buildInitiativeQueue, type GameState, type Point, type SkillDefinition, type ScenarioV2, pointToKey } from '@hop/engine';
import { BASE_TILES } from '@hop/engine/systems/tile-registry';
import type { TileID } from '@hop/engine/types/registry';

interface TutorialManagerProps {
    onLoadScenario: (state: GameState, instructions: string) => void;
}

/**
 * A builder that matches the interface expected by ScenarioV2.setup,
 * but constructs a GameState for the React app instead of running headless tests.
 */
class ScenarioBuilder {
    state: GameState;

    constructor() {
        this.state = generateInitialState(1, 'tutorial-seed');
        // Clear default generation artifacts
        this.state.enemies = [];
        // FIXED: lavaPositions and wallPositions no longer exist on GameState
        // We initialize with an empty Map (or clear the existing one)
        this.state.tiles = new Map();
    }

    setPlayer(pos: Point, skillIds: string[]) {
        this.state.player = {
            ...this.state.player,
            position: pos,
            previousPosition: pos,
            activeSkills: skillIds.map(id => {
                const def = SkillRegistry.get(id);
                return {
                    id,
                    name: typeof def?.name === 'function' ? def.name(this.state) : (def?.name || id),
                    description: def?.description || '',
                    slot: def?.slot || 'offensive',
                    cooldown: def?.baseVariables.cooldown || 0,
                    currentCooldown: 0,
                    range: def?.baseVariables.range || 0,
                    upgrades: Object.keys(def?.upgrades || {}),
                    activeUpgrades: []
                } as any;
            })
        };
    }

    spawnEnemy(type: string, pos: Point, id: string) {
        const stats = ENEMY_STATS[type as keyof typeof ENEMY_STATS] || { hp: 1, maxHp: 1 };
        this.state.enemies.push({
            id,
            type: 'enemy',
            subtype: type,
            position: pos,
            previousPosition: pos,
            hp: stats.hp,
            maxHp: stats.maxHp,
            enemyType: (stats as any).type || 'melee',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: [],
            speed: (stats as any).speed || 1,
            factionId: 'enemy'
        });
    }

    spawnFalcon(pos: Point, id: string) {
        const falcon = {
            id,
            type: 'enemy' as const,
            subtype: 'falcon',
            factionId: 'player',
            speed: 95, // High speed, acts after player (100)
            position: { ...pos },
            previousPosition: { ...pos },
            hp: 1,
            maxHp: 1,
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: [],
            isFlying: true,
            companionOf: 'player',
            companionState: {
                mode: 'roost',
                orbitStep: 0,
                apexStrikeCooldown: 0,
            }
        } as any;

        this.state.enemies.push(falcon);
        if (!this.state.companions) this.state.companions = [];
        this.state.companions.push(falcon);
    }

    spawnCompanion(type: string, pos: Point, id: string) {
        if (type === 'falcon') {
            this.spawnFalcon(pos, id);
        }
    }

    setTile(point: Point, type: string) {
        // 1. Normalize the string
        const typeUpper = type.toUpperCase() as TileID;
        const key = pointToKey(point);

        // 2. Safely access the definition
        const baseTileDef = BASE_TILES[typeUpper];

        if (!baseTileDef) {
            console.warn(`Attempted to set unknown tile type: ${typeUpper}`);
            return;
        }

        // 3. Update the Source of Truth
        this.state.tiles.set(key, {
            baseId: typeUpper,
            position: point,
            traits: new Set(baseTileDef.defaultTraits || []),
            effects: [],
            occupantId: undefined
        });
    }

    addUpgrade(skillId: string, upgradeId: string) {
        this.state.player.activeSkills = (this.state.player.activeSkills || []).map(s => {
            if (s.id === skillId) {
                return { ...s, activeUpgrades: [...s.activeUpgrades, upgradeId] };
            }
            return s;
        });
    }

    useSkill(_skillId: string, _target?: Point) { }

    wait() { }

    move(_pos: Point) { }

    getEnemy(id: string) {
        return this.state.enemies.find(e => e.id === id);
    }

    setTurn(turn: number) {
        this.state.turnNumber = turn;
    }

    exitToHub() { }

    applyStatus(targetId: string, status: string) {
        const idx = this.state.enemies.findIndex(e => e.id === targetId);
        if (idx !== -1) {
            // Ensure addStatus is imported from your engine's status system
            this.state.enemies[idx] = addStatus(this.state.enemies[idx], status as any, 1);
        }
    }
}

export const TutorialManager: React.FC<TutorialManagerProps> = ({ onLoadScenario }) => {
    const skills = Object.values(COMPOSITIONAL_SKILLS) as SkillDefinition[];

    const handleScenarioClick = (scenario: ScenarioV2) => {
        const builder = new ScenarioBuilder();
        scenario.setup(builder);
        // Force initiative queue rebuild so spawned enemies are included in the turn cycle
        builder.state.initiativeQueue = buildInitiativeQueue(builder.state);
        onLoadScenario(builder.state, scenario.description);
    };

    return (
        <div className="flex flex-col gap-4">
            {skills.map((skill: SkillDefinition) => (
                <div key={skill.id} className="flex flex-col gap-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                        {typeof skill.name === 'function' ? skill.name(generateInitialState(1, 'temp')) : skill.name}
                    </h4>
                    <div className="flex flex-col gap-1">
                        {skill.scenarios?.map(scenario => (
                            <button
                                key={scenario.id}
                                onClick={() => handleScenarioClick(scenario)}
                                className="text-left px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-xs text-white/80 transition-colors border border-transparent hover:border-white/20"
                            >
                                {scenario.title}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
