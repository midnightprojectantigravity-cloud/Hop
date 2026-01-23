import type { Action, GameState, Point, Entity, Actor } from './types';
import { COMPOSITIONAL_SKILLS } from './skillRegistry';
import { gameReducer, generateInitialState } from './logic';
import { ENEMY_STATS } from './constants';
import { hexEquals } from './hex';
import { isPlayerTurn } from './systems/initiative';
import { SCENARIO_COLLECTIONS } from './scenarios';
import { type PhysicsComponent, type ArchetypeComponent, type GameComponent } from './systems/components';
import { addStatus } from './systems/actor';

/**
 * Headless Engine wrapper for functional Skill Scenarios.
 */
export class ScenarioEngine {
    state: GameState;
    logs: string[] = [];

    constructor(initialState: GameState) {
        this.state = initialState;
    }

    setPlayer(pos: Point, skillIds: string[], archetype: 'VANGUARD' | 'SKIRMISHER' = 'VANGUARD') {
        this.state.player = {
            ...this.state.player,
            id: 'player',
            type: 'player',
            factionId: 'player',
            speed: 100,
            archetype: archetype,
            position: { ...pos },
            previousPosition: { ...pos },
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
            }),
            components: new Map<string, GameComponent>([
                ['physics', { type: 'physics', weightClass: 'Standard' } as PhysicsComponent],
                ['archetype', { type: 'archetype', archetype } as ArchetypeComponent]
            ])
        };
    }

    spawnEnemy(type: string, pos: Point, id: string) {
        const stats = (ENEMY_STATS as any)[type] || { hp: 1, maxHp: 1, speed: 50, weightClass: 'Standard' };
        this.state.enemies.push({
            id,
            type: 'enemy',
            subtype: type,
            factionId: 'enemy',
            speed: stats.speed || 50,
            weightClass: stats.weightClass || 'Standard',
            position: { ...pos },
            previousPosition: { ...pos },
            hp: stats.hp,
            maxHp: stats.maxHp,
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: [{
                id: 'BASIC_ATTACK',
                name: 'Basic Attack',
                description: 'Melee strike',
                slot: 'offensive',
                cooldown: 0,
                currentCooldown: 0,
                range: 1,
                upgrades: [],
                activeUpgrades: []
            }],
            components: new Map<string, GameComponent>([
                ['physics', { type: 'physics', weightClass: stats.weightClass || 'Standard' } as PhysicsComponent]
            ])
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

    applyStatus(targetId: string, status: 'stunned', duration: number = 1) {
        const enemyIndex = this.state.enemies.findIndex(e => e.id === targetId);
        if (enemyIndex !== -1) {
            this.state.enemies[enemyIndex] = addStatus(this.state.enemies[enemyIndex], status, duration);
        } else if (this.state.player.id === targetId) {
            this.state.player = addStatus(this.state.player, status, duration);
        }
    }

    addUpgrade(skillId: string, upgradeId: string) {
        this.state.player.activeSkills = (this.state.player.activeSkills || []).map(s => {
            if (s.id === skillId) {
                return { ...s, activeUpgrades: [...(s.activeUpgrades || []), upgradeId] };
            }
            return s;
        });
    }

    useSkill(skillId: string, target?: Point) {
        this.dispatch({ type: 'USE_SKILL', payload: { skillId, target } });
    }

    dispatch(action: Action) {
        const oldLogLength = this.state.message.length;
        const nextState = gameReducer(this.state, action);
        const newMessages = nextState.message.slice(oldLogLength);
        this.logs.push(...newMessages);
        this.state = nextState;

        // Auto-advance turns in headless mode if it's not player's turn
        // This mimics the UI useEffect loop
        let safety = 0;
        while (!isPlayerTurn(this.state) && this.state.gameStatus === 'playing' && safety < 100) {
            const advAc: Action = { type: 'ADVANCE_TURN' };
            const afterAdv = gameReducer(this.state, advAc);
            // Capture messages from enemy turns
            const advMessages = afterAdv.message.slice(this.state.message.length);
            this.logs.push(...advMessages);
            this.state = afterAdv;
            safety++;
        }
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

    setTurn(turn: number) {
        this.state.turnNumber = turn;
    }

    exitToHub() {
        this.dispatch({ type: 'EXIT_TO_HUB' });
    }
}

import * as fs from 'fs';

const logFile = 'skill_test_results.txt';
fs.writeFileSync(logFile, ''); // Clear file

function log(msg: string) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

function renderDiagnosticGrid(state: GameState, traces: any[] = []) {
    const width = state.gridWidth;
    const height = state.gridHeight;
    const lines: string[] = [];

    // P=Player, E=Enemy, #=Wall, L=Lava, *=Trace
    for (let r = 0; r < height; r++) {
        let line = ' '.repeat(r % 2 === 0 ? 0 : 2);
        for (let q = 0; q < width; q++) {
            const pos = { q, r, s: -q - r };
            const isPlayer = hexEquals(state.player.position, pos);
            const enemy = state.enemies.find(e => hexEquals(e.position, pos));
            const isWall = state.wallPositions.some(w => hexEquals(w, pos));
            const isLava = state.lavaPositions.some(l => hexEquals(l, pos));
            const isTrace = traces.some(t => t.path.some((p: Point) => hexEquals(p, pos)));

            let char = '.';
            if (isPlayer) char = 'P';
            else if (enemy) char = 'E';
            else if (isWall) char = '#';
            else if (isLava) char = 'L';
            else if (isTrace) char = '*';

            line += `[${char}]`;
        }
        lines.push(line);
    }
    return lines.join('\n');
}

async function runTests() {
    log('--- Skill Test Runner ---');
    let passed = 0;
    let failed = 0;

    for (const collection of SCENARIO_COLLECTIONS) {
        log(`Collection: ${collection.name} (${collection.id})`);
        log(`  ${collection.description}`);

        if (!collection.scenarios || collection.scenarios.length === 0) {
            log('  (No scenarios)');
            continue;
        }

        for (const scenario of collection.scenarios) {
            log(`  Scenario: ${scenario.title}`);

            const initialState = generateInitialState(1, 'test-seed');
            initialState.enemies = [];
            initialState.lavaPositions = [];
            initialState.wallPositions = [];
            initialState.slipperyPositions = [];
            initialState.voidPositions = [];
            initialState.shrinePosition = undefined;
            initialState.shrineOptions = undefined;
            initialState.stairsPosition = { q: 99, r: 99, s: -198 };
            initialState.gameStatus = 'playing';

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
                    if (scenario.rationale) {
                        log(`      Rationale: ${scenario.rationale}`);
                    }
                    log(`      Messages: ${JSON.stringify(engine.logs)}`);
                    log(`      Enemies: ${JSON.stringify(engine.state.enemies.map((e: Entity) => `${e.id}@${e.position.q},${e.position.r}`))}`);
                    log(`      Player: ${engine.state.player.position.q},${engine.state.player.position.r}`);

                    const traces = engine.state.visualEvents
                        ? engine.state.visualEvents.filter(ve => ve.type === 'kinetic_trace').map(ve => ve.payload)
                        : [];
                    log(`\nDiagnostic Grid:\n${renderDiagnosticGrid(engine.state, traces)}`);
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

// Only run the skill test runner when explicitly requested via env var.
if (typeof process !== 'undefined' && process.env.SKILL_TESTS_RUN === '1') {
    runTests();
}
