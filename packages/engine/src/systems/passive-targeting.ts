import { hexEquals, pointToKey } from '../hex';
import { SkillRegistry } from '../skillRegistry';
import type { Actor, GameState, Point } from '../types';

export const DEFAULT_PASSIVE_SKILL_PRIORITY = ['BASIC_ATTACK', 'ARCHER_SHOT', 'BASIC_MOVE', 'DASH'] as const;

const resolvePassivePriorityIndex = (skillId: string): number => {
    const index = DEFAULT_PASSIVE_SKILL_PRIORITY.indexOf(skillId as (typeof DEFAULT_PASSIVE_SKILL_PRIORITY)[number]);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
};

export const getOrderedPassiveSkillIds = (actor: Pick<Actor, 'activeSkills'>): string[] => (
    (actor.activeSkills || [])
        .filter(skill => skill.slot === 'passive')
        .map((skill, index) => ({ skillId: skill.id, index }))
        .sort((a, b) => {
            const priorityDelta = resolvePassivePriorityIndex(a.skillId) - resolvePassivePriorityIndex(b.skillId);
            if (priorityDelta !== 0) return priorityDelta;
            return a.index - b.index;
        })
        .map(entry => entry.skillId)
);

export const buildResolvedSkillTargetMap = (
    state: GameState,
    origin: Point,
    orderedSkillIds: ReadonlyArray<string>
): Map<string, string> => {
    const targetMap = new Map<string, string>();

    for (const skillId of orderedSkillIds) {
        const definition = SkillRegistry.get(skillId);
        if (!definition?.getValidTargets) continue;
        const validTargets = definition.getValidTargets(state, origin);
        for (const target of validTargets) {
            const targetKey = pointToKey(target);
            if (!targetMap.has(targetKey)) {
                targetMap.set(targetKey, skillId);
            }
        }
    }

    return targetMap;
};

export const buildPassiveSkillTargetMap = (
    state: GameState,
    actor: Pick<Actor, 'activeSkills'>,
    origin: Point
): Map<string, string> => buildResolvedSkillTargetMap(state, origin, getOrderedPassiveSkillIds(actor));

export const resolvePassiveSkillForTarget = (
    state: GameState,
    actor: Pick<Actor, 'activeSkills'>,
    origin: Point,
    target: Point
): string | undefined => {
    for (const skillId of getOrderedPassiveSkillIds(actor)) {
        const definition = SkillRegistry.get(skillId);
        if (!definition?.getValidTargets) continue;
        const validTargets = definition.getValidTargets(state, origin);
        if (validTargets.some(candidate => hexEquals(candidate, target))) {
            return skillId;
        }
    }

    return undefined;
};
