import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getHexLine, hexDistance, getNeighbors } from '../hex';
import { getActorAt, getEnemyAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { validateRange, validateAxialDirection, hasClearLineToActor } from '../systems/validation';
import { SKILL_JUICE_SIGNATURES } from '../systems/juice-manifest';

/**
 * Implementation of the Spear Throw skill using the Compositional Skill Framework.
 * Handles both Throwing and Recalling the spear.
 */
export const SPEAR_THROW: SkillDefinition = {
    id: 'SPEAR_THROW',
    name: (state: GameState) => state.hasSpear ? 'Spear Throw' : 'Recall Spear',
    description: (state: GameState) => state.hasSpear
        ? 'Throw your spear to instantly kill an enemy.'
        : 'Recall your spear, damaging enemies in its path.',
    slot: 'offensive',
    icon: '🔱',
    baseVariables: {
        range: 3,
        cost: 0,
        cooldown: 0,
        damage: 1,
    },
    execute: (state: GameState, shooter: Actor, target?: Point, activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        // 1. Upgrade Detection
        const hasRange = activeUpgrades.includes('SPEAR_RANGE');
        const hasRecallDamage = activeUpgrades.includes('RECALL_DAMAGE');
        const hasLunge = activeUpgrades.includes('LUNGE');
        const hasLungeArc = activeUpgrades.includes('LUNGE_ARC');
        const hasDeepBreath = activeUpgrades.includes('DEEP_BREATH');

        const range = 3 + (hasRange ? 1 : 0);

        // 2. Mode Detection: Throw vs Recall
        if (state.hasSpear) {
            // --- THROW MODE ---
            if (!target) return { effects, messages, consumesTurn: false };

            // LUNGE Check
            if (hasLunge && hexDistance(shooter.position, target) === 2) {
                const enemy = getActorAt(state, target);
                if (enemy && enemy.id !== shooter.id) {
                    effects.push({ type: 'Displacement', target: 'self', destination: target, simulatePath: true });
                    effects.push({ type: 'Damage', target: enemy.id, amount: 99 });
                    messages.push(`Lunged and killed ${enemy.subtype || 'enemy'} !`);

                    if (hasLungeArc) {
                        getNeighbors(target).forEach((n: Point) => {
                            const e = getActorAt(state, n);
                            if (e && e.id !== shooter.id && e.id !== enemy.id) {
                                effects.push({ type: 'Damage', target: e.id, amount: 1 });
                            }
                        });
                    }
                    if (hasDeepBreath) {
                        effects.push({ type: 'ModifyCooldown', skillId: 'JUMP', amount: 0, setExact: true });
                    }
                    return { effects, messages };
                }
            }

            if (!validateRange(shooter.position, target, range)) {
                messages.push('Out of range!');
                return { effects, messages, consumesTurn: false };
            }

            const targetEnemy = getEnemyAt(state.enemies, target);
            if (!targetEnemy) {
                messages.push('No enemy at target.');
                return { effects, messages, consumesTurn: false };
            }

            const axial = validateAxialDirection(shooter.position, target);
            if (!axial.isAxial) {
                messages.push('Target must be axial.');
                return { effects, messages, consumesTurn: false };
            }

            const hasClearLos = hasClearLineToActor(state, shooter.position, target, targetEnemy.id, shooter.id);
            if (!hasClearLos) {
                messages.push('No clear line of sight to enemy.');
                return { effects, messages, consumesTurn: false };
            }

            // Standard Throw Logic
            effects.push(...SKILL_JUICE_SIGNATURES.SPEAR_THROW.anticipation(shooter.position, target));
            // We already validated the first obstacle is the enemy at target.

            const hitPos = target;
            const hitEnemy = targetEnemy;

            effects.push(...SKILL_JUICE_SIGNATURES.SPEAR_THROW.execution(getHexLine(shooter.position, hitPos)));

            if (hitEnemy) {
                effects.push(...SKILL_JUICE_SIGNATURES.SPEAR_THROW.impact(hitPos, true));
                effects.push({ type: 'Damage', target: hitEnemy.id, amount: 99 });
                messages.push(`Spear killed ${hitEnemy.subtype || 'enemy'} !`);
                if (hasDeepBreath) {
                    effects.push({ type: 'ModifyCooldown', skillId: 'JUMP', amount: 0, setExact: true });
                }
            } else {
                effects.push(...SKILL_JUICE_SIGNATURES.SPEAR_THROW.impact(hitPos, false));
                messages.push('Spear thrown.');
            }

            // Important: Mark that player no longer has spear, and spawn it
            effects.push({ type: 'SpawnItem', itemType: 'spear', position: hitPos });

        } else {
            // --- RECALL MODE ---
            const spearPos = state.spearPosition;
            if (!spearPos) {
                messages.push('Spear is lost!');
                return { effects, messages, consumesTurn: false };
            }

            const returnLine = getHexLine(spearPos, shooter.position);

            // Path Damage
            if (hasRecallDamage) {
                returnLine.forEach(p => {
                    const enemy = getEnemyAt(state.enemies, p);
                    if (enemy) {
                        effects.push({ type: 'Damage', target: p, amount: 1 });
                        messages.push(`Spear recall hit ${enemy.subtype || 'enemy'} !`);
                    }
                });
            }

            effects.push({ type: 'PickupSpear', position: spearPos });
            messages.push('Spear recalled.');

            // Juice
            effects.push({
                type: 'Juice',
                effect: 'spearTrail',
                path: returnLine,
                intensity: 'medium'
            });
        }

        return { effects, messages };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        if (!state.hasSpear) return []; // Recall doesn't use target selection usually (handled as auto-action on skill use)
        const shooter = getActorAt(state, origin) as Actor | undefined;
        if (!shooter) return [];
        const skill = shooter.activeSkills?.find(s => s.id === 'SPEAR_THROW');
        const hasRange = skill?.activeUpgrades?.includes('SPEAR_RANGE');
        const range = 3 + (hasRange ? 1 : 0);
        const enemies = state.enemies.filter(e => e.hp > 0);

        return enemies.filter(e => {
            const p = e.position;
            const axial = validateAxialDirection(origin, p);
            if (!axial.isAxial) return false;
            if (!validateRange(origin, p, range)) return false;
            return hasClearLineToActor(state, origin, p, e.id, shooter.id);
        }).map(e => e.position);
    },
    upgrades: {
        SPEAR_RANGE: { id: 'SPEAR_RANGE', name: 'Extended Reach', description: 'Range +1' },
        RECALL: { id: 'RECALL', name: 'Recall', description: 'Spear automatically returns (handled internally if active, or via manual recall)' },
        RECALL_DAMAGE: { id: 'RECALL_DAMAGE', name: 'Returning Edge', description: 'Damage enemies in path when recalling spear' },
        LUNGE: { id: 'LUNGE', name: 'Lunge', description: 'If an enemy is exactly 2 hexes away, move to them and kill' },
        LUNGE_ARC: { id: 'LUNGE_ARC', name: 'Lunge Sweeping', description: 'Lunge hits neighbors of the target' },
        DEEP_BREATH: { id: 'DEEP_BREATH', name: 'Deep Breath', description: 'Reset Jump cooldown on spear kill' },
        CLEAVE: { id: 'CLEAVE', name: 'Cleave', description: 'Damage all neighbors when picking up spear' }
    },
    scenarios: getSkillScenarios('SPEAR_THROW')
};
