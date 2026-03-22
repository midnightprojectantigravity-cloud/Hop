export interface InitiativeScoreInput {
    instinct: number;
    mind: number;
    speedModifier?: number;
}

export const calculateInitiativeScore = (input: InitiativeScoreInput): number => {
    const instinct = Math.max(0, Number(input.instinct || 0));
    const mind = Math.max(0, Number(input.mind || 0));
    const speedModifier = Number.isFinite(input.speedModifier) ? Number(input.speedModifier) : 0;
    return (0.7 * instinct) + (0.3 * mind) + speedModifier;
};
