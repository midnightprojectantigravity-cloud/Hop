/**
 * LEGACY SKILL SYSTEM (DEPRECATED)
 * This file contains legacy implementations of Spear, Shield, and Jump.
 * NEW DEVELOPMENT should happen in src/game/skills/ as individual SkillDefinitions.
 * TODO: Fully evacuate this file and delete it.
 */
import type { GameState, Entity, Point, Skill } from '../types';
import { hexDistance, hexEquals, getNeighbors, hexDirection, hexAdd, getHexLine, pointToKey } from '../hex';
import { UnifiedTileService } from './unified-tile-service';
import { addStatus } from './actor';
import { COMPOSITIONAL_SKILLS } from '../skillRegistry';

// ============================================================================
// SKILL DEFINITIONS
// ============================================================================

export const SKILL_DEFINITIONS: Record<string, Omit<Skill, 'currentCooldown' | 'activeUpgrades'>> = {
    // Offensive: Spear Throw
    SPEAR_THROW: {
        id: 'SPEAR_THROW',
        name: 'Spear Throw',
        description: 'Throw your spear to instantly kill an enemy. Retrieve to use again.',
        slot: 'offensive',
        cooldown: 0, // Special: disabled until picked up
        range: 2,
        upgrades: ['SPEAR_RANGE', 'RECALL', 'RECALL_DAMAGE', 'LUNGE', 'LUNGE_ARC', 'DEEP_BREATH', 'CLEAVE'],
    },

    // Defensive: Shield Bash
    SHIELD_BASH: {
        id: 'SHIELD_BASH',
        name: 'Shield Bash',
        description: 'Push an enemy 1 tile. If they hit a wall or another enemy, they are stunned.',
        slot: 'defensive',
        cooldown: 2,
        range: 1,
        pushDistance: 1,
        upgrades: ['SHIELD_RANGE', 'SHIELD_COOLDOWN', 'ARC_BASH', 'BASH_360', 'PASSIVE_PROTECTION', 'WALL_SLAM'],
    },

    // Utility: Jump
    JUMP: {
        id: 'JUMP',
        name: 'Jump',
        description: 'Leap to an empty tile within range. Can cross lava but not walls.',
        slot: 'utility',
        cooldown: 2,
        range: 2,
        upgrades: ['JUMP_RANGE', 'JUMP_COOLDOWN', 'STUNNING_LANDING', 'METEOR_IMPACT', 'FREE_JUMP'],
    },
};

// ============================================================================
// UPGRADE DEFINITIONS
// ============================================================================

export const UPGRADE_DEFINITIONS: Record<string, { name: string; description: string; skill: string }> = {
    // Spear upgrades
    SPEAR_RANGE: { name: 'Extended Reach', description: 'Spear range +1', skill: 'SPEAR_THROW' },
    RECALL: { name: 'Recall', description: 'Spear automatically returns after throwing', skill: 'SPEAR_THROW' },
    RECALL_DAMAGE: { name: 'Damaging Recall', description: 'Spear damages enemies on return path (costs a turn)', skill: 'SPEAR_THROW' },
    LUNGE: { name: 'Lunge', description: 'Move toward enemy 2 tiles away for a kill (spear in hand)', skill: 'SPEAR_THROW' },
    LUNGE_ARC: { name: 'Arc Lunge', description: 'Lunge hits 3 enemies in an arc', skill: 'SPEAR_THROW' },
    DEEP_BREATH: { name: 'Deep Breath', description: 'Killing with spear/lunge resets Jump cooldown', skill: 'SPEAR_THROW' },
    CLEAVE: { name: 'Cleave', description: 'Picking up spear hits all adjacent enemies', skill: 'SPEAR_THROW' },

    // Shield upgrades
    SHIELD_RANGE: { name: 'Extended Bash', description: 'Shield bash range +1', skill: 'SHIELD_BASH' },
    SHIELD_COOLDOWN: { name: 'Quick Recovery', description: 'Shield bash cooldown -1', skill: 'SHIELD_BASH' },
    ARC_BASH: { name: 'Arc Bash', description: 'Bash hits 3-hex frontal arc (+1 cooldown)', skill: 'SHIELD_BASH' },
    BASH_360: { name: '360° Bash', description: 'Bash hits all neighbors (+1 cooldown)', skill: 'SHIELD_BASH' },
    PASSIVE_PROTECTION: { name: 'Passive Protection', description: '+1 temp armor when shield not on cooldown', skill: 'SHIELD_BASH' },
    WALL_SLAM: { name: 'Wall Slam', description: 'Enemies bashed into walls/enemies are stunned', skill: 'SHIELD_BASH' },
    // Jump upgrades
    JUMP_RANGE: { name: 'Extended Jump', description: 'Jump range +1', skill: 'JUMP' },
    JUMP_COOLDOWN: { name: 'Nimble', description: 'Jump cooldown -1', skill: 'JUMP' },
    STUNNING_LANDING: { name: 'Stunning Landing', description: 'All enemies within 1 hex of landing are stunned', skill: 'JUMP' },
    METEOR_IMPACT: { name: 'Meteor Impact', description: 'Can land on enemies to kill them', skill: 'JUMP' },
    FREE_JUMP: { name: 'Free Jump', description: 'Can move after jumping', skill: 'JUMP' },
};

