import type { ScenarioV2 } from '../types';
import type { TestScenario, ScenarioCollection } from './types';
import { grappleHookScenarios } from './grapple_hook';
import { shieldThrowScenarios } from './shield_throw';
import { autoAttackScenarios } from './auto_attack';
import { integrationScenarios } from './integration';
import { basicAttackScenarios } from './basic_attack';
import { spearThrowScenarios } from './spear_throw';
import { dashScenarios } from './dash';
import { jumpScenarios } from './jump';
import { shieldBashScenarios } from './shield_bash';
import { bulwarkChargeScenarios } from './bulwark_charge';
import { vaultScenarios } from './vault';
import { basicMoveScenarios } from './basic_move';
import { sentinelBlastScenarios } from './sentinel_blast';
import { fireballScenarios } from './fireball';
import { hazardScenarios } from './hazards';
import { falconCommandScenarios } from './falcon_command';
import { kineticTriTrapScenarios } from './kinetic_tri_trap';
import { withdrawalScenarios } from './withdrawal';
import { absorbFireScenarios } from './absorb_fire';
import { tileInteractionScenarios } from './tile_interactions';
import { telegraphProjectionScenarios } from './telegraph_projection';
import { raiderDashScenarios } from './raider_dash';
import { pouncerHookScenarios } from './pouncer_hook';
import { iceScenarios } from './ice';
import { snareScenarios } from './snare';
import { relicScenarios } from './relics';
import { objectiveScenarios } from './objectives';
import { necromancerScenarios } from './necromancer';
import { archerShotScenarios } from './archer_shot';

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
    basicAttackScenarios,
    spearThrowScenarios,
    dashScenarios,
    jumpScenarios,
    shieldBashScenarios,
    bulwarkChargeScenarios,
    vaultScenarios,
    hazardScenarios,
    basicMoveScenarios,
    sentinelBlastScenarios,
    fireballScenarios,
    falconCommandScenarios,
    kineticTriTrapScenarios,
    withdrawalScenarios,
    absorbFireScenarios,
    tileInteractionScenarios,
    telegraphProjectionScenarios,
    raiderDashScenarios,
    pouncerHookScenarios,
    iceScenarios,
    snareScenarios,
    relicScenarios,
    objectiveScenarios,
    necromancerScenarios,
    archerShotScenarios,
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
