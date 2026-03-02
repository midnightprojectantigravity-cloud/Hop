import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { generateInitialState } from '../logic';
import { SkillRegistry } from '../skillRegistry';
import type { Actor, AtomicEffect } from '../types';
import { applyEffects } from '../systems/effect-engine';
import { createEnemy } from '../systems/entities/entity-factory';
import { validateLineOfSight } from '../systems/validation';

const getApplyStatusEffects = (effects: AtomicEffect[]) =>
    effects.filter((effect): effect is Extract<AtomicEffect, { type: 'ApplyStatus' }> => effect.type === 'ApplyStatus');

const configureState = () => {
    const state = generateInitialState(1, 'smoke-screen-blinding');
    const playerPos = createHex(3, 6);
    const adjacentEnemyPos = createHex(3, 5);
    const farEnemyPos = createHex(3, 3);

    state.player = {
        ...state.player,
        position: playerPos
    };

    const adjacentEnemy = createEnemy({
        id: 'enemy-adjacent',
        subtype: 'footman',
        position: adjacentEnemyPos,
        hp: 3,
        maxHp: 3,
        speed: 1,
        skills: ['STANDARD_VISION'],
        weightClass: 'Standard'
    });
    const farEnemy = createEnemy({
        id: 'enemy-far',
        subtype: 'footman',
        position: farEnemyPos,
        hp: 3,
        maxHp: 3,
        speed: 1,
        skills: ['STANDARD_VISION'],
        weightClass: 'Standard'
    });

    state.enemies = [adjacentEnemy, farEnemy];
    return { state, playerPos, adjacentEnemyPos };
};

const hasStatus = (actor: Actor | undefined, status: string): boolean =>
    !!actor?.statusEffects?.some(s => s.type === status);

const getSignatureIds = (state: { visualEvents?: Array<{ type: string; payload: any }> }): string[] =>
    (state.visualEvents || [])
        .filter(event => event.type === 'juice_signature')
        .map(event => String(event.payload?.signature || ''));

describe('SMOKE_SCREEN blinding upgrade', () => {
    it('keeps baseline behavior unchanged when BLINDING_SMOKE is not active', () => {
        const { state } = configureState();
        const smokeScreen = SkillRegistry.get('SMOKE_SCREEN');
        expect(smokeScreen).toBeTruthy();

        const result = smokeScreen!.execute(state, state.player, state.player.position, []);
        const statusEffects = getApplyStatusEffects(result.effects);
        expect(statusEffects.some(effect => effect.status === 'blinded')).toBe(false);
    });

    it('applies blinded only to adjacent hostile actors when BLINDING_SMOKE is active', () => {
        const { state } = configureState();
        const smokeScreen = SkillRegistry.get('SMOKE_SCREEN');
        expect(smokeScreen).toBeTruthy();

        const result = smokeScreen!.execute(state, state.player, state.player.position, ['BLINDING_SMOKE']);
        const statusEffects = getApplyStatusEffects(result.effects).filter(effect => effect.status === 'blinded');
        expect(statusEffects).toHaveLength(1);
        expect(statusEffects[0]?.target).toBe('enemy-adjacent');
    });

    it('blinded from SMOKE_SCREEN blocks capability LoS until explicitly overridden', () => {
        const { state, adjacentEnemyPos, playerPos } = configureState();
        const smokeScreen = SkillRegistry.get('SMOKE_SCREEN');
        expect(smokeScreen).toBeTruthy();

        const result = smokeScreen!.execute(state, state.player, state.player.position, ['BLINDING_SMOKE']);
        const nextState = applyEffects(state, result.effects, { sourceId: state.player.id });
        const blindedEnemy = nextState.enemies.find(enemy => enemy.id === 'enemy-adjacent');
        expect(hasStatus(blindedEnemy, 'blinded')).toBe(true);

        const blocked = validateLineOfSight(nextState, adjacentEnemyPos, playerPos, {
            observerActor: blindedEnemy,
            excludeActorId: blindedEnemy?.id
        });
        expect(blocked.isValid).toBe(false);

        const overridden = validateLineOfSight(nextState, adjacentEnemyPos, playerPos, {
            observerActor: blindedEnemy,
            excludeActorId: blindedEnemy?.id,
            context: { statusBlind: false }
        });
        expect(overridden.isValid).toBe(true);
    });

    it('emits blinded apply and expire juice signatures', () => {
        const { state } = configureState();
        const smokeScreen = SkillRegistry.get('SMOKE_SCREEN');
        expect(smokeScreen).toBeTruthy();

        const result = smokeScreen!.execute(state, state.player, state.player.position, ['BLINDING_SMOKE']);
        const appliedState = applyEffects(state, result.effects, { sourceId: state.player.id });
        expect(getSignatureIds(appliedState)).toContain('STATE.APPLY.SHADOW.BLINDED');

        const blindedEnemy = appliedState.enemies.find(enemy => enemy.id === 'enemy-adjacent');
        const blindedStatus = blindedEnemy?.statusEffects.find(status => status.type === 'blinded');
        expect(blindedStatus?.onTick).toBeTruthy();
        const expireTickEffects = blindedStatus!.onTick!(blindedEnemy!, appliedState);
        const expiredState = applyEffects(appliedState, expireTickEffects, {
            sourceId: blindedEnemy?.id,
            targetId: blindedEnemy?.id
        });
        expect(getSignatureIds(expiredState)).toContain('STATE.EXPIRE.SHADOW.BLINDED');
    });
});
