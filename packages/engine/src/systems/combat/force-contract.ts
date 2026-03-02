export interface ForceContractCoefficients {
    massVelocityWeight: number;
    momentumModifierWeight: number;
    distanceDivisor: number;
}

/**
 * Canonical force equation (D2):
 * force = (mass * velocity * massVelocityWeight) + (momentumModifier * momentumModifierWeight)
 * distance = floor(force / distanceDivisor)
 */
export const FORCE_CONTRACT_V1: ForceContractCoefficients = {
    massVelocityWeight: 1,
    momentumModifierWeight: 1,
    distanceDivisor: 1
};

export const computeCanonicalForce = (
    mass: number,
    velocity: number,
    momentumModifier = 0,
    coefficients: ForceContractCoefficients = FORCE_CONTRACT_V1
): number => {
    const safeMass = Number.isFinite(mass) ? Math.max(0, mass) : 0;
    const safeVelocity = Number.isFinite(velocity) ? Math.max(0, velocity) : 0;
    const safeMomentumModifier = Number.isFinite(momentumModifier) ? momentumModifier : 0;
    return (safeMass * safeVelocity * coefficients.massVelocityWeight)
        + (safeMomentumModifier * coefficients.momentumModifierWeight);
};

export const toCanonicalDistance = (
    forceMagnitude: number,
    maxDistance: number,
    coefficients: ForceContractCoefficients = FORCE_CONTRACT_V1
): number => {
    const divisor = Number.isFinite(coefficients.distanceDivisor) && coefficients.distanceDivisor > 0
        ? coefficients.distanceDivisor
        : 1;
    const normalizedMagnitude = Number.isFinite(forceMagnitude) ? forceMagnitude : 0;
    const distance = Math.floor(normalizedMagnitude / divisor);
    return Math.max(0, Math.min(Math.floor(maxDistance), distance));
};

export const normalizeMomentumBudget = (momentum: number): number => {
    const value = Number.isFinite(momentum) ? momentum : 0;
    return Math.max(0, Math.floor(value));
};
