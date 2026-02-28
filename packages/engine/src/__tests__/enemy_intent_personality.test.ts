import { afterEach, describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { generateInitialState } from '../logic';
import { createEnemy } from '../systems/entities/entity-factory';
import {
    deriveEnemyDynamicIntentBias,
    getDynamicEnemyIntentBiasStrength,
    isDynamicEnemyIntentBiasEnabled
} from '../systems/ai/enemy/personality';
import { getEnemyPolicyProfile } from '../systems/ai/enemy/policies';
import type { EnemyAiContext } from '../systems/ai/enemy/types';

const ENV_KEY = 'HOP_ENEMY_AI_DYNAMIC_INTENT_BIAS';
const STRENGTH_ENV_KEY = 'HOP_ENEMY_AI_DYNAMIC_INTENT_BIAS_STRENGTH';
const ORIGINAL_ENV = process.env[ENV_KEY];
const ORIGINAL_STRENGTH_ENV = process.env[STRENGTH_ENV_KEY];

afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
        delete process.env[ENV_KEY];
    } else {
        process.env[ENV_KEY] = ORIGINAL_ENV;
    }
    if (ORIGINAL_STRENGTH_ENV === undefined) {
        delete process.env[STRENGTH_ENV_KEY];
    } else {
        process.env[STRENGTH_ENV_KEY] = ORIGINAL_STRENGTH_ENV;
    }
});

const buildContext = (): EnemyAiContext => {
    const base = generateInitialState(1, 'enemy-intent-personality', 'enemy-intent-personality');
    const enemy = createEnemy({
        id: 'test_raider',
        subtype: 'raider',
        position: createHex(2, 2),
        speed: 2,
        skills: ['BASIC_MOVE', 'BASIC_ATTACK', 'DASH', 'SMOKE_SCREEN'],
        trinity: { body: 8, mind: 5, instinct: 6 }
    });
    const playerPos = createHex(2, 0);
    const state = {
        ...base,
        player: { ...base.player, position: playerPos },
        enemies: [enemy],
        occupiedCurrentTurn: [enemy.position]
    };
    return {
        enemy,
        playerPos,
        state
    };
};

describe('enemy intent personality bias', () => {
    it('is disabled by default', () => {
        delete process.env[ENV_KEY];
        delete process.env[STRENGTH_ENV_KEY];
        expect(isDynamicEnemyIntentBiasEnabled()).toBe(false);
        expect(getDynamicEnemyIntentBiasStrength()).toBe(1);

        const context = buildContext();
        const policy = getEnemyPolicyProfile(context.enemy.subtype);
        const bias = deriveEnemyDynamicIntentBias(context, policy);
        expect(bias).toEqual({
            offense: 0,
            positioning: 0,
            control: 0,
            defense: 0
        });
    });

    it('derives deterministic non-zero bias when feature flag is enabled', () => {
        process.env[ENV_KEY] = '1';
        delete process.env[STRENGTH_ENV_KEY];
        expect(isDynamicEnemyIntentBiasEnabled()).toBe(true);
        expect(getDynamicEnemyIntentBiasStrength()).toBe(1);

        const context = buildContext();
        const policy = getEnemyPolicyProfile(context.enemy.subtype);
        const first = deriveEnemyDynamicIntentBias(context, policy);
        const second = deriveEnemyDynamicIntentBias(context, policy);

        expect(first).toEqual(second);
        expect(first.offense).toBeGreaterThan(0);
        expect(first.positioning).toBeGreaterThan(0);
        expect(first.control).toBeGreaterThan(0);
        expect(first.defense).toBeGreaterThan(0);
    });

    it('supports deterministic strength scaling when enabled', () => {
        process.env[ENV_KEY] = '1';

        const context = buildContext();
        const policy = getEnemyPolicyProfile(context.enemy.subtype);

        process.env[STRENGTH_ENV_KEY] = '1';
        const base = deriveEnemyDynamicIntentBias(context, policy);
        const baseTotal = base.offense + base.positioning + base.control + base.defense;

        process.env[STRENGTH_ENV_KEY] = '2';
        expect(getDynamicEnemyIntentBiasStrength()).toBe(2);
        const strong = deriveEnemyDynamicIntentBias(context, policy);
        const strongTotal = strong.offense + strong.positioning + strong.control + strong.defense;

        process.env[STRENGTH_ENV_KEY] = '0';
        const zero = deriveEnemyDynamicIntentBias(context, policy);

        expect(strongTotal).toBeGreaterThan(baseTotal);
        expect(zero).toEqual({
            offense: 0,
            positioning: 0,
            control: 0,
            defense: 0
        });
    });
});
