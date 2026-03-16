import { describe, expect, it } from 'vitest';
import { DEFAULT_IRES_METABOLIC_CONFIG } from '../systems/ires/metabolic-config';
import { simulateMetabolicWorkload } from '../systems/ires/metabolic-simulator';

describe('IRES metabolic simulator', () => {
    it('models mana casts as mana plus BFI without Spark spend', () => {
        const result = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'mind_mid_standard',
                label: 'Mind Mid Standard',
                body: 4,
                mind: 12,
                instinct: 4,
                weightClass: 'Standard'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.stationary_mana_cast
        });

        expect(result.manaSpentOpening5).toBeGreaterThan(0);
        expect(result.sparkSpentOnMovementOpening5).toBe(0);
        expect(result.sparkSpentOnNonMovementOpening5).toBe(0);
    });

    it('treats repeated BASIC_MOVE in one beat as materially harsher than single BASIC_MOVE', () => {
        const walking = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'balanced_mid_standard',
                label: 'Balanced Mid Standard',
                body: 7,
                mind: 7,
                instinct: 6,
                weightClass: 'Standard'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.basic_move_x1
        });
        const running = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'balanced_mid_standard',
                label: 'Balanced Mid Standard',
                body: 7,
                mind: 7,
                instinct: 6,
                weightClass: 'Standard'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.basic_move_x2
        });

        expect(running.peakExhaustionOpening5).toBeGreaterThan(walking.peakExhaustionOpening5);
        expect((running.firstRestTurn || 99)).toBeLessThanOrEqual(walking.firstRestTurn || 99);
    });

    it('applies passive recovery every beat and extra WAIT bonuses on rest beats', () => {
        const walking = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'balanced_mid_standard',
                label: 'Balanced Mid Standard',
                body: 7,
                mind: 7,
                instinct: 6,
                weightClass: 'Standard'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.basic_move_x1,
            turnLimit: 6
        });
        const waiting = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'balanced_mid_standard',
                label: 'Balanced Mid Standard',
                body: 7,
                mind: 7,
                instinct: 6,
                weightClass: 'Standard'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.wait_loop,
            turnLimit: 2
        });

        expect(walking.sparkRemainingTurnByTurn[0]).toBe(DEFAULT_IRES_METABOLIC_CONFIG.sparkPoolFormula.base + (7 * DEFAULT_IRES_METABOLIC_CONFIG.sparkPoolFormula.bodyScale));
        expect(waiting.exhaustionTurnByTurn[0]).toBe(0);
        expect(waiting.sparkRemainingTurnByTurn[0]).toBeGreaterThanOrEqual(waiting.sparkRemainingTurnByTurn[1] || 0);
    });

    it('makes move plus cast harsher than stationary casting for heavy mind profiles', () => {
        const stationary = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'mind_mid_heavy',
                label: 'Mind Mid Heavy',
                body: 4,
                mind: 12,
                instinct: 4,
                weightClass: 'Heavy'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.stationary_mana_cast
        });
        const moving = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'mind_mid_heavy',
                label: 'Mind Mid Heavy',
                body: 4,
                mind: 12,
                instinct: 4,
                weightClass: 'Heavy'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.heavy_mind_battleline
        });

        expect(['spark', 'exhaustion']).toContain(moving.firstFailureMode);
        expect(moving.movementShareOfSparkSpend).toBeGreaterThan(0);
        expect(moving.peakExhaustionOpening5).toBeGreaterThan(stationary.peakExhaustionOpening5);
        expect((moving.firstRestTurn || 99)).toBeLessThanOrEqual(stationary.firstRestTurn || 99);
    });

    it('makes travel move-only softer than battle move-only', () => {
        const battle = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'balanced_mid_standard',
                label: 'Balanced Mid Standard',
                body: 7,
                mind: 7,
                instinct: 6,
                weightClass: 'Standard'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.move_only_battle
        });
        const travel = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'balanced_mid_standard',
                label: 'Balanced Mid Standard',
                body: 7,
                mind: 7,
                instinct: 6,
                weightClass: 'Standard'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.move_only_travel
        });

        expect(travel.avgActionsPerTurnOpening5).toBeGreaterThanOrEqual(battle.avgActionsPerTurnOpening5);
        expect((travel.firstRestTurn || 99)).toBeGreaterThanOrEqual(battle.firstRestTurn || 0);
    });
});
