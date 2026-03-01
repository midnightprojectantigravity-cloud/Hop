import type { Action, GameState, Point, SkillIntentProfile } from '../../../types';
import { getNeighbors, hexDistance, hexEquals } from '../../../hex';
import { UnifiedTileService } from '../../tiles/unified-tile-service';
import { SkillRegistry } from '../../../skillRegistry';

export type ActionCandidate = {
    action: Action;
    profile?: SkillIntentProfile;
    preScore: number;
};

const enemyAt = (state: GameState, p: Point) =>
    state.enemies.find(e => e.hp > 0 && e.factionId === 'enemy' && hexEquals(e.position, p));

export const isHazardTile = (state: GameState, p: Point): boolean => {
    const tile = UnifiedTileService.getTileAt(state, p);
    if (!tile) return false;
    return tile.traits.has('HAZARDOUS')
        || tile.baseId === 'LAVA'
        || !!tile.effects?.some(e => e.id === 'FIRE' || e.id === 'SNARE');
};

export const adjacentHostileCount = (state: GameState, p: Point): number => {
    return state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy' && hexDistance(e.position, p) === 1).length;
};

const aliveHostilesList = (state: GameState) =>
    state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy' && e.subtype !== 'bomb');

export const aliveHostiles = (state: GameState): number => aliveHostilesList(state).length;

export const nearestHostileDistance = (state: GameState, from = state.player.position): number => {
    const hostiles = aliveHostilesList(state);
    if (hostiles.length === 0) return 0;
    return hostiles
        .map(e => hexDistance(from, e.position))
        .sort((a, b) => a - b)[0];
};

const isInBounds = (state: GameState, p: Point): boolean =>
    p.q >= 0 && p.q < state.gridWidth && p.r >= 0 && p.r < state.gridHeight;

const pathDistance = (state: GameState, from: Point, to: Point): number => {
    if (hexEquals(from, to)) return 0;

    const queue: Array<{ p: Point; d: number }> = [{ p: from, d: 0 }];
    const visited = new Set<string>([`${from.q},${from.r},${from.s}`]);

    while (queue.length > 0) {
        const node = queue.shift()!;
        for (const next of getNeighbors(node.p)) {
            const key = `${next.q},${next.r},${next.s}`;
            if (visited.has(key)) continue;
            visited.add(key);
            if (!isInBounds(state, next)) continue;
            if (!UnifiedTileService.isWalkable(state, next) && !hexEquals(next, to)) continue;
            if (hexEquals(next, to)) return node.d + 1;
            queue.push({ p: next, d: node.d + 1 });
        }
    }

    // Fallback keeps scoring finite if target is currently unreachable.
    return hexDistance(from, to) + 12;
};

export const distanceToStairs = (state: GameState, from = state.player.position): number => {
    if (!state.stairsPosition) return 0;
    return pathDistance(state, from, state.stairsPosition);
};

export const distanceToShrine = (state: GameState, from = state.player.position): number => {
    if (!state.shrinePosition) return 0;
    return pathDistance(state, from, state.shrinePosition);
};

const targetEnemyDensity = (state: GameState, target: Point): number =>
    state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy' && hexDistance(e.position, target) <= 1).length;

export const hasReadySkill = (state: GameState, skillId: string): boolean =>
    (state.player.activeSkills || []).some(s => s.id === skillId && (s.currentCooldown || 0) <= 0);

const estimatedSkillDamage = (skillId: string): number =>
    SkillRegistry.get(skillId)?.intentProfile?.estimates?.damage || 0;

const adjacentHostiles = (state: GameState) =>
    aliveHostilesList(state).filter(e => hexDistance(e.position, state.player.position) === 1);

export const hasImmediateBasicAttackKill = (state: GameState): boolean => {
    if (!hasReadySkill(state, 'BASIC_ATTACK')) return false;
    const dmg = estimatedSkillDamage('BASIC_ATTACK');
    if (dmg <= 0) return false;
    return adjacentHostiles(state).some(e => e.hp <= dmg);
};

export const hasImmediateAutoAttackKill = (state: GameState): boolean => {
    if (!hasReadySkill(state, 'AUTO_ATTACK')) return false;
    const dmg = estimatedSkillDamage('AUTO_ATTACK');
    if (dmg <= 0) return false;
    return adjacentHostiles(state).some(e => e.hp <= dmg);
};

export const isDefensiveOrControlSkill = (profile?: SkillIntentProfile): boolean => {
    if (!profile) return false;
    const tags = profile.intentTags || [];
    const hasDamage = tags.includes('damage');
    const defensiveTag = tags.includes('heal') || tags.includes('protect') || tags.includes('control') || tags.includes('summon');
    return defensiveTag && !hasDamage;
};

export const legalMoves = (state: GameState): Point[] => {
    const origin = state.player.position;
    const moveDef = SkillRegistry.get('BASIC_MOVE');
    if (moveDef?.getValidTargets) {
        return moveDef.getValidTargets(state, origin);
    }
    return getNeighbors(origin)
        .filter(p => p.q >= 0 && p.q < state.gridWidth && p.r >= 0 && p.r < state.gridHeight)
        .filter(p => UnifiedTileService.isWalkable(state, p));
};

