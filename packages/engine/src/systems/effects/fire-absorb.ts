export const isAbsorbableFireDamage = (damageElement?: string): boolean =>
    damageElement === 'fire';

export const resolveAbsorbFireHealAmount = (incomingDamage: number, bonusHeal = 0): number => {
    if (incomingDamage <= 0) return 0;
    return Math.max(1, Math.ceil(incomingDamage * 0.1)) + Math.max(0, Math.floor(bonusHeal));
};
