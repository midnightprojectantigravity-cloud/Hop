import type { IresMetabolicConfig, MetabolicRestRule } from './metabolic-types';

const DEFAULT_REST_RULE: MetabolicRestRule = {
    maxProjectedExhaustionBeforeRest: 80,
    minSparkBeforeRest: 0,
    minManaBeforeRest: 0
};

const RUN_REST_RULE: MetabolicRestRule = {
    maxProjectedExhaustionBeforeRest: 90,
    minSparkBeforeRest: 0,
    minManaBeforeRest: 0
};

const AGGRESSIVE_REST_RULE: MetabolicRestRule = {
    maxProjectedExhaustionBeforeRest: 95,
    minSparkBeforeRest: 0,
    minManaBeforeRest: 0
};

export const DEFAULT_METABOLIC_WORKLOAD_CATALOG: IresMetabolicConfig['workloadCatalog'] = {
    move_only_battle: {
        id: 'move_only_battle',
        label: 'Battle Move Only',
        mode: 'battle',
        turns: [{ actions: ['BASIC_MOVE'] }],
        repeat: true,
        restRule: DEFAULT_REST_RULE
    },
    move_only_travel: {
        id: 'move_only_travel',
        label: 'Travel Move Only',
        mode: 'travel',
        turns: [{ actions: ['BASIC_MOVE'] }],
        repeat: true,
        restRule: DEFAULT_REST_RULE
    },
    stationary_spark_attack: {
        id: 'stationary_spark_attack',
        label: 'Stationary Spark Attack',
        mode: 'battle',
        turns: [{ actions: ['spark_attack_standard'] }],
        repeat: true,
        restRule: DEFAULT_REST_RULE
    },
    stationary_mana_cast: {
        id: 'stationary_mana_cast',
        label: 'Stationary Mana Cast',
        mode: 'battle',
        turns: [{ actions: ['mana_cast_standard'] }],
        repeat: true,
        restRule: DEFAULT_REST_RULE
    },
    move_then_attack: {
        id: 'move_then_attack',
        label: 'Move Then Attack',
        mode: 'battle',
        turns: [{ actions: ['BASIC_MOVE', 'spark_attack_standard'] }],
        repeat: true,
        restRule: AGGRESSIVE_REST_RULE
    },
    move_then_cast: {
        id: 'move_then_cast',
        label: 'Move Then Cast',
        mode: 'battle',
        turns: [{ actions: ['BASIC_MOVE', 'mana_cast_standard'] }],
        repeat: true,
        restRule: AGGRESSIVE_REST_RULE
    },
    dash_then_attack: {
        id: 'dash_then_attack',
        label: 'Dash Then Attack',
        mode: 'battle',
        turns: [{ actions: ['DASH', 'spark_attack_standard'] }],
        repeat: true,
        restRule: AGGRESSIVE_REST_RULE
    },
    jump_then_attack: {
        id: 'jump_then_attack',
        label: 'Jump Then Attack',
        mode: 'battle',
        turns: [{ actions: ['JUMP', 'spark_attack_standard'] }],
        repeat: true,
        restRule: AGGRESSIVE_REST_RULE
    },
    hybrid_escape: {
        id: 'hybrid_escape',
        label: 'Hybrid Escape',
        mode: 'battle',
        turns: [{ actions: ['WITHDRAWAL'] }],
        repeat: true,
        restRule: AGGRESSIVE_REST_RULE
    },
    blink_cast_cycle: {
        id: 'blink_cast_cycle',
        label: 'Blink Cast Cycle',
        mode: 'battle',
        turns: [{ actions: ['PHASE_STEP', 'mana_cast_standard'] }],
        repeat: true,
        restRule: AGGRESSIVE_REST_RULE
    },
    heavy_mind_battleline: {
        id: 'heavy_mind_battleline',
        label: 'Heavy Mind Battleline',
        mode: 'battle',
        turns: [{ actions: ['BASIC_MOVE', 'mana_cast_standard'] }],
        repeat: true,
        restRule: AGGRESSIVE_REST_RULE
    },
    instinct_burst: {
        id: 'instinct_burst',
        label: 'Instinct Burst',
        mode: 'battle',
        turns: [
            { actions: ['BASIC_MOVE'] },
            { actions: ['BASIC_MOVE'] },
            { actions: ['BASIC_MOVE', 'spark_attack_light'] },
            { actions: ['BASIC_MOVE'] },
            { actions: ['BASIC_MOVE'] },
            { actions: ['BASIC_MOVE', 'spark_attack_light', 'spark_attack_light'] }
        ],
        repeat: true,
        restRule: AGGRESSIVE_REST_RULE
    },
    basic_move_x1: {
        id: 'basic_move_x1',
        label: 'BASIC_MOVE x1',
        mode: 'battle',
        turns: [{ actions: ['BASIC_MOVE'] }],
        repeat: true,
        restRule: DEFAULT_REST_RULE
    },
    basic_move_x2: {
        id: 'basic_move_x2',
        label: 'BASIC_MOVE x2',
        mode: 'battle',
        turns: [{ actions: ['BASIC_MOVE', 'BASIC_MOVE'] }],
        repeat: true,
        restRule: RUN_REST_RULE
    },
    basic_move_x3: {
        id: 'basic_move_x3',
        label: 'BASIC_MOVE x3',
        mode: 'battle',
        turns: [{ actions: ['BASIC_MOVE', 'BASIC_MOVE', 'BASIC_MOVE'] }],
        repeat: true,
        restRule: AGGRESSIVE_REST_RULE
    },
    basic_move_then_standard_attack: {
        id: 'basic_move_then_standard_attack',
        label: 'BASIC_MOVE Then Standard Attack',
        mode: 'battle',
        turns: [{ actions: ['BASIC_MOVE', 'spark_attack_standard'] }],
        repeat: true,
        restRule: AGGRESSIVE_REST_RULE
    },
    basic_move_then_standard_cast: {
        id: 'basic_move_then_standard_cast',
        label: 'BASIC_MOVE Then Standard Cast',
        mode: 'battle',
        turns: [{ actions: ['BASIC_MOVE', 'mana_cast_standard'] }],
        repeat: true,
        restRule: AGGRESSIVE_REST_RULE
    },
    wait_loop: {
        id: 'wait_loop',
        label: 'WAIT Loop',
        mode: 'battle',
        turns: [{ actions: ['rest'] }],
        repeat: true,
        restRule: DEFAULT_REST_RULE
    },
    instinct_move_burst: {
        id: 'instinct_move_burst',
        label: 'Instinct Move Burst',
        mode: 'battle',
        turns: [
            { actions: ['BASIC_MOVE'] },
            { actions: ['BASIC_MOVE'] },
            { actions: ['BASIC_MOVE', 'spark_attack_light'] },
            { actions: ['BASIC_MOVE'] },
            { actions: ['BASIC_MOVE'] },
            { actions: ['BASIC_MOVE', 'spark_attack_light', 'spark_attack_light'] }
        ],
        repeat: true,
        restRule: AGGRESSIVE_REST_RULE
    }
};
