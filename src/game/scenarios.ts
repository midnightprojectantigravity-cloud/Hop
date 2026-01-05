import type { GameState, Scenario, Entity, Action } from './types';
import { createHex } from './hex';
import { createDefaultSkills } from './skills';

/**
 * Injects a scenario into a fresh GameState
 */
export const injectScenario = (scenario: Scenario): GameState => {
    const { state, grid } = scenario;

    // Build player
    const player: Entity = {
        id: 'player',
        type: 'player',
        position: state.player.pos,
        previousPosition: state.player.pos,
        hp: state.player.hp ?? 3,
        maxHp: state.player.maxHp ?? 3,
        activeSkills: createDefaultSkills().filter(s =>
            state.player.skills.map(sk => sk.toUpperCase()).includes(s.id)
        )
    };

    // Build enemies
    const enemies: Entity[] = state.enemies.map(e => ({
        id: e.id,
        type: 'enemy',
        subtype: e.type,
        position: e.pos,
        previousPosition: e.pos,
        hp: e.hp ?? 1,
        maxHp: e.hp ?? 1,
        enemyType: ['archer', 'warlock'].includes(e.type) ? 'ranged' : 'melee'
    }));

    return {
        turn: 1,
        player,
        enemies,
        gridWidth: grid.w,
        gridHeight: grid.h,
        gameStatus: 'playing',
        message: [scenario.metadata.text],
        hasSpear: true,
        lavaPositions: state.lava,
        wallPositions: state.walls || [],
        stairsPosition: createHex(-1, -1), // Not used in tutorials usually
        upgrades: [],
        actionLog: [],
        kills: 0,
        environmentalKills: 0,
        floor: 0, // 0 indicates tutorial/scenario mode
    };
};

/**
 * Converts a scenario action to a standard game action
 */
export const resolveScenarioAction = (scenarioAction: any): Action => {
    if (scenarioAction.type === 'SKILL') {
        return {
            type: 'USE_SKILL',
            payload: {
                skillId: scenarioAction.id.toUpperCase(),
                target: scenarioAction.target
            }
        };
    }
    return scenarioAction as Action;
};