/**
 * Reset and apply passive skill effects (like temporary armor)
 */
export const applyPassiveSkills = (player: Entity): Entity => {
    let updatedPlayer = { ...player, temporaryArmor: 0 };

    // Shield: Passive Protection (+1 armor if not on cooldown)
    const shield = player.activeSkills?.find(s => s.id === 'SHIELD_BASH');
    if (shield && shield.currentCooldown === 0 && hasUpgrade(player, 'SHIELD_BASH', 'PASSIVE_PROTECTION')) {
        updatedPlayer.temporaryArmor = (updatedPlayer.temporaryArmor || 0) + 1;
    }

    return updatedPlayer;
};

// ============================================================================
// SKILL CREATION & MANAGEMENT
// ============================================================================

export const createSkill = (skillId: string): Skill | null => {
    // Try compositional first
    const compDef = COMPOSITIONAL_SKILLS[skillId];
    if (compDef) {
        return {
            id: compDef.id,
            name: compDef.name,
            description: compDef.description,
            slot: compDef.slot,
            cooldown: compDef.baseVariables.cooldown,
            currentCooldown: 0,
            range: compDef.baseVariables.range,
            upgrades: Object.keys(compDef.upgrades),
            activeUpgrades: [],
            energyCost: compDef.baseVariables.cost
        };
    }

    const def = SKILL_DEFINITIONS[skillId];
    if (!def) return null;
    return {
        ...def,
        currentCooldown: 0,
        activeUpgrades: [],
    };
};

export const createDefaultSkills = (): Skill[] => {
    return [
        createSkill('BASIC_ATTACK')!,
        createSkill('AUTO_ATTACK')!,
        createSkill('SPEAR_THROW')!,
        createSkill('SHIELD_BASH')!,
        createSkill('JUMP')!,
    ];
};

export const tickSkillCooldowns = (player: Entity): Entity => {
    if (!player.activeSkills) return player;

    const updatedSkills = player.activeSkills.map(skill => ({
        ...skill,
        currentCooldown: Math.max(0, skill.currentCooldown - 1)
    }));

    return { ...player, activeSkills: updatedSkills };
};

export const isSkillReady = (player: Entity, skillId: string): boolean => {
    if (!player.activeSkills) return false;
    const skill = player.activeSkills.find(s => s.id === skillId);
    if (!skill) return false;

    // Special case for spear: checks hasSpear in game state
    if (skillId === 'SPEAR_THROW') return true; // Checked at action level

    return skill.currentCooldown === 0;
};

export const putSkillOnCooldown = (player: Entity, skillId: string): Entity => {
    if (!player.activeSkills) return player;

    const updatedSkills = player.activeSkills.map(skill =>
        skill.id === skillId
            ? { ...skill, currentCooldown: skill.cooldown }
            : skill
    );

    return { ...player, activeSkills: updatedSkills };
};

export const resetSkillCooldown = (player: Entity, skillId: string): Entity => {
    if (!player.activeSkills) return player;

    const updatedSkills = player.activeSkills.map(skill =>
        skill.id === skillId
            ? { ...skill, currentCooldown: 0 }
            : skill
    );

    return { ...player, activeSkills: updatedSkills };
};

export const hasUpgrade = (player: Entity, skillId: string, upgradeId: string): boolean => {
    if (!player.activeSkills) return false;
    const skill = player.activeSkills.find(s => s.id === skillId);
    return skill?.activeUpgrades?.includes(upgradeId) ?? false;
};

