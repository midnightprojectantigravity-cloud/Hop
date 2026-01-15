import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance } from '../hex';
import { getActorAt } from '../helpers';

/**
 * COMPOSITIONAL SKILL FRAMEWORK
 * Standardized skill definition following Goal 1.
 * Features: Modular definition, Integrated TDD Scenarios.
 */
/**
 * Basic Attack - A targeted melee attack skill.
 * Triggers by clicking on a neighboring hex occupied by an enemy.
 * Can be attached to any entity (player or enemy).
 */
export const BASIC_ATTACK: SkillDefinition = {
    id: 'BASIC_ATTACK',
    name: 'Basic Attack',
    description: 'Strike an adjacent enemy for 1 damage.',
    // Basic attack is a passive/melee interaction (punch) and should not occupy the offensive slot
    slot: 'passive',
    icon: '⚔️',
    baseVariables: {
        range: 1,
        cost: 0,
        cooldown: 0,
        damage: 1,
    },
    execute: (state: GameState, attacker: Actor, target?: Point, activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) {
            messages.push('Select a target!');
            return { effects, messages, consumesTurn: false };
        }

        // Validate range
        const dist = hexDistance(attacker.position, target);
        let range = 1;
        if (activeUpgrades.includes('EXTENDED_REACH')) range += 1;

        if (dist > range || dist < 1) {
            messages.push('Target out of range!');
            return { effects, messages, consumesTurn: false };
        }

        // Find entity at target
        const targetActor = getActorAt(state, target);
        if (!targetActor || targetActor.id === attacker.id) {
            messages.push('No enemy at target!');
            return { effects, messages, consumesTurn: false };
        }

        // Calculate damage
        let damage = 1;
        if (activeUpgrades.includes('POWER_STRIKE')) damage += 1;

        // Apply damage
        effects.push({ type: 'Damage', target: 'targetActor', amount: damage });
        const attackerName = attacker.type === 'player' ? 'You' : (attacker.subtype || 'Enemy');
        const targetName = targetActor.type === 'player' ? 'you' : (targetActor.subtype || 'enemy');
        messages.push(`${attackerName} attacked ${targetName}!`);

        // Vampiric upgrade: heal on kill (TODO: Add Heal effect type when implemented)
        if (activeUpgrades.includes('VAMPIRIC') && targetActor.hp <= damage) {
            messages.push('Vampiric heal!');
        }

        return { effects, messages, consumesTurn: true };
    },
    upgrades: {
        EXTENDED_REACH: {
            id: 'EXTENDED_REACH',
            name: 'Extended Reach',
            description: 'Attack range +1'
        },
        POWER_STRIKE: {
            id: 'POWER_STRIKE',
            name: 'Power Strike',
            description: 'Damage +1'
        },
        VAMPIRIC: {
            id: 'VAMPIRIC',
            name: 'Vampiric',
            description: 'Heal 1 HP on kill'
        },
    },
    scenarios: [
        {
            id: 'basic_attack_kill',
            title: 'Basic Attack Kill',
            description: 'Attack and kill an adjacent enemy.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['BASIC_ATTACK']);
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'victim');
            },
            run: (engine: any) => {
                engine.useSkill('BASIC_ATTACK', { q: 3, r: 5, s: -8 });
            },
            verify: (state: GameState, logs: string[]) => {
                const enemyDead = !state.enemies.find(e => e.id === 'victim') ||
                    (state.enemies.find(e => e.id === 'victim')?.hp ?? 0) <= 0;
                const hitMessage = logs.some(l => l.includes('attacked'));
                return enemyDead && hitMessage;
            }
        },
        {
            id: 'basic_attack_out_of_range',
            title: 'Basic Attack Out of Range',
            description: 'Cannot attack enemy that is too far.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['BASIC_ATTACK']);
                engine.spawnEnemy('footman', { q: 3, r: 4, s: -7 }, 'distant');
            },
            run: (engine: any) => {
                engine.useSkill('BASIC_ATTACK', { q: 3, r: 4, s: -7 });
            },
            verify: (state: GameState, logs: string[]) => {
                const enemy = state.enemies.find(e => e.id === 'distant');
                const enemyAlive = enemy && enemy.hp === 1;
                const rangeMessage = logs.some(l => l.includes('out of range'));
                return !!enemyAlive && rangeMessage;
            }
        },
        {
            id: 'basic_attack_via_move',
            title: 'Basic Attack via Move',
            description: 'Triggers when moving into an occupied tile.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['BASIC_ATTACK']);
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'victim');
            },
            run: (engine: any) => {
                // Click on the enemy hex while in "move" mode
                engine.move({ q: 3, r: 5, s: -8 });
            },
            verify: (state: GameState, logs: string[]) => {
                const enemyDead = !state.enemies.find(e => e.id === 'victim');
                const hitMessage = logs.some(l => l.includes('attacked'));
                return enemyDead && hitMessage;
            }
        },
        {
            id: 'enemy_basic_attack',
            title: 'Enemy Basic Attack',
            description: 'Verify enemies use BASIC_ATTACK skill.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, []);
                // Spawn enemy with BASIC_ATTACK intent
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'attacker');
                // Force intent
                const attacker = engine.state.enemies.find((e: any) => e.id === 'attacker');
                attacker.intent = 'BASIC_ATTACK';
                attacker.intentPosition = { q: 3, r: 6, s: -9 };
                // Ensure enemy has the skill
                if (!attacker.activeSkills) attacker.activeSkills = [];
                attacker.activeSkills.push({
                    id: 'BASIC_ATTACK',
                    name: 'Basic Attack',
                    description: 'Melee attack',
                    slot: 'offensive',
                    cooldown: 0,
                    currentCooldown: 0,
                    range: 1,
                    activeUpgrades: []
                });
            },
            run: (engine: any) => {
                // Wait for the enemy to resolve its telegraphed attack
                engine.wait();
            },
            verify: (state: GameState, logs: string[]) => {
                // Player should have taken 1 damage (HP 3 -> 2)
                const playerDamaged = state.player.hp === 2;
                const hitMessage = logs.some(l => l.includes('attacked you')); // BASIC_ATTACK message
                return playerDamaged && hitMessage;
            }
        }
    ]
};
