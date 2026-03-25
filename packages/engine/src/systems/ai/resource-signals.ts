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
    const exhaustionRatio = clamp01(1 - sparkRatio);
    const reservePressure = clamp01(Math.max(1 - sparkRatio, 1 - manaRatio));
    const fatiguePressure = ires.currentState === 'exhausted'
        ? 1
        : ires.currentState === 'rested'
            ? clamp01(exhaustionRatio * 0.2)
            : clamp01(exhaustionRatio * 0.8);
    const actionChainPressure = clamp01(Math.max(0, Number(ires.actionCountThisTurn || 0) - 1) / 2);
    const recoveryPressure = clamp01(
        (fatiguePressure * 0.5)
        + (reservePressure * 0.35)
        + (actionChainPressure * 0.15)
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
