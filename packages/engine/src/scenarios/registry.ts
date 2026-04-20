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
import { corpseExplosionScenarios } from './corpse_explosion';
import { fireballScenarios } from './fireball';
import { firewallScenarios } from './firewall';
import { meteorImpactScenarios } from './meteor_impact';
import { multiShootScenarios } from './multi_shoot';
import { hazardScenarios } from './hazards';
import { falconCommandScenarios } from './falcon_command';
import { kineticTriTrapScenarios } from './kinetic_tri_trap';
import { withdrawalScenarios } from './withdrawal';
import { absorbFireScenarios } from './absorb_fire';
import { bombTossScenarios } from './bomb_toss';
import { tileInteractionScenarios } from './tile_interactions';
import { telegraphProjectionScenarios } from './telegraph_projection';
import { raiderDashScenarios } from './raider_dash';
import { pouncerHookScenarios } from './pouncer_hook';
import { tornadoKickScenarios } from './tornado_kick';
import { iceScenarios } from './ice';
import { snareScenarios } from './snare';
import { relicScenarios } from './relics';
import { objectiveScenarios } from './objectives';
import { necromancerScenarios } from './necromancer';
import { archerShotScenarios } from './archer_shot';
import { acaeScenarios } from './acae';
import { attachmentScenarios } from './attachments';
import { firewalkScenarios } from './firewalk';
import { setTrapScenarios } from './set_trap';
import { timeBombScenarios } from './time_bomb';

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
    corpseExplosionScenarios,
    fireballScenarios,
    firewallScenarios,
    meteorImpactScenarios,
    multiShootScenarios,
    falconCommandScenarios,
    kineticTriTrapScenarios,
    withdrawalScenarios,
    absorbFireScenarios,
    bombTossScenarios,
    tileInteractionScenarios,
    telegraphProjectionScenarios,
    raiderDashScenarios,
    pouncerHookScenarios,
    tornadoKickScenarios,
    iceScenarios,
    firewalkScenarios,
    snareScenarios,
    relicScenarios,
    objectiveScenarios,
    necromancerScenarios,
    archerShotScenarios,
    acaeScenarios,
    attachmentScenarios,
    setTrapScenarios,
    timeBombScenarios,
];

export const ALL_SCENARIOS: TestScenario[] = SCENARIO_COLLECTIONS.flatMap(
    collection => collection.scenarios
);

export const getScenariosBySkill = (skillId: string): TestScenario[] =>
    ALL_SCENARIOS.filter(scenario => scenario.relatedSkills.includes(skillId));

export const getScenariosByCategory = (category: string): TestScenario[] =>
    ALL_SCENARIOS.filter(scenario => scenario.category === category);

export const getTutorialScenarios = (difficulty?: 'beginner' | 'intermediate' | 'advanced'): TestScenario[] => {
    let scenarios = ALL_SCENARIOS.filter(scenario => scenario.isTutorial);
    if (difficulty) {
        scenarios = scenarios.filter(scenario => scenario.difficulty === difficulty);
    }
    return scenarios;
};

export const getScenariosByTags = (tags: string[]): TestScenario[] =>
    ALL_SCENARIOS.filter(scenario => scenario.tags?.some(tag => tags.includes(tag)));

export const getScenarioById = (id: string): TestScenario | undefined =>
    ALL_SCENARIOS.find(scenario => scenario.id === id);

export const toScenarioV2 = (scenario: TestScenario): ScenarioV2 => ({
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    rationale: scenario.rationale,
    setup: scenario.setup,
    run: scenario.run,
    verify: scenario.verify,
});