export const addUpgrade = (player: Entity, skillId: string, upgradeId: string): Entity => {
    if (!player.activeSkills) return player;

    const updatedSkills = player.activeSkills.map(skill => {
        if (skill.id === skillId && !skill.activeUpgrades.includes(upgradeId)) {
            return { ...skill, activeUpgrades: [...skill.activeUpgrades, upgradeId] };
        }
        return skill;
    });

    return { ...player, activeSkills: updatedSkills };
};

export const getSkillRange = (player: Entity, skillId: string): number => {
    if (!player.activeSkills) return 0;
    if (skillId === 'LUNGE') return 2; // Lunge has fixed range 2

    const skill = player.activeSkills.find(s => s.id === skillId);
    if (!skill) return 0;

    let range = skill.range;

    // Apply range upgrades
    if (skillId === 'SPEAR_THROW' && hasUpgrade(player, skillId, 'SPEAR_RANGE')) range += 1;
    if (skillId === 'SHIELD_BASH' && hasUpgrade(player, skillId, 'SHIELD_RANGE')) range += 1;
    if (skillId === 'JUMP' && hasUpgrade(player, skillId, 'JUMP_RANGE')) range += 1;

    return range;
};

// ============================================================================
// SKILL EXECUTION
// ============================================================================

/**
 * Execute Spear Throw skill
 */
export const executeSpearThrow = (
    target: Point,
    state: GameState
): SkillResult => {
    const messages: string[] = [];
    let player = state.player;
    let enemies = [...state.enemies];
    let kills = 0;

    if (!state.hasSpear) {
        return { player, enemies, messages: ['Spear not in hand!'] };
    }

    const range = getSkillRange(player, 'SPEAR_THROW');
    const dist = hexDistance(player.position, target);

    const isInLine = (player.position.q === target.q) || (player.position.r === target.r) || (player.position.s === target.s);

    if (dist < 1 || dist > range || !isInLine) {
        return { player, enemies, messages: ['Target must be in a straight line within range!'] };
    }

    const walkable = UnifiedTileService.isWalkable(state, target);
    if (!walkable) {
        return { player, enemies, messages: ['Target must be a valid walkable tile!'] };
    }

    const targetEnemy = enemies.find(e => hexEquals(e.position, target));
    if (targetEnemy) {
        enemies = enemies.filter(e => e.id !== targetEnemy.id);
        messages.push(`Spear killed ${targetEnemy.subtype}!`);
        kills++;

        // Deep Breath upgrade: reset Jump cooldown on spear kill
        if (hasUpgrade(player, 'SPEAR_THROW', 'DEEP_BREATH')) {
            player = resetSkillCooldown(player, 'JUMP');
            messages.push('Deep Breath: Jump refreshed!');
        }
    } else {
        messages.push('Spear thrown.');
    }

    const hasRecall = hasUpgrade(player, 'SPEAR_THROW', 'RECALL');
    const hasRecallDamage = hasUpgrade(player, 'SPEAR_THROW', 'RECALL_DAMAGE');

    if (hasRecall || hasRecallDamage) {
        if (hasRecallDamage) {
            // Damage enemies on return path
            const line = getHexLine(target, player.position);
            // Path is everything between target and player
            // Exclude the starting target (already killed) and the player position
            const path = line.slice(1, -1);

            path.forEach((pos: Point) => {
                const enemyOnPath = enemies.find(e => hexEquals(e.position, pos));
                if (enemyOnPath) {
                    enemies = enemies.filter(e => e.id !== enemyOnPath.id);
                    messages.push(`Spear recall hit ${enemyOnPath.subtype}!`);
                    kills++;
                }
            });
            messages.push('Spear recalled with force!');
        } else {
            messages.push('Spear recalled instantly!');
        }
        return { player, enemies, messages, hasSpear: true, kills };
    }

    return {
        player,
        enemies,
        messages,
        spearThrown: true,
        hasSpear: false,
        spearPosition: target,
        kills,
        lastSpearPath: getHexLine(player.position, target)
    };
};

/**
 * Execute Lunge skill - move toward enemy 2 tiles away and kill them (spear in hand required)
 */
