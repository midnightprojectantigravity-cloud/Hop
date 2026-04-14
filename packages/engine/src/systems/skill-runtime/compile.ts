import type {
    SkillAuthoringDefinition,
    SkillLibraryMetadata,
    SkillRuntimeDefinition,
    SkillRuntimeMetadataEntry
} from './types';

const PHASE_ORDER = ['declare', 'movement', 'collision', 'resolution', 'cleanup'] as const;

const dedupe = (values: string[] | undefined): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const value of values || []) {
        if (!seen.has(value)) {
            seen.add(value);
            out.push(value);
        }
    }
    return out;
};

export const compileSkillAuthoringDefinition = (
    definition: SkillAuthoringDefinition,
    sourcePath: string
): SkillRuntimeDefinition => {
    const combatScript = [...definition.combatScript].sort((left, right) => {
        const leftIndex = PHASE_ORDER.indexOf(left.phase as typeof PHASE_ORDER[number]);
        const rightIndex = PHASE_ORDER.indexOf(right.phase as typeof PHASE_ORDER[number]);
        if (leftIndex !== rightIndex) return leftIndex - rightIndex;
        return String(left.id || '').localeCompare(String(right.id || ''));
    });

    return {
        ...definition,
        keywords: dedupe(definition.keywords),
        targeting: {
            ...definition.targeting,
            deterministicSort: definition.targeting.deterministicSort || 'distance_then_q_then_r'
        },
        combatScript,
        compiledFrom: 'json',
        sourcePath
    };
};

export const buildSkillRuntimeMetadataEntry = (definition: SkillRuntimeDefinition): SkillRuntimeMetadataEntry => ({
    id: definition.id,
    name: definition.name,
    sourcePath: definition.sourcePath,
    slot: definition.slot,
    keywords: [...definition.keywords],
    targetGenerator: definition.targeting.generator,
    phases: Array.from(new Set(definition.combatScript.map(instruction => instruction.phase))),
    instructionKinds: Array.from(new Set(definition.combatScript.map(instruction => instruction.kind))),
    hasPhysicsPlan: !!definition.physicsPlan,
    handlerRefs: { ...(definition.handlerRefs || {}) }
});

export const buildSkillLibraryMetadata = (
    definitions: SkillRuntimeDefinition[],
    generatedAt: string
): SkillLibraryMetadata => {
    const skills = definitions.map(buildSkillRuntimeMetadataEntry).sort((left, right) => left.id.localeCompare(right.id));
    const presentationHandlerCount = skills.filter(skill => !!skill.handlerRefs.presentation).length;
    const executionHandlerCount = skills.filter(skill => !!skill.handlerRefs.execution).length;
    const targetingHandlerCount = skills.filter(skill => !!skill.handlerRefs.targeting).length;
    const capabilityHandlerCount = skills.filter(skill => !!skill.handlerRefs.capability).length;
    const handlerBackedSkillCount = skills.filter(skill =>
        !!skill.handlerRefs.presentation
        || !!skill.handlerRefs.execution
        || !!skill.handlerRefs.targeting
        || !!skill.handlerRefs.capability
    ).length;
    const totalSkills = skills.length;
    const handlerBudgetRatio = 0.3;
    const handlerRatio = totalSkills === 0 ? 0 : handlerBackedSkillCount / totalSkills;

    return {
        generatedAt,
        totalSkills,
        handlerBackedSkillCount,
        executionHandlerCount,
        capabilityHandlerCount,
        targetingHandlerCount,
        presentationHandlerCount,
        handlerRatio,
        handlerBudgetRatio,
        handlerBudgetExceeded: handlerRatio > handlerBudgetRatio,
        skills
    };
};
