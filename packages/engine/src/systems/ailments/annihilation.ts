import type { AilmentDefinition } from '../../data/ailments';
import type { AilmentID } from '../../types/registry';
import type { AilmentAnnihilationDelta, AilmentAnnihilationResult } from './types';

const getCounter = (counters: Partial<Record<AilmentID, number>>, id: AilmentID): number => {
    return Math.max(0, Math.floor(counters[id] || 0));
};

const setCounter = (
    counters: Partial<Record<AilmentID, number>>,
    id: AilmentID,
    value: number
): Partial<Record<AilmentID, number>> => {
    const next = { ...counters };
    if (value <= 0) {
        delete next[id];
        return next;
    }
    next[id] = Math.floor(value);
    return next;
};

export const resolveAilmentAnnihilation = (
    incomingDefinition: AilmentDefinition,
    existingCounters: Partial<Record<AilmentID, number>>,
    incomingAmount: number
): AilmentAnnihilationResult => {
    let remainingIncoming = Math.max(0, Math.floor(incomingAmount));
    let counters = { ...existingCounters };
    const deltas: AilmentAnnihilationDelta[] = [];

    const interactions = [...(incomingDefinition.interactions || [])]
        .sort((a, b) => (b.priority - a.priority) || a.target.localeCompare(b.target));

    for (const interaction of interactions) {
        if (remainingIncoming <= 0) break;
        const opposingCount = getCounter(counters, interaction.target);
        if (opposingCount <= 0) continue;
        const ratio = Math.max(0.0001, interaction.ratio);
        const maxIncomingNeutralized = opposingCount * ratio;
        const incomingNeutralized = Math.min(remainingIncoming, maxIncomingNeutralized);
        if (incomingNeutralized <= 0) continue;
        const opposingConsumed = Math.min(opposingCount, Math.ceil(incomingNeutralized / ratio));
        const opposingRemaining = Math.max(0, opposingCount - opposingConsumed);
        counters = setCounter(counters, interaction.target, opposingRemaining);
        remainingIncoming = Math.max(0, remainingIncoming - incomingNeutralized);
        deltas.push({
            incoming: incomingDefinition.id,
            against: interaction.target,
            incomingNeutralized: Math.floor(incomingNeutralized),
            opposingConsumed,
            ratio
        });
    }

    counters = setCounter(counters, incomingDefinition.id, getCounter(counters, incomingDefinition.id) + remainingIncoming);
    return {
        counters,
        deposited: remainingIncoming,
        deltas
    };
};

