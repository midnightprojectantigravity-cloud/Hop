export interface BaseMagicalDamageInput {
    attackProjection: number;
    defenseProjection: number;
}

const clampNonNegative = (value: number): number => Math.max(0, Number.isFinite(value) ? value : 0);

export const calculateBaseMagicalDamage = (input: BaseMagicalDamageInput): number => {
    const atk = clampNonNegative(input.attackProjection);
    const def = clampNonNegative(input.defenseProjection);
    if (atk <= 0) return 0;
    return (atk * atk) / (atk + def);
};
