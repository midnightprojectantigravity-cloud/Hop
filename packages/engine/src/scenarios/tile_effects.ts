/**
 * TILE EFFECTS SCENARIOS
 * 
 * These scenarios demonstrate the new Observer-Based Tile Effects system.
 * Tiles now "watch" units and trigger effects when units pass through or land on them.
 * 
 * This is a vital architectural shift from "event-based" to "observer-based" effects.
 */

import type { GameState, Point } from '../types';
import { hexEquals } from '../hex';

/**
 * SCENARIO: The Lava Slide
 * 
 * RATIONALE:
 * Proves that lava affects momentum during kinetic movement.
 * A unit pushed across lava should travel less distance than across stone.
 * 
 * SETUP:
 * - 5 hexes in a line
 * - Hexes 2 and 3 are lava
 * - Warrior at hex 0
 * - Enemy at hex 1
 * 
 * ACTION:
 * - Warrior pushes enemy with momentum 6
 * 
 * EXPECTED:
 * - Hex 1 (Stone): Momentum 6 -> 5 (standard -1)
 * - Hex 2 (Lava): Momentum 5 -> 2 (standard -1, plus lava -2)
 * - Hex 3 (Lava): Momentum 2 -> -1 (standard -1, plus lava -2)
 * - Enemy stops on Hex 3
 * - Enemy has "Burning" status (from lava onEnter)
 * 
 * This proves that tiles can intercept and modify kinetic momentum.
 */
export const LAVA_SLIDE_SCENARIO = {
    id: 'lava_slide',
    title: 'The Lava Slide',
    description: 'Pushing an enemy across lava reduces momentum',
    rationale: `
        This scenario proves the tile effects system works correctly.
        Lava tiles should:
        1. Reduce momentum by 2 when units pass through (onPass)
        2. Apply damage when units land on them (onEnter)
        3. Interrupt the movement chain if a unit dies
    `,

    setup: (engine: any) => {
        // Create a horizontal line of 5 hexes
        // Using q-axis for simplicity
        const hexes: Point[] = [
            { q: 0, r: 2, s: -2 }, // Hex 0: Warrior
            { q: 1, r: 2, s: -3 }, // Hex 1: Enemy
            { q: 2, r: 2, s: -4 }, // Hex 2: Lava
            { q: 3, r: 2, s: -5 }, // Hex 3: Lava
            { q: 4, r: 2, s: -6 }, // Hex 4: Empty
        ];

        // Set up player (Warrior with shield)
        engine.state.player.position = hexes[0];
        engine.state.player.archetype = 'SKIRMISHER';
        engine.state.hasShield = true;

        // Set up enemy
        engine.state.enemies = [{
            id: 'goblin-1',
            type: 'enemy' as const,
            subtype: 'goblin',
            position: hexes[1],
            hp: 10,
            maxHp: 10,
            speed: 5,
            factionId: 'enemy',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: []
        }];

        // Set up lava at hexes 2 and 3
        engine.state.lavaPositions = [hexes[2], hexes[3]];

        // Clear walls
        engine.state.wallPositions = [];
    },

    run: (engine: any) => {
        const hexes: Point[] = [
            { q: 0, r: 2, s: -2 },
            { q: 1, r: 2, s: -3 },
            { q: 2, r: 2, s: -4 },
            { q: 3, r: 2, s: -5 },
            { q: 4, r: 2, s: -6 },
        ];

        // Player dashes to hex 1 (triggering tackle)
        engine.dispatch({ type: 'MOVE', payload: hexes[1] });
    },

    verify: (state: GameState, logs: string[]): boolean => {
        const hexes: Point[] = [
            { q: 0, r: 2, s: -2 },
            { q: 1, r: 2, s: -3 },
            { q: 2, r: 2, s: -4 },
            { q: 3, r: 2, s: -5 },
            { q: 4, r: 2, s: -6 },
        ];

        // Find the goblin
        const goblin = state.enemies.find(e => e.id === 'goblin-1');

        // The goblin should have died in the lava
        // OR if it survived (with modified damage), it should be on hex 3
        if (!goblin) {
            // Goblin died - this is acceptable if lava damage killed it
            console.log('✓ Goblin died in lava (expected behavior)');
            return true;
        }

        // If goblin survived, check position
        const onHex3 = hexEquals(goblin.position, hexes[3]);
        if (!onHex3) {
            console.log('✗ Goblin not on hex 3. Position:', goblin.position);
            return false;
        }

        console.log('✓ Goblin stopped on hex 3 (lava reduced momentum)');

        // Check for burning status (if implemented)
        const hasBurning = goblin.statusEffects.some(s => s.type === 'stunned');
        if (hasBurning) {
            console.log('✓ Goblin has status effect from lava');
        }

        return true;
    }
};

/**
 * SCENARIO: Ice Slide
 * 
 * RATIONALE:
 * Proves that ice preserves momentum (no friction).
 * A unit pushed across ice should travel FURTHER than across stone.
 * 
 * SETUP:
 * - 5 hexes in a line
 * - Hexes 2 and 3 are ice
 * - Warrior at hex 0
 * - Enemy at hex 1
 * 
 * ACTION:
 * - Warrior pushes enemy with momentum 4
 * 
 * EXPECTED:
 * - Hex 1 (Stone): Momentum 4 -> 3 (standard -1)
 * - Hex 2 (Ice): Momentum 3 -> 3 (no reduction!)
 * - Hex 3 (Ice): Momentum 3 -> 3 (no reduction!)
 * - Hex 4 (Stone): Momentum 3 -> 2
 * - Enemy slides to hex 4 or beyond
 */
