import type { Action, GameState, Point, Entity } from './types';
import { COMPOSITIONAL_SKILLS } from './skillRegistry';
import { gameReducer, generateInitialState } from './logic';
import { ENEMY_STATS } from './constants';

/**
 * Headless Engine wrapper for functional Skill Scenarios.
 */
class ScenarioEngine {
    state: GameState;
    logs: string[] = [];

    constructor(initialState: GameState) {
        this.state = initialState;
    }

    setPlayer(pos: Point, skillIds: string[]) {
        this.state.player = {
            ...this.state.player,
            id: 'player',
            type: 'player',
            position: pos,
            previousPosition: pos,
            hp: 3,
            maxHp: 3,
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
            maxHp: stats.maxHp
            ,
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: []
        });
    }

    setTile(pos: Point, type: 'lava' | 'wall' | 'floor' | 'slippery' | 'void') {
        if (type === 'lava') {
            this.state.lavaPositions.push(pos);
        } else if (type === 'wall') {
            this.state.wallPositions.push(pos);
        } else if (type === 'slippery') {
            this.state.slipperyPositions = this.state.slipperyPositions || [];
            this.state.slipperyPositions.push(pos);
        } else if (type === 'void') {
            this.state.voidPositions = this.state.voidPositions || [];
            this.state.voidPositions.push(pos);
        }
    }

    applyStatus(targetId: string, status: 'stunned') {
        const enemy = this.state.enemies.find(e => e.id === targetId);
        if (enemy) {
            if (status === 'stunned') {
                enemy.statusEffects = enemy.statusEffects || [];
                enemy.statusEffects.push({ id: `${enemy.id}-stunned`, type: 'stunned', duration: 1 });
            }
        } else if (this.state.player.id === targetId) {
            if (status === 'stunned') {
                this.state.player.statusEffects = this.state.player.statusEffects || [];
                this.state.player.statusEffects.push({ id: `${this.state.player.id}-stunned`, type: 'stunned', duration: 1 });
            }
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

    useSkill(skillId: string, target?: Point) {
        const action: Action = { type: 'USE_SKILL', payload: { skillId, target } };
        const oldLogLength = this.state.message.length;
        const nextState = gameReducer(this.state, action);
        const newMessages = nextState.message.slice(oldLogLength);
        this.logs.push(...newMessages);
        this.state = nextState;
    }

    dispatch(action: Action) {
        const oldLogLength = this.state.message.length;
        const nextState = gameReducer(this.state, action);
        const newMessages = nextState.message.slice(oldLogLength);
        this.logs.push(...newMessages);
        this.state = nextState;
    }

    wait() {
        this.dispatch({ type: 'WAIT' });
    }

    getEnemy(id: string): Entity | undefined {
        return this.state.enemies.find(e => e.id === id);
    }

    move(pos: Point) {
        this.dispatch({ type: 'MOVE', payload: pos });
    }
}

import * as fs from 'fs';

const logFile = 'test_result.log';
fs.writeFileSync(logFile, ''); // Clear file

function log(msg: string) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

async function runTests() {
    log('--- Skill Test Runner ---');
    let passed = 0;
    let failed = 0;

    for (const [skillId, definition] of Object.entries(COMPOSITIONAL_SKILLS)) {
        // if (skillId !== 'SHIELD_BASH') continue; // This line was removed as per the instruction
        log(`Skill: ${definition.name} (${skillId})`);

        for (const scenario of definition.scenarios) {
            log(`  Scenario: ${scenario.title}`);

            const initialState = generateInitialState(1, 'test-seed');
            initialState.enemies = [];
            initialState.lavaPositions = [];
            initialState.wallPositions = [];

            const engine = new ScenarioEngine(initialState);

            try {
                scenario.setup(engine);
                // Force initiative queue rebuild after manual setup
                engine.state.initiativeQueue = undefined;
                scenario.run(engine);
                const isSuccess = scenario.verify(engine.state, engine.logs);

                if (isSuccess) {
                    log('    [PASS]');
                    passed++;
                } else {
                    log('    [FAIL]');
                    log(`      Messages: ${JSON.stringify(engine.logs)}`);
                    log(`      Enemies: ${JSON.stringify(engine.state.enemies.map((e: Entity) => `${e.id}@${e.position.q},${e.position.r}`))}`);
                    log(`      Player: ${engine.state.player.position.q},${engine.state.player.position.r}`);
                    failed++;
                }
            } catch (err: any) {
                log('    [CRASH]');
                log(`      Error: ${err.message || err}`);
                if (err.stack) log(err.stack);
                failed++;
            }
        }
    }

    log(`\nResult: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
