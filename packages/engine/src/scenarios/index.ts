import type { ScenarioV2 } from '../types';
import type { TestScenario, ScenarioCollection } from './types';
import { grappleHookScenarios } from './grapple_hook';
import { shieldThrowScenarios } from './shield_throw';
import { autoAttackScenarios } from './auto_attack';
import { integrationScenarios } from './integration';

/**
 * Central registry for all test scenarios
 * This is the single source of truth for automated testing and tutorial generation
 */

// All scenario collections
export const SCENARIO_COLLECTIONS: ScenarioCollection[] = [
    grappleHookScenarios,
    shieldThrowScenarios,
    autoAttackScenarios,
    integrationScenarios,
];

// Flat list of all scenarios for easy iteration
export const ALL_SCENARIOS: TestScenario[] = SCENARIO_COLLECTIONS.flatMap(
    collection => collection.scenarios
);

/**
 * Get all scenarios for a specific skill
 */
export function getScenariosBySkill(skillId: string): TestScenario[] {
    return ALL_SCENARIOS.filter(scenario =>
        scenario.relatedSkills.includes(skillId)
    );
}

/**
 * Get all scenarios by category
 */
export function getScenariosByCategory(category: string): TestScenario[] {
    return ALL_SCENARIOS.filter(scenario =>
        scenario.category === category
    );
}

/**
 * Get all tutorial scenarios, optionally filtered by difficulty
 */
export function getTutorialScenarios(difficulty?: 'beginner' | 'intermediate' | 'advanced'): TestScenario[] {
    let scenarios = ALL_SCENARIOS.filter(scenario => scenario.isTutorial);

    if (difficulty) {
        scenarios = scenarios.filter(scenario => scenario.difficulty === difficulty);
    }

    return scenarios;
}

/**
 * Get scenarios by tags
 */
export function getScenariosByTags(tags: string[]): TestScenario[] {
    return ALL_SCENARIOS.filter(scenario =>
        scenario.tags?.some(tag => tags.includes(tag))
    );
}

/**
 * Get a specific scenario by ID
 */
export function getScenarioById(id: string): TestScenario | undefined {
    return ALL_SCENARIOS.find(scenario => scenario.id === id);
}

import { toScenarioV2 } from './utils';

/**
 * Get all scenarios for a skill in ScenarioV2 format
 * This is used to populate skill definitions
 */
export function getSkillScenarios(skillId: string): ScenarioV2[] {
    return getScenariosBySkill(skillId).map(toScenarioV2);
}
