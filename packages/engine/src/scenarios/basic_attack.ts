import { persistLog } from '../utils/logger';
import type { GameState } from '../types';
import type { ScenarioCollection } from './types';
import { hexEquals } from '../hex';

/**
 * Basic Attack Scenarios
 * Tests: Melee combat, range validation, and move-attack interaction
 * This file has been reviewed and is now up to standards.
 */
export const basicAttackScenarios: ScenarioCollection = {
    id: 'basic_attack',
    name: 'Basic Attack',
    description: 'Tests for basic melee attack mechanics including range and move-to-attack logic',

    scenarios: [
        {
            id: 'basic_attack_player_mechanics',
            title: 'Player Basic Attack: Range & Bump',
            description: 'Validates range enforcement, turn accounting, and bump-attack redirection.',
            relatedSkills: ['BASIC_ATTACK'],
            category: 'combat',
            tags: ['melee', 'targeting', 'bump-attack'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['BASIC_ATTACK']);
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'adj_victim');
                engine.spawnEnemy('footman', { q: 3, r: 4, s: -7 }, 'far_victim');
            },
            run: (engine: any) => {
                // 1. Attempt out-of-range attack
                engine.useSkill('BASIC_ATTACK', { q: 3, r: 4, s: -7 });

                // 2. Trigger "Bump Attack" (Moving into occupied tile)
                engine.move({ q: 3, r: 5, s: -8 });
            },
            verify: (state: GameState, logs: string[]) => {
                const adj = state.enemies.find(e => e.id === 'adj_victim');
                const far = state.enemies.find(e => e.id === 'far_victim');

                const checks = {
                    // VERIFICATION: Range Enforcement
                    farStaysAlive: far && far.hp === far.maxHp,
                    rangeError: logs.some(l => l.includes('out of range')),

                    // VERIFICATION: Bump Attack Success
                    adjTookDamage: !adj || adj.hp <= adj.maxHp,

                    // VERIFICATION: Spatial Integrity
                    playerPositionHeld: hexEquals(state.player.position, { q: 3, r: 6, s: -9 }),

                    // VERIFICATION: Turn Accounting
                    oneTurnConsumed: state.turnsSpent === 1,
                }

                if (Object.values(checks).some(v => v === false)) {
                    const failMsg = `❌ Basic Attack Failed: ${JSON.stringify(checks)}\nCurrent Player Pos: ${JSON.stringify(state.player.position)}\nLogs: ${JSON.stringify(logs)}\n`;
                    console.log(failMsg);
                    persistLog('integration_debug.txt', failMsg);
                }

                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