export const executeLunge = (
    target: Point,
    state: GameState
): SkillResult => {
    const messages: string[] = [];
    let player = state.player;
    let enemies = [...state.enemies];
    let kills = 0;

    if (!state.hasSpear) {
        return { player, enemies, messages: ['Lunge requires spear in hand!'] };
    }

    if (!hasUpgrade(player, 'SPEAR_THROW', 'LUNGE')) {
        return { player, enemies, messages: ['You don\'t have the Lunge upgrade!'] };
    }

    const dist = hexDistance(player.position, target);
    if (dist !== 2) {
        return { player, enemies, messages: ['Lunge target must be exactly 2 tiles away!'] };
    }

    // Check for enemy at target
    const targetEnemy = enemies.find(e => hexEquals(e.position, target));
    if (!targetEnemy) {
        return { player, enemies, messages: ['Lunge requires an enemy at the target!'] };
    }

    // Check if path is blocked by wall
    const isWall = state.tiles.get(pointToKey(target))?.baseId === 'WALL';
    if (isWall) {
        return { player, enemies, messages: ['Cannot lunge into a wall!'] };
    }

    // Check if target is walkable (not lava for Lunge)
    const walkable = UnifiedTileService.isWalkable(state, target);
    if (!walkable) {
        return { player, enemies, messages: ['Target must be a walkable tile (cannot lunge into lava)!'] };
    }

    // Kill the target enemy
    enemies = enemies.filter(e => e.id !== targetEnemy.id);
    messages.push(`Lunge killed ${targetEnemy.subtype}!`);
    kills++;

    // Move player to the target position
    player = { ...player, position: target };

    // Lunge Arc upgrade: hit enemies in 3-hex arc centered on lunge direction
    if (hasUpgrade(player, 'SPEAR_THROW', 'LUNGE_ARC')) {
        const neighbors = getNeighbors(target);
        // Get direction of lunge for arc calculation
        const lungeDir = getDirectionFromTo(state.player.position, target);
        // Arc includes the two adjacent directions
        const arcDirs = [(lungeDir + 5) % 6, (lungeDir + 1) % 6];

        const arcTargets = neighbors.filter(n => {
            const dir = getDirectionFromTo(target, n);
            return arcDirs.includes(dir);
        });

        arcTargets.forEach(arcHex => {
            const arcEnemy = enemies.find(e => hexEquals(e.position, arcHex));
            if (arcEnemy) {
                enemies = enemies.filter(e => e.id !== arcEnemy.id);
                messages.push(`Arc Lunge hit ${arcEnemy.subtype}!`);
                kills++;
            }
        });
    }

    // Deep Breath upgrade: reset Jump cooldown on lunge kill
    if (hasUpgrade(player, 'SPEAR_THROW', 'DEEP_BREATH') && kills > 0) {
        player = resetSkillCooldown(player, 'JUMP');
        messages.push('Deep Breath: Jump refreshed!');
    }

    return {
        player,
        enemies,
        messages,
        playerMoved: target,
        kills
    };
};

// Helper: Get direction from one hex to another (used for lunge arc)
const getDirectionFromTo = (from: Point, to: Point): number => {
    const dq = to.q - from.q;
    const dr = to.r - from.r;

    if (dq > 0 && dr === 0) return 0;
    if (dq > 0 && dr < 0) return 1;
    if (dq === 0 && dr < 0) return 2;
    if (dq < 0 && dr === 0) return 3;
    if (dq < 0 && dr > 0) return 4;
    return 5;
};


export interface SkillResult {
    player: Entity;
    enemies: Entity[];
    messages: string[];
    playerMoved?: Point;        // For JUMP/movement skills
    lavaCreated?: Point[];
    spearThrown?: boolean;
    hasSpear?: boolean;
    spearPosition?: Point;
    consumesTurn?: boolean;     // False for FREE_JUMP
    kills?: number;
    environmentalKills?: number;
    lastSpearPath?: Point[];
    isShaking?: boolean;
}

/**
 * Execute Shield Bash skill
 */
