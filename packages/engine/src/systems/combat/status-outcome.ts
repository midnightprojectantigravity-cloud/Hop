export interface StatusOutcomeInput {
    attackerMind: number;
    defenderMind: number;
    procBase: number;
    potencyBase?: number;
    durationBase: number;
}

export interface StatusOutcomeResult {
    mindRatio: number;
    statusProcChance: number;
    statusPotencyScalar: number;
    statusDuration: number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const calculateStatusOutcome = (input: StatusOutcomeInput): StatusOutcomeResult => {
    const attackerMind = Math.max(0, Number(input.attackerMind || 0));
    const defenderMind = Math.max(1, Number(input.defenderMind || 1));
    const mindRatio = attackerMind / defenderMind;
    const statusProcChance = clamp(Number(input.procBase || 0) * mindRatio, 0, 1);
    const statusPotencyScalar = Math.max(0.25, mindRatio || Number(input.potencyBase || 1) || 0.25);
    const statusDuration = Math.max(1, Math.floor(Math.max(0, Number(input.durationBase || 0)) * statusPotencyScalar));
    return {
        mindRatio,
        statusProcChance,
        statusPotencyScalar,
        statusDuration
    };
};
