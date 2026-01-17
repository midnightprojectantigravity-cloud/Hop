/**
 * TDD: KINETIC KERNEL TESTS
 * Focus: Pure 1D physics - momentum drain, cluster merging, wall collisions
 *
 * Run independently: npx vitest run src/__tests__/kinetic-kernel.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
    resolveKineticDash,
    getDisplacement,
    type BoardState,
    type KineticEntity
} from '../systems/kinetic-kernel';

describe('Kinetic Kernel', () => {
    describe('Momentum Costing', () => {
        it('The Clean Slide: Single target slides with momentum', () => {
            const state: BoardState = {
                momentum: 5,
                entities: [
                    { id: 'S', type: 'S', pos: -1 },
                    { id: 'M0', type: 'M', pos: 0 },
                    { id: 'W', type: 'I', pos: 10 } // Far wall
                ]
            };

            const result = resolveKineticDash(state);

            // S is free, M0 costs 1 per step = 5 steps
            expect(result.finalState.find(e => e.id === 'S')?.pos).toBe(0);
            expect(result.finalState.find(e => e.id === 'M0')?.pos).toBe(5);
        });

        it('Initial cluster: S + 2 Ms with Newtonian handoff', () => {
            const state: BoardState = {
                momentum: 4,
                entities: [
                    { id: 'S', type: 'S', pos: -1 },
                    { id: 'M0', type: 'M', pos: 0 },
                    { id: 'M1', type: 'M', pos: 1 },
                    { id: 'W', type: 'I', pos: 10 }
                ]
            };

            const result = resolveKineticDash(state);

            // Newtonian Handoff Behavior:
            // Pulse 1 (Initial): S@-1, M0@0, M1@1 form cluster. Cost=2. Move all → S@0, M0@1, M1@2
            //   Handoff: Front unit M1 (now at 2) becomes active. Momentum 4→2.
            // Pulse 2 (Collateral): M1@2 alone. Cost=1. Move → M1@3. Momentum 2→1.
            // Pulse 3 (Collateral): M1@3 alone. Cost=1. Move → M1@4. Momentum 1→0.
            // Final: M1 at 4 (front unit slides free after initial cluster push)
            expect(result.finalState.find(e => e.id === 'M1')?.pos).toBe(4);
            expect(result.finalState.find(e => e.id === 'M0')?.pos).toBe(1);
            expect(result.finalState.find(e => e.id === 'S')?.pos).toBe(0);
        });
    });

    describe('Cluster Merging (Double Chain)', () => {
        it('Picks up second unit mid-dash, increasing cost', () => {
            const state: BoardState = {
                momentum: 8,
                entities: [
                    { id: 'S', type: 'S', pos: -1 },
                    { id: 'M0', type: 'M', pos: 0 },
                    { id: 'M1', type: 'M', pos: 2 }, // Gap of 1
                    { id: 'M2', type: 'M', pos: 3 },
                    { id: 'W', type: 'I', pos: 20 }
                ]
            };

            const result = resolveKineticDash(state);

            // S jumps to pos -1 -> 0
            // Phase 1: S at -1, M0 at 0 (cluster = [S, M0]). S free, M0 costs 1.
            //   Step 1: Momentum 8->7. M0 -> 1. S -> 0.
            //   M1 at 2, M2 at 3 (not adjacent yet)
            //   Step 2: M0 initiates a new Phase (function recursive iteration) with momentum 7.
            // Phase 2: Cluster = [M0, M1, M2]. Collateral pulse, cost = 3 per step.
            //   Step 3: 7->4. All shift to 2,3,4. 
            //   Step 4: M2 initiates a new Phase (function recursive iteration) with momentum 4.
            // Phase 3: Cluster = [M2]. Collateral pulse, cost = 1 per step.
            //   Step 5: 4->3. M2 -> 5.
            //   Step 6: 3->2. M2 -> 6.
            //   Step 7: 2->1. M2 -> 7.
            //   Step 8: 1->0. M2 -> 8.

            expect(result.finalState.find(e => e.id === 'S')?.pos).toBe(0);
            expect(result.finalState.find(e => e.id === 'M0')?.pos).toBe(2);
            expect(result.finalState.find(e => e.id === 'M1')?.pos).toBe(3);
            expect(result.finalState.find(e => e.id === 'M2')?.pos).toBe(8);
        });

        it('Double Chain Merge with limited momentum stops correctly', () => {
            const state: BoardState = {
                momentum: 3,
                entities: [
                    { id: 'S', type: 'S', pos: -1 },
                    { id: 'M0', type: 'M', pos: 0 },
                    { id: 'M1', type: 'M', pos: 2 },
                    { id: 'M2', type: 'M', pos: 3 },
                    { id: 'W', type: 'I', pos: 20 }
                ]
            };

            const result = resolveKineticDash(state);

            // With only 3 momentum:
            // Step 1: cluster = [S, M0], cost 1, S -> 0, M0 -> 1, 2 momentum left
            // Step 2: Cluster = [M0, M1, M2], cost 3 > momentum 2 -> can't afford!
            // Final: S at 0, M0 at 1, M1 at 2, M2 at 3
            expect(result.finalState.length).toBeGreaterThan(0);
            expect(result.finalState.find(e => e.id === 'S')?.pos).toBe(0);
            expect(result.finalState.find(e => e.id === 'M0')?.pos).toBe(1);
            expect(result.finalState.find(e => e.id === 'M1')?.pos).toBe(2);
            expect(result.finalState.find(e => e.id === 'M2')?.pos).toBe(3);
        });
    });

    describe('Wall Collision (The Crunch)', () => {
        it('Cluster hitting wall gets stunned', () => {
            const state: BoardState = {
                momentum: 4,
                entities: [
                    { id: 'S', type: 'S', pos: -1 },
                    { id: 'M0', type: 'M', pos: 0 },
                    { id: 'M1', type: 'M', pos: 1 },
                    { id: 'W', type: 'I', pos: 2 } // Wall right in front
                ]
            };

            const result = resolveKineticDash(state);

            // Step 1: cluster = [S, M0, M1]
            // Wall at pos 2 is immediately ahead of M1 at pos 1
            // Cluster stuck, no one moves
            expect(result.finalState.find(e => e.id === 'S')?.pos).toBe(-1);
            expect(result.finalState.find(e => e.id === 'M0')?.pos).toBe(0);
            expect(result.finalState.find(e => e.id === 'M1')?.pos).toBe(1);
        });
    });

    describe('Boundary Injection', () => {
        it('Map edge acts as virtual wall', () => {
            const state: BoardState = {
                momentum: 10,
                entities: [
                    { id: 'S', type: 'S', pos: -1 },
                    { id: 'M0', type: 'M', pos: 0 },
                    { id: 'M1', type: 'M', pos: 1 },
                    { id: 'MAP_EDGE', type: 'I', pos: 3 } // Virtual wall from bridge
                ]
            };

            const result = resolveKineticDash(state);

            // Even with 10 momentum, can only push to pos 2 (wall at 3)
            expect(result.finalState.find(e => e.id === 'S')?.pos).toBe(0);
            expect(result.finalState.find(e => e.id === 'M0')?.pos).toBe(1);
            expect(result.finalState.find(e => e.id === 'M1')?.pos).toBe(2);
            expect(result.remainingMomentum).toBeGreaterThan(0);
        });
    });

    describe('Displacement Calculation', () => {
        it('getDisplacement correctly calculates movement', () => {
            const initial: KineticEntity[] = [
                { id: 'S', type: 'S', pos: 0 },
                { id: 'M0', type: 'M', pos: 1 }
            ];
            const final: KineticEntity[] = [
                { id: 'S', type: 'S', pos: 2 },
                { id: 'M0', type: 'M', pos: 5 }
            ];

            const displacements = getDisplacement(initial, final);

            expect(displacements.get('S')).toBe(2);
            expect(displacements.get('M0')).toBe(4);
        });
    });
});
