import type { GameState } from '../../types';
import { consumeRandom } from '../rng';
import { resolveAilmentStatValue } from './stat-mapping';
import type { AilmentApplicationComputation, AilmentApplicationInput } from './types';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const computeAilmentTriggerValue = (
    input: AilmentApplicationInput,
    resistanceBasePct: number,
    resistanceSpecificPct: number
): number => {
    const atk = resolveAilmentStatValue(input.source, input.ailment.core.atk);
    const def = resolveAilmentStatValue(input.target, input.ailment.core.def);
    const raw = (atk - def) + input.skillMultiplier - (resistanceBasePct + resistanceSpecificPct);
    return clamp(raw, 0, 100);
};

export const rollAilmentApplication = (
    state: GameState,
    triggerValue: number
): { nextState: GameState; roll: number; applied: boolean } => {
    const { value, nextState } = consumeRandom(state);
    const roll = Math.floor(value * 100) + 1;
    return {
        nextState,
        roll,
        applied: roll <= triggerValue
    };
};

export const computeAilmentDeposit = (
    triggerValue: number,
    scalingFactor: number,
    baseDeposit: number
): number => {
    if (scalingFactor <= 0) return Math.max(0, Math.floor(baseDeposit));
    return Math.max(0, Math.floor(baseDeposit + Math.floor(triggerValue / scalingFactor)));
};

export const computeAilmentApplication = (
    state: GameState,
    input: AilmentApplicationInput,
    resistanceBasePct: number,
    resistanceSpecificPct: number
): { nextState: GameState; result: AilmentApplicationComputation } => {
    const triggerValue = computeAilmentTriggerValue(input, resistanceBasePct, resistanceSpecificPct);
    const rollResult = rollAilmentApplication(state, triggerValue);
    const depositAmount = rollResult.applied
        ? computeAilmentDeposit(triggerValue, input.ailment.core.scalingFactor, input.baseDeposit)
        : 0;
    return {
        nextState: rollResult.nextState,
        result: {
            triggerValue,
            roll: rollResult.roll,
            applied: rollResult.applied,
            depositAmount
        }
    };
};

