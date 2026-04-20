import type { GameState, SkillDefinition, Actor, Point } from '../../types';
import type { ResolutionTraceMode, SkillRuntimeDefinition, SkillExecutionWithRuntimeResult } from './types';
import {
    buildMaterializedIntentProfile,
    buildMaterializedSkillScenarios,
    deriveSkillDefinitionCombatProfile,
    resolveMaterializedPresentationRuntime
} from './presentation-materialization';
import { materializeSkillDefinitionUpgrades } from './upgrade-materialization';
import { materializeSkillDefinitionCapabilityProviders } from './capability-materialization';

export const buildMaterializedSkillDefinition = (
    definition: SkillRuntimeDefinition,
    execute: (
        state: GameState,
        attacker: Actor,
        target?: Point,
        activeUpgrades?: string[],
        context?: Record<string, any>
    ) => SkillExecutionWithRuntimeResult,
    getValidTargets: (state: GameState, origin: Point) => Point[]
): SkillDefinition => {
    const dynamicPresentation = !!definition.presentationVariants?.length;
    const materialized: SkillDefinition = {
        id: definition.id as any,
        name: dynamicPresentation
            ? ((state: GameState) => resolveMaterializedPresentationRuntime(definition, state).runtime.name)
            : definition.name,
        description: dynamicPresentation
            ? ((state: GameState) => resolveMaterializedPresentationRuntime(definition, state).runtime.description)
            : definition.description,
        slot: definition.slot,
        icon: definition.icon,
        baseVariables: { ...definition.baseVariables },
        combat: deriveSkillDefinitionCombatProfile(definition),
        capabilities: materializeSkillDefinitionCapabilityProviders(definition),
        execute: (state, attacker, target, activeUpgrades = [], context = {}) => {
            const traceMode = (context.traceMode as ResolutionTraceMode | undefined) || 'summary';
            const execution = execute(state, attacker, target, activeUpgrades, context);
            return {
                effects: execution.effects,
                messages: execution.messages,
                consumesTurn: execution.consumesTurn,
                rngConsumption: execution.rngConsumption
            };
        },
        getValidTargets: (state, origin) => getValidTargets(state, origin),
        resourceProfile: definition.resourceProfile,
        metabolicBandProfile: definition.metabolicBandProfile,
        intentProfile: definition.intentProfile,
        summon: definition.summon,
        deathDecalVariant: definition.deathDecalVariant,
        scenarios: buildMaterializedSkillScenarios(definition.id),
        upgrades: materializeSkillDefinitionUpgrades(definition)
    };
    materialized.intentProfile = materialized.intentProfile || buildMaterializedIntentProfile(materialized);
    return materialized;
};
