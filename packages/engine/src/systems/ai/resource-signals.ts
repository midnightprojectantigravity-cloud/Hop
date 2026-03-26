import type { IresRuntimeState } from '../../types';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export interface AiResourceSignals {
    sparkRatio: number;
    manaRatio: number;
    exhaustionRatio: number;
    reservePressure: number;
    fatiguePressure: number;
    recoveryPressure: number;
    actionChainPressure: number;
}

export const getAiResourceSignals = (ires: IresRuntimeState | null | undefined): AiResourceSignals => {
    if (!ires) {
        return {
            sparkRatio: 1,
            manaRatio: 1,
            exhaustionRatio: 0,
            reservePressure: 0,
            fatiguePressure: 0,
            recoveryPressure: 0,
            actionChainPressure: 0
        };
    }

    const sparkRatio = clamp01(Number(ires.spark || 0) / Math.max(1, Number(ires.maxSpark || 1)));
    const manaRatio = clamp01(Number(ires.mana || 0) / Math.max(1, Number(ires.maxMana || 1)));
    const sparkDepletion = clamp01(1 - sparkRatio);
    const exhaustionRatio = sparkDepletion;
    const reservePressure = clamp01(Math.max(1 - sparkRatio, 1 - manaRatio));
    const fatiguePressure = ires.currentState === 'exhausted'
        ? 1
        : ires.currentState === 'rested'
            ? clamp01(sparkDepletion * 0.1)
            : clamp01(sparkDepletion * 0.85);
    const actionChainPressure = clamp01(Math.max(0, Number(ires.actionCountThisTurn || 0)) / 3);
    const recoveryPressure = clamp01(
        (fatiguePressure * 0.55)
        + (reservePressure * 0.35)
        + (actionChainPressure * 0.1)
    );

    return {
        sparkRatio,
        manaRatio,
        exhaustionRatio,
        reservePressure,
        fatiguePressure,
        recoveryPressure,
        actionChainPressure
    };
};
