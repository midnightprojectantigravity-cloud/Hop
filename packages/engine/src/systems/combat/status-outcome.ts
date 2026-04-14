import { resolveCombatTuning } from '../../data/combat-tuning-ledger';
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
    const tuning = resolveCombatTuning();
    const attackerMind = Math.max(0, Number(input.attackerMind || 0));
    const defenderMind = Math.max(1, Number(input.defenderMind || 1));
    const mindRatio = attackerMind / defenderMind;
    const statusProcChance = clamp(Number(input.procBase || 0) * mindRatio, tuning.status.minProcChance, 1);
    const statusPotencyScalar = Math.max(tuning.status.minPotencyScalar, mindRatio || Number(input.potencyBase || 1) || tuning.status.minPotencyScalar);
    const statusDuration = Math.max(tuning.status.minDuration, Math.floor(Math.max(0, Number(input.durationBase || 0)) * statusPotencyScalar));
    return {
        mindRatio,
        statusProcChance,
        statusPotencyScalar,
        statusDuration
    };
};
