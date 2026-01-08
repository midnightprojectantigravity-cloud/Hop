import { generateInitialState, gameReducer } from '../game/logic';
import { COMPOSITIONAL_SKILLS } from '../game/skillRegistry';
import { ENEMY_STATS } from '../game/constants';
import type { Action, GameState, Point } from '../game/types';

class TestEngine {
    state: GameState;

    constructor(seed = 'test') {
        this.state = generateInitialState(1, seed);
        // Clean slate
        this.state.enemies = [];
        this.state.lavaPositions = [];
        this.state.wallPositions = [];
        // Defaults
        this.state.hasSpear = true;
        this.state.hasShield = true;
    }

    setPlayer(pos: Point, skills: string[]) {
        this.state.player.position = pos;
        this.state.player.previousPosition = pos;

        // Construct skill objects
        this.state.player.activeSkills = skills.map(id => {
            const def = COMPOSITIONAL_SKILLS[id];
            if (!def) throw new Error(`Unknown skill ${id}`);
            return {
                id,
                name: def.name,
                description: def.description,
                slot: def.slot,
                cooldown: def.baseVariables.cooldown,
                currentCooldown: 0,
                range: def.baseVariables.range,
                upgrades: Object.keys(def.upgrades),
                activeUpgrades: [] as string[]
            };
        });
    }

    spawnEnemy(type: string, pos: Point, id: string) {
        // @ts-ignore
        const stats = ENEMY_STATS[type] || { hp: 1, maxHp: 1 };
        this.state.enemies.push({
            id,
            type: 'enemy',
            subtype: type,
            position: pos,
            previousPosition: pos,
            hp: stats.hp,
            maxHp: stats.maxHp,
            enemyType: (stats as any).type || 'melee',
            isStunned: false
        });
    }

    setTile(pos: Point, type: 'lava' | 'wall' | 'floor') {
        if (type === 'lava') this.state.lavaPositions.push(pos);
        if (type === 'wall') this.state.wallPositions.push(pos);
    }

    addUpgrade(skillId: string, upgradeId: string) {
        const skill = this.state.player.activeSkills?.find(s => s.id === skillId);
        if (skill) {
            skill.activeUpgrades.push(upgradeId);
        }
    }

    applyStatus(targetId: string, status: string) {
        const e = this.state.enemies.find(en => en.id === targetId);
        if (e && status === 'stunned') e.isStunned = true;
    }

    useSkill(skillId: string, target: Point) {
        const action: Action = { type: 'USE_SKILL', payload: { skillId, target } };
        this.state = gameReducer(this.state, action);
    }

    wait() {
        const action: Action = { type: 'WAIT' };
        this.state = gameReducer(this.state, action);
    }

    move(target: Point) {
        const action: Action = { type: 'MOVE', payload: target };
        this.state = gameReducer(this.state, action);
    }
}

async function runTests() {
    console.log('Running Compositional Skill Tests...\n');
    let passed = 0;
    let failed = 0;

    for (const skill of Object.values(COMPOSITIONAL_SKILLS)) {
        for (const scenario of skill.scenarios) {
            process.stdout.write(`  [${skill.name}] ${scenario.title}... `);
            try {
                const engine = new TestEngine();
                scenario.setup(engine);
                scenario.run(engine);
                const success = scenario.verify(engine.state, engine.state.message);

                if (success) {
                    console.log('✅ PASSED');
                    passed++;
                } else {
                    console.log('❌ FAILED');
                    console.log('     Logs:', engine.state.message.slice(-5));
                    failed++;
                }
            } catch (e: any) {
                console.log(`❌ CRASHED: ${e.message}`);
                console.error(e);
                failed++;
            }
        }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
