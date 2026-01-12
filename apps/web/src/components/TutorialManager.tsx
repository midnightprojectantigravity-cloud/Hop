import React from 'react';
import { COMPOSITIONAL_SKILLS } from '@hop/engine/skillRegistry';
import { generateInitialState } from '@hop/engine/logic';
import type { GameState, Point, SkillDefinition, ScenarioV2 } from '@hop/engine/types';
import { ENEMY_STATS } from '@hop/engine/constants';

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
        this.state.lavaPositions = [];
        this.state.wallPositions = [];
    }

    setPlayer(pos: Point, skillIds: string[]) {
        this.state.player = {
            ...this.state.player,
            position: pos,
            previousPosition: pos,
            activeSkills: skillIds.map(id => {
                const def = COMPOSITIONAL_SKILLS[id];
                return {
                    id,
                    name: def?.name || id,
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
            speed: (stats as any).speed || 50,
            factionId: 'enemy'
        });
    }

    setTile(pos: Point, type: 'lava' | 'wall' | 'floor') {
        if (type === 'lava') {
            this.state.lavaPositions.push(pos);
        } else if (type === 'wall') {
            this.state.wallPositions.push(pos);
        }
    }

    addUpgrade(skillId: string, upgradeId: string) {
        this.state.player.activeSkills = (this.state.player.activeSkills || []).map(s => {
            if (s.id === skillId) {
                return { ...s, activeUpgrades: [...s.activeUpgrades, upgradeId] };
            }
            return s;
        });
    }

    // Stub methods that might be called by setup but are irrelevant for initial state construction
    // e.g. run() uses useSkill, but setup usually just sets state.
    useSkill() { }
    applyStatus(targetId: string, status: string) {
        // We can support applying initial status
        const enemy = this.state.enemies.find(e => e.id === targetId);
        if (enemy) {
            if (status === 'stunned') {
                enemy.statusEffects = enemy.statusEffects || [];
                enemy.statusEffects.push({ id: `${enemy.id}-stunned`, type: 'stunned', duration: 1 });
            }
        }
    }
}

export const TutorialManager: React.FC<TutorialManagerProps> = ({ onLoadScenario }) => {
    const skills = Object.values(COMPOSITIONAL_SKILLS);

    const handleScenarioClick = (scenario: ScenarioV2) => {
        const builder = new ScenarioBuilder();
        scenario.setup(builder);
        onLoadScenario(builder.state, scenario.description);
    };

    return (
        <div className="flex flex-col gap-4">
            {skills.map((skill: SkillDefinition) => (
                <div key={skill.id} className="flex flex-col gap-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/50">{skill.name}</h4>
                    <div className="flex flex-col gap-1">
                        {skill.scenarios.map(scenario => (
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