export const executeShieldBash = (
    target: Point,
    state: GameState
): SkillResult => {
    const messages: string[] = [];
    let player = state.player;
    let enemies = [...state.enemies];
    let environmentalKills = 0;

    const skill = player.activeSkills?.find(s => s.id === 'SHIELD_BASH');
    if (!skill || skill.currentCooldown > 0) {
        return { player, enemies, messages: ['Shield not ready!'] };
    }

    const range = getSkillRange(player, 'SHIELD_BASH');
    const dist = hexDistance(player.position, target);

    if (dist > range) {
        return { player, enemies, messages: ['Target out of range!'] };
    }

    // Check for 360° bash upgrade
    const is360 = hasUpgrade(player, 'SHIELD_BASH', 'BASH_360');
    const isArc = hasUpgrade(player, 'SHIELD_BASH', 'ARC_BASH');
    const hasWallSlam = hasUpgrade(player, 'SHIELD_BASH', 'WALL_SLAM');

    let targetsToHit: Point[] = [];

    if (is360) {
        targetsToHit = getNeighbors(player.position);
    } else if (isArc) {
        // Get direction to target and hit 3-hex arc
        // For simplicity, get target and its two neighbors closest to player
        targetsToHit = [target];
        const neighbors = getNeighbors(target);
        for (const n of neighbors) {
            if (hexDistance(n, player.position) === 1 && targetsToHit.length < 3) {
                targetsToHit.push(n);
            }
        }
    } else {
        targetsToHit = [target];
    }

    // Recursive bash helper
    const resolveBash = (
        sourcePos: Point,
        actorPos: Point,
        currentEnemies: Entity[]
    ): { updatedEnemies: Entity[]; killed: number; messages: string[]; collision?: boolean } => {
        const localMessages: string[] = [];
        let localEnemies = [...currentEnemies];
        let localKilled = 0;

        const targetActor = localEnemies.find(e => hexEquals(e.position, actorPos));
        if (!targetActor) return { updatedEnemies: localEnemies, killed: 0, messages: [] };

        const direction = getDirectionFromTo(sourcePos, actorPos);
        const pushDest = hexAdd(actorPos, hexDirection(direction));

        const blockedByWall = !UnifiedTileService.isWalkable(state, pushDest);
        const blockingEnemy = localEnemies.find(e => e.id !== targetActor.id && hexEquals(e.position, pushDest));
        const lavaAtDest = state.tiles.get(pointToKey(pushDest))?.baseId === 'LAVA';
        const isOutOfBounds = !UnifiedTileService.isWalkable(state, pushDest);

        if (isOutOfBounds || blockedByWall || blockingEnemy) {
            // Collision!
            localEnemies = localEnemies.map(e =>
                e.id === targetActor.id ? addStatus(e, 'stunned', 1) : e
            );
            localMessages.push(`Bashed ${targetActor.subtype} into ${isOutOfBounds ? 'the void' : blockedByWall ? 'a wall' : 'another enemy'} - Stunned!`);

            if (blockingEnemy && hasWallSlam) { // Only trigger cascade if Wall Slam is present
                // Recursive step: the blocking enemy also gets hit/pushed?
                // For "Collision Cascade", we resolve the bash on the next one too
                const next = resolveBash(actorPos, pushDest, localEnemies);
                localEnemies = next.updatedEnemies;
                localKilled += next.killed;
                localMessages.push(...next.messages);
            }
            return { updatedEnemies: localEnemies, killed: localKilled, messages: localMessages, collision: true };
        } else if (lavaAtDest) {
            localEnemies = localEnemies.filter(e => e.id !== targetActor.id);
            const name = targetActor.subtype ? targetActor.subtype.charAt(0).toUpperCase() + targetActor.subtype.slice(1) : 'Enemy';
            localMessages.push(`${name} fell into Lava!`);
            localKilled++;
        } else {
            // Normal move
            localEnemies = localEnemies.map(e =>
                e.id === targetActor.id ? { ...e, position: pushDest } : e
            );
            localMessages.push(`Pushed ${targetActor.subtype}!`);
        }

        return { updatedEnemies: localEnemies, killed: localKilled, messages: localMessages, collision: false };
    };

    let anyCollision = false;
    // Process each target from the bash
    for (const t of targetsToHit) {
        const result = resolveBash(player.position, t, enemies);
        enemies = result.updatedEnemies;
        environmentalKills += result.killed;
        messages.push(...result.messages);
        if (result.collision) anyCollision = true;
    }

    // Put skill on cooldown
    let cooldown = skill.cooldown;
    if (is360 || isArc) cooldown += 1; // Extra cooldown for AoE
    if (hasUpgrade(player, 'SHIELD_BASH', 'SHIELD_COOLDOWN')) cooldown -= 1;
    cooldown = Math.max(1, cooldown);

    const updatedSkills = player.activeSkills?.map(s =>
        s.id === 'SHIELD_BASH' ? { ...s, currentCooldown: cooldown } : s
    );
    player = { ...player, activeSkills: updatedSkills };

    return { player, enemies, messages, environmentalKills, isShaking: anyCollision };
};

