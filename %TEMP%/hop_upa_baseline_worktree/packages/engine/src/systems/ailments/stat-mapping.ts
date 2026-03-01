import type { Actor } from '../../types';
import type { AilmentStatRef } from '../../data/ailments';
import { extractTrinityStats } from '../combat/combat-calculator';

const toCanonicalRef = (ref: AilmentStatRef): 'body' | 'mind' | 'instinct' => {
    switch (ref) {
    case 'body':
    case 'vit':
        return 'body';
    case 'mind':
    case 'int':
    case 'wis':
    case 'resolve':
        return 'mind';
    case 'instinct':
    case 'dex':
    case 'agi':
        return 'instinct';
    default:
        return 'mind';
    }
};

export const resolveAilmentStatValue = (actor: Actor, ref: AilmentStatRef): number => {
    const trinity = extractTrinityStats(actor);
    const canonical = toCanonicalRef(ref);
    if (canonical === 'body') return trinity.body;
    if (canonical === 'mind') return trinity.mind;
    return trinity.instinct;
};