const tagWeight = (profile: SkillIntentProfile | undefined, tag: string): number => {
    if (!profile) return 0;
    return profile.intentTags.includes(tag as any) ? 1 : 0;
};

export const preRankAction = (state: GameState, action: Action, profile?: SkillIntentProfile): number => {
    const immediateBasicKill = hasImmediateBasicAttackKill(state);
    const immediateAutoKill = hasImmediateAutoAttackKill(state);

    if (action.type === 'WAIT') {
        const adjacent = adjacentHostileCount(state, state.player.position);
        const hasAutoAttack = hasReadySkill(state, 'AUTO_ATTACK');
        if (hasAutoAttack && immediateAutoKill) {
            return 14 + adjacent * 2;
        }
        if (hasAutoAttack && adjacent > 0) return -3;
        return -4;
    }

    const hpRatio = (state.player.hp || 0) / Math.max(1, state.player.maxHp || 1);
    const hostileCount = aliveHostiles(state);
    const inCombat = hostileCount > 0;

    if (action.type === 'MOVE') {
        const hazardPenalty = isHazardTile(state, action.payload) ? 14 : 0;
        const pressurePenalty = adjacentHostileCount(state, action.payload) * 2;
        const approach = nearestHostileDistance(state) - nearestHostileDistance(state, action.payload);
        const shrineGain = distanceToShrine(state) - distanceToShrine(state, action.payload);
        const stairGain = distanceToStairs(state) - distanceToStairs(state, action.payload);
        const objectiveGain = inCombat ? 0 : (stairGain + (hpRatio < 0.6 ? shrineGain : 0));
        return (approach * 1.2) + (objectiveGain * 1.4) - hazardPenalty - pressurePenalty;
    }

    if (action.type !== 'USE_SKILL') {
        return -1;
    }

    const target = action.payload.target || state.player.position;
    const directHit = enemyAt(state, target) ? 1 : 0;
    const density = targetEnemyDensity(state, target);
    const summonCount = state.enemies.filter(e => e.hp > 0 && e.factionId === 'player' && e.companionOf === state.player.id).length;

    let score = 0;
    score += directHit * (4 + (profile?.estimates.damage || 0));
    score += density * (profile?.target.aoeRadius ? 1.7 : 1.0);
    score += tagWeight(profile, 'damage') * 2.2;
    score += tagWeight(profile, 'control') * 1.3;
    score += tagWeight(profile, 'heal') * (hpRatio < 0.6 ? 3 : 0.6);
    score += tagWeight(profile, 'protect') * (hpRatio < 0.5 ? 2.5 : 1);
    score += tagWeight(profile, 'summon') * Math.max(0, 7 - summonCount) * 0.8;
    score += tagWeight(profile, 'move') * (inCombat ? 0.8 : 1.1);
    score += tagWeight(profile, 'objective') * (inCombat ? 0 : 1.3);
    score -= tagWeight(profile, 'hazard') * (hpRatio < 0.5 ? 0.6 : 0.2);
    if (action.payload.skillId === 'BASIC_ATTACK' && immediateBasicKill) {
        score += 20;
    }
    if (immediateBasicKill && isDefensiveOrControlSkill(profile)) {
        score -= 12;
    }
    if (profile?.risk?.requireEnemyContact && directHit === 0 && density === 0) {
        score -= profile.risk.noContactPenalty ?? 4;
    }
    if (action.payload.skillId === 'SHIELD_BASH') {
        const adjacent = adjacentHostileCount(state, state.player.position);
        if (adjacent >= 2) {
            score -= 4;
        }
        if (immediateBasicKill) {
            score -= 10;
        }
    }

    return score;
};

export const buildSkillActions = (state: GameState): ActionCandidate[] => {
    const actions: ActionCandidate[] = [];
    const origin = state.player.position;

    for (const skill of (state.player.activeSkills || [])) {
        if ((skill.currentCooldown || 0) > 0) continue;
        if (skill.id === 'AUTO_ATTACK') continue;
        if (skill.id === 'BASIC_MOVE') continue;

        const def = SkillRegistry.get(skill.id);
        if (!def?.getValidTargets) continue;
        let targets = def.getValidTargets(state, origin);
        if ((!targets || targets.length === 0) && def.intentProfile?.target.pattern === 'self') {
            targets = [origin];
        }
        if (!targets?.length) continue;

        const profile = def.intentProfile;
        const rankedTargets = targets
            .map(target => {
                const direct = enemyAt(state, target) ? 2 : 0;
                const density = targetEnemyDensity(state, target);
                if (profile?.intentTags.includes('damage') && direct === 0 && density === 0) {
                    return null;
                }
                const objectiveBias = (profile?.intentTags.includes('objective') && !aliveHostiles(state))
                    ? ((distanceToStairs(state) - distanceToStairs(state, target)) + (distanceToShrine(state) - distanceToShrine(state, target)))
                    : 0;
                return { target, score: direct + density + objectiveBias };
            })
            .filter((x): x is { target: Point; score: number } => !!x)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(t => t.target);

        for (const target of rankedTargets) {
            const action: Action = { type: 'USE_SKILL', payload: { skillId: skill.id, target } };
            actions.push({
                action,
                profile,
                preScore: preRankAction(state, action, profile)
            });
        }
    }

    return actions;
};
