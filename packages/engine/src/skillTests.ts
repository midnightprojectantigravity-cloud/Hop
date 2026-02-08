import type { Action, GameState, Point, Entity, VisualEvent } from './types';
import { gameReducer, generateInitialState } from './logic';
import { ENEMY_STATS } from './constants';
import { hexEquals } from './hex';
import { isPlayerTurn } from './systems/initiative';
import { SCENARIO_COLLECTIONS } from './scenarios';
import { addStatus } from './systems/actor';
import { pointToKey, UnifiedTileService } from './systems/unified-tile-service';
import { createEnemy, createFalcon, createPlayer } from './systems/entity-factory';

/**
 * Headless Engine wrapper for functional Skill Scenarios.
 */
export class ScenarioEngine {
    state: GameState;
    logs: string[] = [];
    events: VisualEvent[] = [];

    constructor(initialState: GameState) {
        this.state = initialState;
    }

    setPlayer(pos: Point, skillIds: string[], archetype: 'VANGUARD' | 'SKIRMISHER' = 'VANGUARD') {
        const player = createPlayer({
            position: { ...pos },
            skills: skillIds,
            archetype
        });
        player.previousPosition = { ...pos };
        this.state.player = {
            ...this.state.player,
            ...player
        };
    }

    spawnEnemy(type: string, pos: Point, id: string) {
        const stats = (ENEMY_STATS as any)[type] || { hp: 1, maxHp: 1, speed: 1, weightClass: 'Standard' };
        const entity = createEnemy({
            id,
            subtype: type,
            position: { ...pos },
            hp: stats.hp,
            maxHp: stats.maxHp,
            speed: stats.speed || 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK'],
            weightClass: stats.weightClass || 'Standard'
        });
        entity.previousPosition = { ...pos };
        this.state.enemies.push(entity);
    }

    spawnFalcon(pos: Point, id: string) {
        // We use the player as the owner for these tests.
        const falcon = createFalcon({ ownerId: 'player', position: { ...pos } }) as Entity;
        falcon.id = id;
        falcon.position = { ...pos };
        falcon.previousPosition = { ...pos };
        falcon.companionState = {
            mode: falcon.companionState?.mode || 'roost',
            orbitStep: falcon.companionState?.orbitStep,
            apexStrikeCooldown: 0
        };

        this.state.enemies.push(falcon);
        if (!this.state.companions) this.state.companions = [];
        this.state.companions.push(falcon);
    }

    spawnCompanion(type: string, pos: Point, id: string) {
        if (type === 'falcon') {
            this.spawnFalcon(pos, id);
        }
    }

    setTile(pos: Point, type: 'lava' | 'wall' | 'floor' | 'slippery' | 'void') {
        const key = pointToKey(pos);

        if (!this.state.tiles) {
            this.state.tiles = new Map();
        }

        const newTile = {
            baseId: 'STONE' as any,
            position: pos,
            traits: new Set<any>(),
            effects: []
        };

        if (type === 'wall') {
            newTile.baseId = 'WALL';
            newTile.traits.add('BLOCKS_MOVEMENT');
            newTile.traits.add('BLOCKS_LOS');
            newTile.traits.add('ANCHOR');
        } else if (type === 'lava') {
            newTile.baseId = 'LAVA';
            newTile.traits.add('WALKABLE');
            newTile.traits.add('HAZARDOUS');
            newTile.traits.add('LIQUID');
        } else if (type === 'void') {
            newTile.baseId = 'VOID';
            newTile.traits.add('HAZARDOUS');
        } else if (type === 'slippery') {
            newTile.baseId = 'ICE';
            newTile.traits.add('WALKABLE');
            newTile.traits.add('SLIPPERY');
        } else {
            newTile.baseId = 'STONE';
            newTile.traits.add('WALKABLE');
        }

        this.state.tiles.set(key, newTile as any);
    }

    getTileAt(pos: Point) {
        return UnifiedTileService.getTileAt(this.state, pos);
    }

    syncTiles() {
        // No-op for now, as setTile directly populates state.tiles
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
        const oldEventLength = (this.state.visualEvents || []).length;

        const nextState = gameReducer(this.state, action);

        const newMessages = nextState.message.slice(oldLogLength);
        const newEvents = (nextState.visualEvents || []).slice(oldEventLength);

        this.logs.push(...newMessages);
        this.events.push(...newEvents);
        this.state = nextState;

        // WORLD-CLASS LOGIC: Autonomous Synchronization
        // The engine (via gameReducer -> processNextTurn) is now autonomous.
        // It will loop through AI turns automatically until it hits a player decision point.
        // We no longer need to manually dispatch ADVANCE_TURN.
    }

    /**
     * Executes an action without the autonomous loop trigger.
     * Useful for setup phases where we need discrete control.
     */
    dispatchSync(action: Action): GameState {
        const oldLogLength = this.state.message.length;
        const oldEventLength = (this.state.visualEvents || []).length;

        this.state = gameReducer(this.state, action);

        const newMessages = this.state.message.slice(oldLogLength);
        const newEvents = (this.state.visualEvents || []).slice(oldEventLength);

        this.logs.push(...newMessages);
        this.events.push(...newEvents);
        return this.state;
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

    for (let r = 0; r < height; r++) {
        let line = ' '.repeat(r % 2 === 0 ? 0 : 2);
        for (let q = 0; q < width; q++) {
            const pos = { q, r, s: -q - r };
            const isPlayer = hexEquals(state.player.position, pos);
            const enemy = state.enemies.find(e => hexEquals(e.position, pos));

            const key = `${pos.q},${pos.r}`;
            const tile = state.tiles.get(key);
            const isWall = tile?.baseId === 'WALL';
            const isLava = tile?.baseId === 'LAVA';

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
            initialState.shrinePosition = undefined;
            initialState.shrineOptions = undefined;
            initialState.stairsPosition = { q: 99, r: 99, s: -198 };
            initialState.gameStatus = 'playing';
            if (initialState.tiles) initialState.tiles.clear();

            const engine = new ScenarioEngine(initialState);

            try {
                scenario.setup(engine);
                engine.state.initiativeQueue = undefined;

                scenario.run(engine);

                const isSuccess = scenario.verify(engine.state, engine.logs, engine.events);

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

                    const traces = (engine.state as any).visualEvents
                        ? (engine.state as any).visualEvents.filter((ve: any) => ve.type === 'kinetic_trace').map((ve: any) => ve.payload)
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

if (typeof process !== 'undefined' && process.env.SKILL_TESTS_RUN === '1') {
    runTests();
}
