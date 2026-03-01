export interface TrinityStats {
    body: number;
    mind: number;
    instinct: number;
}

export interface TrinityRuntimeLevers {
    bodyDamageMultiplier: number;
    bodyMitigation: number;
    mindStatusDurationBonus: number;
    mindMagicMultiplier: number;
    instinctInitiativeBonus: number;
    instinctCriticalMultiplier: number;
    instinctSparkDiscountMultiplier: number;
}

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const fibonacci = (index: number): number => {
    if (index <= 0) return 0;
    if (index === 1) return 1;
    let a = 0;
    let b = 1;
    for (let i = 2; i <= index; i++) {
        const n = a + b;
        a = b;
        b = n;
    }
    return b;
};

export const resolveTrinityLevers = (trinity: TrinityStats): TrinityRuntimeLevers => {
    const body = Math.max(0, trinity.body);
    const mind = Math.max(0, trinity.mind);
    const instinct = Math.max(0, trinity.instinct);

    return {
        bodyDamageMultiplier: round3(1 + (body / 20)),
        bodyMitigation: round3(clamp(body * 0.01, 0, 0.5)),
        mindStatusDurationBonus: Math.floor(mind / 15),
        mindMagicMultiplier: round3(1 + (mind / 20)),
        instinctInitiativeBonus: instinct * 2,
        instinctCriticalMultiplier: round3(1 + (clamp(instinct, 0, 10) * 0.02)),
        instinctSparkDiscountMultiplier: round3(1 - clamp(instinct, 0, 100) / 100)
    };
};

export const computeSparkCostFromTrinity = (moveIndex: number, trinity: TrinityStats): number => {
    const base = fibonacci(Math.max(0, moveIndex));
    const levers = resolveTrinityLevers(trinity);
    return round3(base * levers.instinctSparkDiscountMultiplier);
};

export const deriveMaxHpFromTrinity = (trinity: TrinityStats): number => {
    const body = Math.max(0, trinity.body);
    const mind = Math.max(0, trinity.mind);
    const instinct = Math.max(0, trinity.instinct);

    const cfg = { base: 0, body: 5, mind: 2, instinct: 3 };

    const hp = Math.floor(
        (body * cfg.body)
        + (mind * cfg.mind)
        + (instinct * cfg.instinct)
        + cfg.base
    );
    return Math.max(1, hp);
};