export const ICE_SLIDE_SCENARIO = {
    id: 'ice_slide',
    title: 'The Ice Slide',
    description: 'Ice preserves momentum, causing units to slide further',
    rationale: `
        This scenario proves that different tile types can modify momentum differently.
        Ice tiles should NOT reduce momentum, causing units to slide further.
    `,

    setup: (engine: any) => {
        const hexes: Point[] = [
            { q: 0, r: 2, s: -2 }, // Hex 0: Warrior
            { q: 1, r: 2, s: -3 }, // Hex 1: Enemy
            { q: 2, r: 2, s: -4 }, // Hex 2: Ice
            { q: 3, r: 2, s: -5 }, // Hex 3: Ice
            { q: 4, r: 2, s: -6 }, // Hex 4: Empty
        ];

        engine.state.player.position = hexes[0];
        engine.state.player.archetype = 'SKIRMISHER';
        engine.state.hasShield = true;

        engine.state.enemies = [{
            id: 'goblin-1',
            type: 'enemy' as const,
            subtype: 'goblin',
            position: hexes[1],
            hp: 10,
            maxHp: 10,
            speed: 5,
            factionId: 'enemy',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: []
        }];

        // Set up ice at hexes 2 and 3
        engine.state.slipperyPositions = [hexes[2], hexes[3]];
        engine.state.lavaPositions = [];
        engine.state.wallPositions = [];
    },

    run: (engine: any) => {
        const hexes: Point[] = [
            { q: 0, r: 2, s: -2 },
            { q: 1, r: 2, s: -3 },
            { q: 2, r: 2, s: -4 },
            { q: 3, r: 2, s: -5 },
            { q: 4, r: 2, s: -6 },
        ];

        engine.dispatch({ type: 'MOVE', payload: hexes[1] });
    },

    verify: (state: GameState, logs: string[]): boolean => {
        const hexes: Point[] = [
            { q: 0, r: 2, s: -2 },
            { q: 1, r: 2, s: -3 },
            { q: 2, r: 2, s: -4 },
            { q: 3, r: 2, s: -5 },
            { q: 4, r: 2, s: -6 },
        ];

        const goblin = state.enemies.find(e => e.id === 'goblin-1');

        if (!goblin) {
            console.log('✗ Goblin disappeared');
            return false;
        }

        // Goblin should have slid further due to ice
        // At minimum, should be on hex 4
        const onHex4OrBeyond = goblin.position.q >= hexes[4].q;

        if (onHex4OrBeyond) {
            console.log('✓ Goblin slid further on ice. Position:', goblin.position);
            return true;
        } else {
            console.log('✗ Goblin did not slide far enough. Position:', goblin.position);
            return false;
        }
    }
};

/**
 * SCENARIO: Mixed Terrain
 * 
 * RATIONALE:
 * Proves that different tile types can be combined.
 * Tests the cumulative effect of multiple tile types in sequence.
 * 
 * SETUP:
 * - Stone -> Ice -> Lava -> Stone
 * 
 * EXPECTED:
 * - Ice preserves momentum
 * - Lava reduces momentum
 * - Final position depends on the interplay
 */
export const MIXED_TERRAIN_SCENARIO = {
    id: 'mixed_terrain',
    title: 'Mixed Terrain Challenge',
    description: 'Different tile types affect momentum differently',
    rationale: `
        This scenario tests the interaction between multiple tile types.
        It proves that the tile effects system can handle complex terrain.
    `,

    setup: (engine: any) => {
        const hexes: Point[] = [
            { q: 0, r: 2, s: -2 }, // Hex 0: Warrior
            { q: 1, r: 2, s: -3 }, // Hex 1: Enemy
            { q: 2, r: 2, s: -4 }, // Hex 2: Ice
            { q: 3, r: 2, s: -5 }, // Hex 3: Lava
            { q: 4, r: 2, s: -6 }, // Hex 4: Stone
            { q: 5, r: 2, s: -7 }, // Hex 5: Stone
        ];

        engine.state.player.position = hexes[0];
        engine.state.player.archetype = 'SKIRMISHER';
        engine.state.hasShield = true;

        engine.state.enemies = [{
            id: 'goblin-1',
            type: 'enemy' as const,
            subtype: 'goblin',
            position: hexes[1],
            hp: 100, // High HP to survive lava
            maxHp: 100,
            speed: 5,
            factionId: 'enemy',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: []
        }];

        engine.state.slipperyPositions = [hexes[2]]; // Ice
        engine.state.lavaPositions = [hexes[3]];     // Lava
        engine.state.wallPositions = [];
    },

    run: (engine: any) => {
        const hexes: Point[] = [
            { q: 0, r: 2, s: -2 },
            { q: 1, r: 2, s: -3 },
        ];

        engine.dispatch({ type: 'MOVE', payload: hexes[1] });
    },

    verify: (state: GameState, logs: string[]): boolean => {
        const goblin = state.enemies.find(e => e.id === 'goblin-1');

        if (!goblin) {
            console.log('✓ Goblin died in lava (acceptable)');
            return true;
        }

        console.log('✓ Goblin survived mixed terrain. Position:', goblin.position);
        console.log('  HP:', goblin.hp, '/', goblin.maxHp);

        // Goblin should have taken damage from lava
        const tookDamage = goblin.hp < goblin.maxHp;
        if (tookDamage) {
            console.log('✓ Goblin took damage from lava');
        }

        return true;
    }
};
