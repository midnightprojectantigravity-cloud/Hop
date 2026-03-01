import { generateInitialState } from '../../src/logic';
import { DEFAULT_LOADOUTS } from '../../src/systems/loadout';
import type { ArchetypeLoadoutId } from '../../src/systems/evaluation/balance-harness';
import { SkillRegistry } from '../../src/skillRegistry';
import { extractTrinityStats } from '../../src/systems/combat/combat-calculator';
import { computeSparkCostFromTrinity, resolveTrinityLevers } from '../../src/systems/combat/trinity-resolver';

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export interface UpaEntitySnapshot {
    loadoutId: ArchetypeLoadoutId;
    archetype: string;
    trinity: { body: number; mind: number; instinct: number };
    hp: number;
    maxHp: number;
    speed: number;
    skills: string[];
    derived: {
        bodyDamageMultiplier: number;
        bodyMitigation: number;
        mindStatusDurationBonus: number;
        mindMagicMultiplier: number;
        instinctInitiativeBonus: number;
        instinctCriticalMultiplier: number;
        instinctSparkDiscountMultiplier: number;
        sparkCostMove1: number;
        basicAttackBaseDamageEstimate: number;
        basicAttackScaledEstimate: number;
    };
}

export const buildUpaEntitySnapshot = (loadoutId: ArchetypeLoadoutId): UpaEntitySnapshot => {
    const loadout = DEFAULT_LOADOUTS[loadoutId];
    const state = generateInitialState(1, 'upa-snapshot-seed', 'upa-snapshot-seed', undefined, loadout);
    const player = state.player;
    const trinity = extractTrinityStats(player);
    const levers = resolveTrinityLevers(trinity);
    const basicAttackBase = SkillRegistry.get('BASIC_ATTACK')?.intentProfile?.estimates?.damage || 0;

    return {
        loadoutId,
        archetype: String(player.archetype || loadoutId),
        trinity,
        hp: player.hp || 0,
        maxHp: player.maxHp || 0,
        speed: player.speed || 0,
        skills: (player.activeSkills || []).map(s => s.id),
        derived: {
            bodyDamageMultiplier: levers.bodyDamageMultiplier,
            bodyMitigation: levers.bodyMitigation,
            mindStatusDurationBonus: levers.mindStatusDurationBonus,
            mindMagicMultiplier: levers.mindMagicMultiplier,
            instinctInitiativeBonus: levers.instinctInitiativeBonus,
            instinctCriticalMultiplier: levers.instinctCriticalMultiplier,
            instinctSparkDiscountMultiplier: levers.instinctSparkDiscountMultiplier,
            sparkCostMove1: computeSparkCostFromTrinity(1, trinity),
            basicAttackBaseDamageEstimate: basicAttackBase,
            basicAttackScaledEstimate: round3(basicAttackBase * levers.bodyDamageMultiplier),
        },
    };
};
