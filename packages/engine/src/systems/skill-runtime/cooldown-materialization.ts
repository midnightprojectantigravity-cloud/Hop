import type { AtomicEffect } from '../../types';

export const materializeModifyCooldownInstruction = (
    instruction: { skillId: string; amount: number; setExact?: boolean }
): AtomicEffect[] => [{
    type: 'ModifyCooldown',
    skillId: instruction.skillId as any,
    amount: instruction.amount,
    setExact: instruction.setExact
}];
