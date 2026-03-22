import { describe, expect, it } from 'vitest';
import { DEFAULT_IRES_METABOLIC_CONFIG } from '../systems/ires/metabolic-config';
import { simulateMetabolicWorkload } from '../systems/ires/metabolic-simulator';

describe('IRES metabolic simulator', () => {
    it('models mana casts as mana plus BFI without Spark spend', () => {
        const result = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'caster_mind_standard',
                label: 'Caster Mind Standard',
                body: 6,
                mind: 16,
                instinct: 8,
                weightClass: 'Standard',
                burdenTier: 'Medium'
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
                id: 'standard_human_standard',
                label: 'Standard Human Standard',
                body: 10,
                mind: 10,
                instinct: 10,
                weightClass: 'Standard',
                burdenTier: 'Medium'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.basic_move_x1
        });
        const running = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'standard_human_standard',
                label: 'Standard Human Standard',
                body: 10,
                mind: 10,
                instinct: 10,
                weightClass: 'Standard',
                burdenTier: 'Medium'
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
                id: 'standard_human_standard',
                label: 'Standard Human Standard',
                body: 10,
                mind: 10,
                instinct: 10,
                weightClass: 'Standard',
                burdenTier: 'Medium'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.basic_move_x1,
            turnLimit: 6
        });
        const waiting = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'standard_human_standard',
                label: 'Standard Human Standard',
                body: 10,
                mind: 10,
                instinct: 10,
                weightClass: 'Standard',
                burdenTier: 'Medium'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.wait_loop,
            turnLimit: 2
        });

        expect(walking.sparkRemainingTurnByTurn[0]).toBe(
            Math.round(DEFAULT_IRES_METABOLIC_CONFIG.sparkPoolFormula.base + (10 * DEFAULT_IRES_METABOLIC_CONFIG.sparkPoolFormula.bodyScale))
        );
        expect(waiting.exhaustionTurnByTurn[0]).toBe(0);
        expect(waiting.sparkRemainingTurnByTurn[0]).toBeGreaterThanOrEqual(waiting.sparkRemainingTurnByTurn[1] || 0);
    });

    it('makes move plus cast harsher than stationary casting for heavy mind profiles', () => {
        const stationary = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'boss_anchor_heavy',
                label: 'Boss Anchor Heavy',
                body: 18,
                mind: 14,
                instinct: 10,
                weightClass: 'Heavy',
                burdenTier: 'Heavy'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.stationary_mana_cast
        });
        const moving = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'boss_anchor_heavy',
                label: 'Boss Anchor Heavy',
                body: 18,
                mind: 14,
                instinct: 10,
                weightClass: 'Heavy',
                burdenTier: 'Heavy'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.caster_signature_loop
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
                id: 'standard_human_standard',
                label: 'Standard Human Standard',
                body: 10,
                mind: 10,
                instinct: 10,
                weightClass: 'Standard',
                burdenTier: 'Medium'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.move_only_battle
        });
        const travel = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'standard_human_standard',
                label: 'Standard Human Standard',
                body: 10,
                mind: 10,
                instinct: 10,
                weightClass: 'Standard',
                burdenTier: 'Medium'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.move_only_travel
        });

        expect(travel.avgActionsPerTurnOpening5).toBeGreaterThanOrEqual(battle.avgActionsPerTurnOpening5);
        expect((travel.firstRestTurn || 99)).toBeGreaterThanOrEqual(battle.firstRestTurn || 0);
    });

    it('keeps companion and bomber loops inside their intended reserve lanes', () => {
        const falcon = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'companion_falcon_light',
                label: 'Companion Falcon Light',
                body: 4,
                mind: 6,
                instinct: 18,
                weightClass: 'Light',
                burdenTier: 'None'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.falcon_support_loop
        });
        const skeleton = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'companion_skeleton_standard',
                label: 'Companion Skeleton Standard',
                body: 12,
                mind: 2,
                instinct: 4,
                weightClass: 'Standard',
                burdenTier: 'Medium'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.skeleton_attrition_loop
        });
        const bomber = simulateMetabolicWorkload({
            config: DEFAULT_IRES_METABOLIC_CONFIG,
            profile: {
                id: 'caster_mind_light',
                label: 'Caster Mind Light',
                body: 6,
                mind: 16,
                instinct: 8,
                weightClass: 'Light',
                burdenTier: 'Light'
            },
            workload: DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.bomber_setup_loop
        });

        expect(falcon.firstFailureMode).not.toBe('mana');
        expect(falcon.avgActionsPerTurnOpening5).toBeGreaterThanOrEqual(1);
        expect((falcon.firstRestTurn || 99)).toBeGreaterThanOrEqual(2);

        expect(skeleton.avgActionsPerTurnOpening5).toBeLessThanOrEqual(1.2);
        expect((skeleton.firstRestTurn || 99)).toBeGreaterThanOrEqual(1);

        expect(bomber.firstFailureMode).not.toBe('mana');
        expect((bomber.firstRestTurn || 99)).toBeGreaterThanOrEqual(2);
    });
});
