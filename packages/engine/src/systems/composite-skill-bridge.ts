import type { CompositeSkillDefinition } from '../data/contracts';
import type { SkillDefinition } from '../types';
import { materializeCompositeSkill } from './composite-skill-factory';

const compositeDefinitions = new Map<string, CompositeSkillDefinition>();
const compositeRuntime = new Map<string, SkillDefinition>();

export const registerCompositeSkillDefinition = (definition: CompositeSkillDefinition): SkillDefinition => {
    const runtimeDef = materializeCompositeSkill(definition);
    compositeDefinitions.set(definition.id, definition);
    compositeRuntime.set(definition.id, runtimeDef);
    return runtimeDef;
};

export const registerCompositeSkillDefinitions = (definitions: CompositeSkillDefinition[]): SkillDefinition[] =>
    definitions.map(registerCompositeSkillDefinition);

export const clearCompositeSkillRegistry = (): void => {
    compositeDefinitions.clear();
    compositeRuntime.clear();
};

export const getCompositeSkillDefinition = (id: string): CompositeSkillDefinition | undefined =>
    compositeDefinitions.get(id);

export const getCompositeSkillRuntimeDefinition = (id: string): SkillDefinition | undefined =>
    compositeRuntime.get(id);

export const getCompositeSkillRuntimeRegistry = (): Record<string, SkillDefinition> => {
    const out: Record<string, SkillDefinition> = {};
    for (const [id, def] of compositeRuntime.entries()) out[id] = def;
    return out;
};

