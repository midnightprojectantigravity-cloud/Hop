import { GENERATED_RUNTIME_SKILLS, GENERATED_RUNTIME_SKILL_LIBRARY_METADATA } from '../../generated/skill-runtime.generated';
import { materializeLegacySkillDefinition, resolveAndExecuteSkillRuntime } from './executor';
import type {
    ResolutionTraceMode,
    SkillLibraryMetadata,
    SkillRuntimeDefinition
} from './types';

const runtimeDefinitions = new Map<string, SkillRuntimeDefinition>();
const legacyDefinitions = new Map<string, ReturnType<typeof materializeLegacySkillDefinition>>();

const registerRuntimeDefinition = (definition: SkillRuntimeDefinition): void => {
    runtimeDefinitions.set(definition.id, definition);
    legacyDefinitions.set(definition.id, materializeLegacySkillDefinition(definition));
};

for (const definition of GENERATED_RUNTIME_SKILLS) {
    registerRuntimeDefinition(definition);
}

export const SkillRuntimeRegistry = {
    get: (id: string): SkillRuntimeDefinition | undefined => runtimeDefinitions.get(id),
    getAll: (): SkillRuntimeDefinition[] => Array.from(runtimeDefinitions.values()),
    getLegacy: (id: string) => legacyDefinitions.get(id),
    getLegacyRegistry: () => Object.fromEntries(Array.from(legacyDefinitions.entries())),
    getMetadata: (): SkillLibraryMetadata => GENERATED_RUNTIME_SKILL_LIBRARY_METADATA,
    resolveAndExecute: (
        id: string,
        ...args: Parameters<typeof resolveAndExecuteSkillRuntime> extends [any, ...infer Rest] ? Rest : never
    ) => {
        const definition = runtimeDefinitions.get(id);
        if (!definition) return undefined;
        return resolveAndExecuteSkillRuntime(definition, ...args);
    },
    register: (definition: SkillRuntimeDefinition): void => {
        registerRuntimeDefinition(definition);
    },
    clearForTests: (): void => {
        runtimeDefinitions.clear();
        legacyDefinitions.clear();
    }
};

export const getRuntimeSkillDefinition = SkillRuntimeRegistry.get;
export const getRuntimeSkillLegacyDefinition = SkillRuntimeRegistry.getLegacy;
export const getRuntimeSkillLegacyRegistry = SkillRuntimeRegistry.getLegacyRegistry;
export const getRuntimeSkillLibraryMetadata = SkillRuntimeRegistry.getMetadata;
export const resolveAndExecuteRuntimeSkillById = (
    id: string,
    state: Parameters<typeof resolveAndExecuteSkillRuntime>[1],
    attacker: Parameters<typeof resolveAndExecuteSkillRuntime>[2],
    target?: Parameters<typeof resolveAndExecuteSkillRuntime>[3],
    activeUpgradeIds?: Parameters<typeof resolveAndExecuteSkillRuntime>[4],
    traceMode?: ResolutionTraceMode
) => SkillRuntimeRegistry.resolveAndExecute(id, state, attacker, target, activeUpgradeIds, traceMode);
