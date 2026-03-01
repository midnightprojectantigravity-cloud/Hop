import { generateInitialState } from '../logic';
import { type GameState, type Point, type Skill } from '../types';
import { type TileTrait } from '../systems/tiles/tile-types';
import { pointToKey } from '../hex';
import { buildInitiativeQueue } from '../systems/initiative';

/**
 * Creates a deterministic GameState for testing purposes.
 * Clears enemies and messages for a clean slate.
 */
export const createMockState = (overrides: Partial<GameState> = {}): GameState => {
    const state = generateInitialState(1, 'test-seed');

    // Clean slate for testing
    state.enemies = [];
    state.message = [];
    state.turnsSpent = 0;
    state.commandLog = [];
    state.visualEvents = [];
    state.gameStatus = 'playing';

    // Ensure player has DASH
    const dashSkill: Skill = {
        id: 'DASH',
        name: 'Dash',
        description: 'Dash',
        slot: 'utility',
        cooldown: 0,
        currentCooldown: 0,
        range: 4,
        upgrades: [],
        activeUpgrades: []
    };

    if (!state.player.activeSkills.some(s => s.id === 'DASH')) {
        state.player.activeSkills = [dashSkill, ...state.player.activeSkills];
    }

    // Initialize initiative and start player turn
    state.initiativeQueue = buildInitiativeQueue(state);
    state.initiativeQueue.currentIndex = 0; // Player acts first

    return { ...state, ...overrides };
};

/**
 * Places a custom tile into the GameState.
 */
export const placeTile = (state: GameState, pos: Point, traits: TileTrait[], baseId: any = 'STONE') => {
    state.tiles.set(pointToKey(pos), {
        position: pos,
        baseId: baseId,
        traits: new Set(traits),
        effects: [],
        occupantId: undefined
    });
};

/**
 * Helper to get a simple axial point
 */
export const p = (q: number, r: number): Point => ({ q, r, s: -q - r });
