import type { SkillDefinition, GameState } from '../types';

import { getSkillScenarios } from '../scenarios';

/**
 * THEME HAZARD SCENARIOS
 * This is a "Dummy Skill" used to register scenarios for testing floor hazards
 * like Slippery Tiles and Void Tiles.
 */
export const THEME_HAZARDS: SkillDefinition = {
    id: 'THEME_HAZARDS',
    name: 'Theme Hazards',
    description: 'Internal skill for testing floor themes.',
    slot: 'passive',
    icon: '🧊',
    baseVariables: {
        range: 0,
        cost: 0,
        cooldown: 0,
    },
    execute: (_state: GameState) => {
        return { effects: [], messages: [] };
    },
    upgrades: {},
    scenarios: getSkillScenarios('THEME_HAZARDS')
};
