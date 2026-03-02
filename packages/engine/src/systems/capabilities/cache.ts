import type { Actor, GameState, SkillDefinition } from '../../types';
import type {
    CompiledCapabilityBundle,
    CompiledInformationProvider,
    CompiledMovementProvider,
    CompiledSenseProvider
} from './types';
import { compareCompiledProviders } from './resolver';

let perStateCache = new WeakMap<GameState, Map<string, CompiledCapabilityBundle>>();
let compileCount = 0;
let resolveSkillDefinitionById: ((skillId: string) => SkillDefinition | undefined) | undefined;

const EMPTY_BUNDLE: CompiledCapabilityBundle = {
    senses: [],
    information: [],
    movement: []
};

const cloneBundle = (bundle: CompiledCapabilityBundle): CompiledCapabilityBundle => ({
    senses: [...bundle.senses],
    information: [...bundle.information],
    movement: [...bundle.movement]
});

const compileActorCapabilities = (actor: Actor): CompiledCapabilityBundle => {
    compileCount += 1;
    if (!resolveSkillDefinitionById) return EMPTY_BUNDLE;

    const senses: CompiledSenseProvider[] = [];
    const information: CompiledInformationProvider[] = [];
    const movement: CompiledMovementProvider[] = [];

    for (const skill of actor.activeSkills || []) {
        const skillDef = resolveSkillDefinitionById(skill.id);
        if (!skillDef || skillDef.slot !== 'passive') continue;
        const capabilitySet = skillDef.capabilities;
        if (!capabilitySet) continue;

        for (const provider of capabilitySet.senses || []) {
            senses.push({
                skillId: skill.id,
                providerId: provider.providerId,
                priority: provider.priority,
                provider
            });
        }

        for (const provider of capabilitySet.information || []) {
            information.push({
                skillId: skill.id,
                providerId: provider.providerId,
                priority: provider.priority,
                provider
            });
        }

        for (const provider of capabilitySet.movement || []) {
            movement.push({
                skillId: skill.id,
                providerId: provider.providerId,
                priority: provider.priority,
                resolutionMode: provider.resolutionMode,
                provider
            });
        }
    }

    senses.sort(compareCompiledProviders);
    information.sort(compareCompiledProviders);
    movement.sort(compareCompiledProviders);

    return { senses, information, movement };
};

const getStateActorCache = (state: GameState): Map<string, CompiledCapabilityBundle> => {
    const existing = perStateCache.get(state);
    if (existing) return existing;
    const created = new Map<string, CompiledCapabilityBundle>();
    perStateCache.set(state, created);
    return created;
};

export const registerCapabilitySkillDefinitionResolver = (
    resolver: (skillId: string) => SkillDefinition | undefined
): void => {
    resolveSkillDefinitionById = resolver;
};

export const getCompiledCapabilityBundleForActor = (
    state: GameState,
    actor: Actor
): CompiledCapabilityBundle => {
    const actorCache = getStateActorCache(state);
    const existing = actorCache.get(actor.id);
    if (existing) return existing;

    const compiled = compileActorCapabilities(actor);
    actorCache.set(actor.id, compiled);
    return compiled;
};

export const clearCapabilityStateCacheForTests = (): void => {
    perStateCache = new WeakMap<GameState, Map<string, CompiledCapabilityBundle>>();
    compileCount = 0;
};

export const getCapabilityCompileCountForTests = (): number => compileCount;

export const cloneCompiledBundleForTests = (bundle: CompiledCapabilityBundle): CompiledCapabilityBundle =>
    cloneBundle(bundle);
