import type { ScenarioV2 } from '../types';
import { getScenariosBySkill, toScenarioV2 } from './registry';

export function getSkillScenarios(skillId: string): ScenarioV2[] {
    return getScenariosBySkill(skillId).map(toScenarioV2);
}
