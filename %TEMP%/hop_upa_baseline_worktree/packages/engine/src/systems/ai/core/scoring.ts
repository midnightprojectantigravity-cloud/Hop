import type { AiFeatureVector, AiScoreBreakdown } from './types';

export const scoreFeatures = (
    features: AiFeatureVector,
    weights: Record<string, number>
): AiScoreBreakdown => {
    const orderedFeatures: Record<string, number> = {};
    const orderedWeights: Record<string, number> = {};
    const contributions: Record<string, number> = {};

    const featureKeys = Array.from(new Set([
        ...Object.keys(features),
        ...Object.keys(weights)
    ])).sort();

    let total = 0;
    for (const key of featureKeys) {
        const featureValue = Number(features[key] || 0);
        const weightValue = Number(weights[key] || 0);
        const contribution = featureValue * weightValue;
        orderedFeatures[key] = featureValue;
        orderedWeights[key] = weightValue;
        contributions[key] = contribution;
        total += contribution;
    }

    return {
        total,
        features: orderedFeatures,
        weights: orderedWeights,
        contributions
    };
};

