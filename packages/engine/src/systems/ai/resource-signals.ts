import type { AiSparkBand, GameState, IresRuntimeState } from '../../types';
import { classifyAiSparkBand } from './spark-doctrine';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export interface AiResourceSignals {
    sparkRatio: number;
    manaRatio: number;
    aiSparkBand: AiSparkBand;
    exhaustionRatio: number;
    reservePressure: number;
    fatiguePressure: number;
    recoveryPressure: number;
    actionChainPressure: number;
    isRestedAsset: boolean;
    restedPreservationPressure: number;
    restedReentryPotential: number;
    postStablePressure: number;
    criticalRisk: number;
    turnCadencePressure: number;
    canSafelyTakeSecondAction: boolean;
    fullSparkBurstWindow: boolean;
}

export const getAiResourceSignals = (
    ires: IresRuntimeState | null | undefined,
    ruleset?: GameState['ruleset'] | null
): AiResourceSignals => {
    if (!ires) {
        return {
            sparkRatio: 1,
            manaRatio: 1,
            aiSparkBand: 'rested_hold',
            exhaustionRatio: 0,
            reservePressure: 0,
            fatiguePressure: 0,
            recoveryPressure: 0,
            actionChainPressure: 0,
            isRestedAsset: true,
            restedPreservationPressure: 0,
            restedReentryPotential: 0,
            postStablePressure: 0,
            criticalRisk: 0,
            turnCadencePressure: 0,
            canSafelyTakeSecondAction: true,
            fullSparkBurstWindow: true
        };
    }

    const sparkRatio = clamp01(Number(ires.spark || 0) / Math.max(1, Number(ires.maxSpark || 1)));
    const manaRatio = clamp01(Number(ires.mana || 0) / Math.max(1, Number(ires.maxMana || 1)));
    const aiSparkBand = classifyAiSparkBand(ires, ruleset);
    const sparkDepletion = clamp01(1 - sparkRatio);
    const exhaustionRatio = sparkDepletion;
    const reservePressure = clamp01(Math.max(1 - sparkRatio, 1 - manaRatio));
    const fatiguePressure = ires.currentState === 'exhausted'
        ? 1
        : ires.currentState === 'rested'
            ? clamp01(sparkDepletion * 0.1)
            : clamp01(sparkDepletion * 0.45);
    const actionChainPressure = clamp01(Math.max(0, Number(ires.actionCountThisTurn || 0)) / 3);
    const turnCadencePressure = clamp01(Math.max(0, Number(ires.actionCountThisTurn || 0)) / 2);
    const recoveryPressure = clamp01(
        (fatiguePressure * 0.4)
        + (reservePressure * 0.25)
        + (actionChainPressure * 0.35)
    );
    const isRestedAsset = ires.currentState === 'rested';
    const restedPreservationPressure = aiSparkBand === 'rested_edge'
        ? 1
        : (aiSparkBand === 'rested_hold' ? 0.45 : 0);
    const restedReentryPotential = ires.currentState === 'rested'
        ? 1
        : clamp01((sparkRatio - 0.55) / 0.25);
    const postStablePressure = sparkRatio < 0.55 ? clamp01((0.55 - sparkRatio) / 0.2) : 0;
    const criticalRisk = sparkRatio < 0.35 ? clamp01((0.35 - sparkRatio) / 0.15) : 0;
    const canSafelyTakeSecondAction = (aiSparkBand === 'rested_hold' || aiSparkBand === 'rested_edge' || aiSparkBand === 'stable')
        && Number(ires.actionCountThisTurn || 0) === 0;
    const fullSparkBurstWindow = sparkRatio >= 0.85 && Number(ires.actionCountThisTurn || 0) === 0;

    return {
        sparkRatio,
        manaRatio,
        aiSparkBand,
        exhaustionRatio,
        reservePressure,
        fatiguePressure,
        recoveryPressure,
        actionChainPressure,
        isRestedAsset,
        restedPreservationPressure,
        restedReentryPotential,
        postStablePressure,
        criticalRisk,
        turnCadencePressure,
        canSafelyTakeSecondAction,
        fullSparkBurstWindow
    };
};