/**
 * Execute Jump skill  
 */
export const executeJump = (
    target: Point,
    state: GameState
): SkillResult => {
    const messages: string[] = [];
    let player = state.player;
    let enemies = [...state.enemies];

    const skill = player.activeSkills?.find(s => s.id === 'JUMP');
    if (!skill || skill.currentCooldown > 0) {
        return { player, enemies, messages: ['Jump not ready!'] };
    }

    const range = getSkillRange(player, 'JUMP');
    const dist = hexDistance(player.position, target);

    if (dist < 1 || dist > range) {
        return { player, enemies, messages: ['Target out of range!'] };
    }

    // Check if landing on enemy (Meteor Impact upgrade)
    const landOnEnemy = enemies.find(e => hexEquals(e.position, target));
    const hasMeteor = hasUpgrade(player, 'JUMP', 'METEOR_IMPACT');

    if (landOnEnemy && !hasMeteor) {
        return { player, enemies, messages: ['Cannot land on enemy!'] };
    }

    // Check for target validity (must be walkable grid tile, no walls or lava)
    const walkable = UnifiedTileService.isWalkable(state, target);
    if (!walkable) {
        return { player, enemies, messages: ['Target must be a valid walkable tile (walls block jumps)!'] };
    }

    // Execute jump
    if (landOnEnemy && hasMeteor) {
        enemies = enemies.filter(e => e.id !== landOnEnemy.id);
        messages.push(`Meteor Impact killed ${landOnEnemy.subtype}!`);
    }

    player = { ...player, position: target };
    messages.push('Jumped!');

    // Stunning Landing
    if (hasUpgrade(player, 'JUMP', 'STUNNING_LANDING')) {
        const neighbors = getNeighbors(target);
        const adjacentEnemies = enemies.filter(e => neighbors.some(n => hexEquals(n, e.position)));
        if (adjacentEnemies.length > 0) {
            enemies = enemies.map(e =>
                adjacentEnemies.some(ae => ae.id === e.id) ? addStatus(e, 'stunned', 1) : e
            );
            messages.push(`Stunned ${adjacentEnemies.length} enemies!`);
        }
    }

    // Put skill on cooldown
    let cooldown = skill.cooldown;
    if (hasUpgrade(player, 'JUMP', 'JUMP_COOLDOWN')) cooldown -= 1;
    cooldown = Math.max(1, cooldown);

    const updatedSkills = player.activeSkills?.map(s =>
        s.id === 'JUMP' ? { ...s, currentCooldown: cooldown } : s
    );
    player = { ...player, activeSkills: updatedSkills };

    const consumesTurn = !hasUpgrade(player, 'JUMP', 'FREE_JUMP');

    return { player, enemies, messages, playerMoved: target, consumesTurn };
};

// ============================================================================
// SHRINE UPGRADE OPTIONS
// ============================================================================

export const getShrineUpgradeOptions = (state: GameState): string[] => {
    const player = state.player;
    const availableUpgrades: string[] = [];

    // Always offer HP upgrade
    availableUpgrades.push('EXTRA_HP');

    // Get skill-based upgrades player doesn't have yet
    for (const skill of player.activeSkills || []) {
        for (const upId of skill.upgrades) {
            if (!skill.activeUpgrades.includes(upId)) {
                availableUpgrades.push(upId);
            }
        }
    }

    // Return random selection (use RNG for determinism)
    // For now, just return first 3
    return availableUpgrades.slice(0, 4);
};

export default {
    SKILL_DEFINITIONS,
    UPGRADE_DEFINITIONS,
    createSkill,
    createDefaultSkills,
    tickSkillCooldowns,
    isSkillReady,
    putSkillOnCooldown,
    resetSkillCooldown,
    hasUpgrade,
    addUpgrade,
    getSkillRange,
    executeShieldBash,
    executeJump,
    executeSpearThrow,
    executeLunge,
    getShrineUpgradeOptions,
};
