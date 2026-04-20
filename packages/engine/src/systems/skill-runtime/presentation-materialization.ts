import type { Actor, GameState, Point, SkillDefinition } from '../../types';
import { hexEquals } from '../../hex';
import { buildSkillIntentProfile } from '../skill-intent-profile';
import { getSkillScenarios } from '../../scenarios/skill-scenarios';
import type { ResolvedSkillRuntime, SkillRuntimeDefinition, ResolutionTraceMode } from './types';
import { resolveSkillRuntime } from './resolve';

export const resolveActorAtPoint = (state: GameState, point: Point): Actor | undefined => {
    if (hexEquals(state.player.position, point)) return state.player;
    const enemy = state.enemies.find(candidate => hexEquals(candidate.position, point));
    if (enemy) return enemy;
    return state.companions?.find(candidate => hexEquals(candidate.position, point));
};

export const deriveSkillDefinitionCombatProfile = (definition: SkillRuntimeDefinition): SkillDefinition['combat'] | undefined => {
    if (definition.combat) return definition.combat;
    const damageInstruction = definition.combatScript.find(instruction => instruction.kind === 'DEAL_DAMAGE');
    if (!damageInstruction || damageInstruction.kind !== 'DEAL_DAMAGE') return undefined;

    const attackProfile =
        definition.targeting.generator === 'axial_ray'
            ? 'projectile'
            : definition.targeting.range > 1
                ? 'projectile'
                : 'melee';

    return {
        damageClass: damageInstruction.damageClass || 'physical',
        damageSubClass: damageInstruction.damageSubClass as any,
        damageElement: damageInstruction.damageElement as any,
        attackProfile,
        trackingSignature: attackProfile === 'projectile' ? 'projectile' : 'melee',
        weights: {}
    };
};

const resolveMaterializedPresentationActor = (
    definition: SkillRuntimeDefinition,
    state: GameState
): Actor | undefined => {
    if (state.player?.activeSkills?.some(skill => skill.id === definition.id)) {
        return state.player;
    }
    const enemy = (state.enemies || []).find(candidate =>
        candidate.activeSkills?.some(skill => skill.id === definition.id)
    );
    if (enemy) return enemy;
    return state.companions?.find(candidate =>
        candidate.activeSkills?.some(skill => skill.id === definition.id)
    );
};

export const resolveMaterializedPresentationRuntime = (
    definition: SkillRuntimeDefinition,
    state: GameState
): ResolvedSkillRuntime => {
    const actor = resolveMaterializedPresentationActor(definition, state);
    return resolveSkillRuntime(
        definition,
        actor?.activeSkills.find(skill => skill.id === definition.id)?.activeUpgrades || [],
        'none' as ResolutionTraceMode,
        actor && state.player
            ? {
                state,
                attacker: actor
            }
            : {}
    );
};

export const buildMaterializedSkillScenarios = (definitionId: string) =>
    getSkillScenarios(definitionId);

export const buildMaterializedIntentProfile = (materialized: SkillDefinition) =>
    buildSkillIntentProfile(materialized);
