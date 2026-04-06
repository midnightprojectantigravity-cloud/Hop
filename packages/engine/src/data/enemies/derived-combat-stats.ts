import {
    deriveMaxHpFromTrinity,
    resolveTrinityLevers,
    type TrinityStats
} from '../../systems/combat/trinity-resolver';
import { calculateBaseMagicalDamage } from '../../systems/combat/base-magical-damage';
import { calculateBasePhysicalDamage } from '../../systems/combat/base-physical-damage';
import {
    COMBAT_MOVEMENT_BURST_SKILL_IDS,
    COMBAT_TELEGRAPH_SKILL_IDS,
    COMBAT_TUNING_VARIABLES,
    evaluateCombatNumericFormula,
    resolveCombatSkillProfile
} from '../combat-tuning-ledger';
import type {
    bestiaryEnemyType,
    bestiaryWeightClass,
    EnemyBestiaryDefinition,
} from '../packs/mvp-enemy-content';

export interface EnemyCombatSkillLoadout {
    base: string[];
    passive: string[];
}

export interface EnemyBestiaryStatDerivationInput {
    trinity: TrinityStats;
    bestiarySkills: EnemyCombatSkillLoadout;
    runtimeSkills: EnemyCombatSkillLoadout;
    cost: number;
    weightClass: bestiaryWeightClass;
}

interface SkillCombatSignature {
    skillId: string;
    threatRange: number;
    representativeDamage: number;
    requiresContact: boolean;
    isDamaging: boolean;
    intentTags: string[];
}

const DERIVED_SKILL_COMBAT_ROWS: Record<string, {
    basePower: number;
    damageMultiplier: number;
    attackProfile: 'melee' | 'projectile' | 'spell' | 'status';
    trackingSignature: 'melee' | 'projectile' | 'magic';
    weights: { body: number; mind: number; instinct: number };
}> = {
    BASIC_ATTACK: { basePower: 0, damageMultiplier: 1, attackProfile: 'melee', trackingSignature: 'melee', weights: { body: 1, mind: 0, instinct: 0 } },
    AUTO_ATTACK: { basePower: 0, damageMultiplier: 1, attackProfile: 'melee', trackingSignature: 'melee', weights: { body: 1, mind: 0, instinct: 0 } },
    DASH: { basePower: 1, damageMultiplier: 1, attackProfile: 'melee', trackingSignature: 'melee', weights: { body: 0, mind: 0, instinct: 1 } },
    GRAPPLE_HOOK: { basePower: 1, damageMultiplier: 1, attackProfile: 'melee', trackingSignature: 'melee', weights: { body: 0, mind: 0, instinct: 1 } },
    SHIELD_BASH: { basePower: 1, damageMultiplier: 1, attackProfile: 'melee', trackingSignature: 'melee', weights: { body: 1, mind: 0, instinct: 0 } },
    ARCHER_SHOT: { basePower: 0, damageMultiplier: 1, attackProfile: 'projectile', trackingSignature: 'projectile', weights: { body: 0, mind: 0, instinct: 1 } },
    BOMB_TOSS: { basePower: 1, damageMultiplier: 1, attackProfile: 'projectile', trackingSignature: 'projectile', weights: { body: 0, mind: 0, instinct: 1 } },
    FIREBALL: { basePower: 10, damageMultiplier: 1, attackProfile: 'spell', trackingSignature: 'magic', weights: { body: 0, mind: 1, instinct: 0 } },
    SENTINEL_BLAST: { basePower: 2, damageMultiplier: 1, attackProfile: 'spell', trackingSignature: 'magic', weights: { body: 0, mind: 1, instinct: 0 } },
    SENTINEL_TELEGRAPH: { basePower: 0, damageMultiplier: 0, attackProfile: 'status', trackingSignature: 'magic', weights: { body: 0, mind: 0, instinct: 0 } }
};

const resolveSkillCombatWeights = (skillId: string): { body: number; mind: number; instinct: number } => {
    const row = DERIVED_SKILL_COMBAT_ROWS[skillId];
    if (row?.weights) {
        return {
            body: Number(row.weights.body ?? 0),
            mind: Number(row.weights.mind ?? 0),
            instinct: Number(row.weights.instinct ?? 0)
        };
    }
    const profile = resolveCombatSkillProfile(skillId);
    if (profile.attackProfile === 'projectile') {
        return { body: 0, mind: 0, instinct: 1 };
    }
    if (profile.attackProfile === 'spell') {
        return { body: 0, mind: 1, instinct: 0 };
    }
    return { body: 1, mind: 0, instinct: 0 };
};

const uniqueSkillIds = (...skillGroups: EnemyCombatSkillLoadout[]): string[] =>
    Array.from(new Set(
        skillGroups.flatMap(group => [...group.base, ...group.passive].filter(Boolean))
    ));

