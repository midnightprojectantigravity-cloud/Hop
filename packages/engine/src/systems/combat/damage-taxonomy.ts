export type CombatDamageClass = 'physical' | 'magical' | 'true';

export type CombatDamageSubClass =
    | 'melee'
    | 'strike'
    | 'slash'
    | 'piercing'
    | 'shot'
    | 'blast'
    | 'spell'
    | 'touch'
    | 'status'
    | 'neutral';

export type CombatDamageElement =
    | 'neutral'
    | 'fire'
    | 'ice'
    | 'void'
    | 'shadow'
    | 'arcane'
    | 'holy'
    | 'death'
    | 'kinetic'
    | 'poison'
    | 'wet';

export interface CombatDamageTaxonomy {
    damageClass: CombatDamageClass;
    damageSubClass: CombatDamageSubClass;
    damageElement: CombatDamageElement;
}

export type CombatAttackProfile = 'melee' | 'projectile' | 'spell' | 'status';

export interface CombatDamageTaxonomyInput {
    damageClass?: CombatDamageClass;
    damageSubClass?: CombatDamageSubClass;
    damageElement?: CombatDamageElement;
    attackProfile?: CombatAttackProfile;
}

export const DEFAULT_COMBAT_DAMAGE_TAXONOMY: CombatDamageTaxonomy = {
    damageClass: 'physical',
    damageSubClass: 'melee',
    damageElement: 'neutral'
};

export const normalizeCombatDamageTaxonomy = (
    input?: CombatDamageTaxonomyInput
): CombatDamageTaxonomy => {
    const damageClass = input?.damageClass || DEFAULT_COMBAT_DAMAGE_TAXONOMY.damageClass;
    const damageSubClass = input?.damageSubClass
        || (input?.attackProfile === 'projectile'
            ? 'shot'
            : input?.attackProfile === 'spell'
                ? 'blast'
                : input?.attackProfile === 'status'
                    ? 'status'
                    : DEFAULT_COMBAT_DAMAGE_TAXONOMY.damageSubClass);
    const damageElement = input?.damageElement || DEFAULT_COMBAT_DAMAGE_TAXONOMY.damageElement;
    return { damageClass, damageSubClass, damageElement };
};