const toSkillCombatSignature = (
    skillId: string,
    trinity: TrinityStats
): SkillCombatSignature => {
    const profile = resolveCombatSkillProfile(skillId);
    const levers = resolveTrinityLevers(trinity, undefined, skillId);
    const threatRange = evaluateCombatNumericFormula(profile.threatRange, trinity);
    const intentTags = profile.intentTags;
    const combatRow = DERIVED_SKILL_COMBAT_ROWS[skillId];
    const skillDamageMultiplier = Number(combatRow?.damageMultiplier ?? 1);
    const basePower = Number(combatRow?.basePower ?? 0);
    const weights = resolveSkillCombatWeights(skillId);
    const attackProjection = (basePower * levers.basePowerMultiplier)
        + ((Math.max(0, trinity.body) * levers.bodyDamageMultiplier * skillDamageMultiplier * weights.body)
        + (Math.max(0, trinity.mind) * levers.mindDamageMultiplier * skillDamageMultiplier * weights.mind)
        + (Math.max(0, trinity.instinct) * levers.instinctDamageMultiplier * skillDamageMultiplier * weights.instinct));
    const damageClass = (combatRow?.attackProfile === 'spell' ? 'magical' : profile.damageClass) || 'physical';
    const representativeDamage = damageClass === 'magical'
        ? calculateBaseMagicalDamage({ attackProjection, defenseProjection: 0 })
        : calculateBasePhysicalDamage({ attackProjection, defenseProjection: 0 });
    const isDamaging = representativeDamage > 0 && intentTags.includes('damage');

    return {
        skillId,
        threatRange,
        representativeDamage,
        requiresContact: profile.requiresContact ?? threatRange <= 1,
        isDamaging,
        intentTags
    };
};

const resolveEnemyTypeFromSignatures = (
    trinity: TrinityStats,
    signatures: SkillCombatSignature[]
): bestiaryEnemyType => {
    const trinityTotal = trinity.body + trinity.mind + trinity.instinct;
    if (trinityTotal >= COMBAT_TUNING_VARIABLES.enemyCombat.bossTrinityTotalThreshold) {
        return 'boss';
    }
    const hasNonContactRangedPressure = signatures.some(signature =>
        signature.isDamaging && signature.threatRange > 1 && !signature.requiresContact
    );
    return hasNonContactRangedPressure ? 'ranged' : 'melee';
};

export const deriveEnemyBestiaryStats = (
    input: EnemyBestiaryStatDerivationInput
): EnemyBestiaryDefinition['stats'] => {
    const skillIds = uniqueSkillIds(input.bestiarySkills, input.runtimeSkills);
    const signatures = skillIds.map(skillId => toSkillCombatSignature(skillId, input.trinity));
    const derivedHp = deriveMaxHpFromTrinity(input.trinity);
    const type = resolveEnemyTypeFromSignatures(input.trinity, signatures);
    const range = Math.max(
        1,
        ...signatures
            .filter(signature =>
                signature.isDamaging
                || signature.intentTags.includes('control')
                || signature.intentTags.includes('hazard')
            )
            .map(signature => signature.threatRange)
    );
    const damage = Math.max(1, ...signatures.filter(signature => signature.isDamaging).map(signature => signature.representativeDamage));
    const highInstinct = input.trinity.instinct >= COMBAT_TUNING_VARIABLES.enemyCombat.highInstinctThreshold;
    const hasMobilityBurstSkill = skillIds.some(skillId => COMBAT_MOVEMENT_BURST_SKILL_IDS.has(skillId));
    const speed = highInstinct && (hasMobilityBurstSkill || (type !== 'boss' && range <= 1))
        ? COMBAT_TUNING_VARIABLES.enemyCombat.boostedSpeed
        : COMBAT_TUNING_VARIABLES.enemyCombat.baseSpeed;
    const hasHazardPressure = signatures.some(signature => signature.intentTags.includes('hazard'));
    const hasTelegraphPlaylist = skillIds.some(skillId => COMBAT_TELEGRAPH_SKILL_IDS.has(skillId))
        && skillIds.includes('SENTINEL_TELEGRAPH')
        && skillIds.includes('SENTINEL_BLAST');
    const actionCooldown = (type === 'boss' || hasTelegraphPlaylist)
        ? COMBAT_TUNING_VARIABLES.enemyCombat.bossActionCooldown
        : speed >= COMBAT_TUNING_VARIABLES.enemyCombat.boostedSpeed
            ? 1
            : (hasHazardPressure && range >= 3 ? COMBAT_TUNING_VARIABLES.enemyCombat.hazardActionCooldown : COMBAT_TUNING_VARIABLES.enemyCombat.baseActionCooldown);

    return {
        hp: derivedHp,
        maxHp: derivedHp,
        range,
        damage,
        type,
        cost: input.cost,
        actionCooldown,
        weightClass: input.weightClass,
        speed
    };
};
