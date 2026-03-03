import type { Actor, GameState, SigmaTier, UnifiedPowerScoreEntry } from '../types';
import { SkillRegistry } from '../skillRegistry';
import { computeSkillNumericGrade } from './evaluation/skill-grading';
import { extractTrinityStats } from './combat/combat-calculator';
import { isStunned } from './status';

const round4 = (value: number): number => Number(value.toFixed(4));

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const isBlinded = (actor: Actor): boolean =>
    actor.statusEffects?.some(status => status.type === 'blinded') ?? false;

const computeStatScore = (actor: Actor): number => {
    const trinity = extractTrinityStats(actor);
    const speed = Number(actor.speed || 0);
    const maxHp = Number(actor.maxHp || 0);
    return round4(
        (6 * Number(trinity.body || 0))
        + (6 * Number(trinity.mind || 0))
        + (5 * Number(trinity.instinct || 0))
        + (2 * speed)
        + (0.8 * maxHp)
    );
};

const computeSkillContribution = (actor: Actor, skillId: string, currentCooldown: number): number => {
    const def = SkillRegistry.get(skillId);
    if (!def) return 0;
    const slot = def.slot || actor.activeSkills.find(skill => skill.id === skillId)?.slot;
    if (slot === 'passive') return 0;
    if (!def.intentProfile) return 0;

    const baseSkill = computeSkillNumericGrade(def.intentProfile).numericGrade;
    const availability = 1 / (1 + Math.max(0, Number(currentCooldown || 0)));
    return round4(baseSkill * availability * 0.20);
};

const computeSkillScore = (actor: Actor): number => {
    const contributions = (actor.activeSkills || [])
        .map(skill => computeSkillContribution(actor, skill.id, skill.currentCooldown || 0))
        .filter(value => Number.isFinite(value) && value > 0)
        .sort((a, b) => b - a);
    return round4(contributions.slice(0, 3).reduce((sum, value) => sum + value, 0));
};

const computeStateScore = (actor: Actor): number => {
    const hp = Math.max(0, Number(actor.hp || 0));
    const maxHp = Math.max(1, Number(actor.maxHp || 1));
    const hpRatio = clamp(hp / maxHp, 0, 1);
    const temporaryArmor = Number(actor.temporaryArmor || 0);
    const stunned = isStunned(actor) ? 1 : 0;
    const blinded = isBlinded(actor) ? 1 : 0;
    return round4(
        (40 * hpRatio)
        + (3 * temporaryArmor)
        - (15 * stunned)
        - (10 * blinded)
    );
};

const populationStdDev = (values: number[]): number => {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => {
        const delta = value - mean;
        return sum + (delta * delta);
    }, 0) / values.length;
    return Math.sqrt(Math.max(0, variance));
};

export interface UnifiedPowerScoreBreakdown {
    ups: number;
    statScore: number;
    skillScore: number;
    stateScore: number;
}

export interface RelativeThreatBreakdown {
    playerScore: number;
    sigmaRef: number;
    entries: UnifiedPowerScoreEntry[];
}

export const resolveSigmaTier = (zScore: number): SigmaTier => {
    if (zScore < 0) return 'below';
    if (zScore < 1) return 'elevated';
    if (zScore < 2) return 'high';
    return 'extreme';
};

export const computeUnifiedPowerScoreBreakdown = (actor: Actor): UnifiedPowerScoreBreakdown => {
    const statScore = computeStatScore(actor);
    const skillScore = computeSkillScore(actor);
    const stateScore = computeStateScore(actor);
    const ups = round4((0.45 * statScore) + (0.40 * skillScore) + (0.15 * stateScore));
    return {
        ups,
        statScore,
        skillScore,
        stateScore
    };
};

export const computeUnifiedPowerScore = (actor: Actor): number =>
    computeUnifiedPowerScoreBreakdown(actor).ups;

const collectScoredActors = (state: GameState): Array<{
    actor: Actor;
    breakdown: UnifiedPowerScoreBreakdown;
}> => {
    const actors: Actor[] = [
        state.player,
        ...state.enemies.filter(enemy => enemy.hp > 0),
        ...(state.companions || []).filter(companion => companion.hp > 0)
    ];
    return actors.map(actor => ({
        actor,
        breakdown: computeUnifiedPowerScoreBreakdown(actor)
    }));
};

export const computeRelativeThreatScores = (state: GameState): RelativeThreatBreakdown => {
    const scoredActors = collectScoredActors(state);
    const playerEntry = scoredActors.find(entry => entry.actor.id === state.player.id);
    const playerScore = playerEntry?.breakdown.ups || 0;

    const hostileEnemyScores = scoredActors
        .filter(entry => entry.actor.type === 'enemy' && entry.actor.factionId !== state.player.factionId)
        .map(entry => entry.breakdown.ups);
    const sigmaRef = round4(Math.max(6, populationStdDev([playerScore, ...hostileEnemyScores])));

    const entries: UnifiedPowerScoreEntry[] = scoredActors
        .map(entry => {
            const actor = entry.actor;
            const zRaw = actor.id === state.player.id
                ? 0
                : (entry.breakdown.ups - playerScore) / Math.max(1e-6, sigmaRef);
            const zScore = round4(zRaw);
            return {
                actorId: actor.id,
                factionId: actor.factionId,
                isHostileToPlayer: actor.factionId !== state.player.factionId,
                ups: entry.breakdown.ups,
                statScore: entry.breakdown.statScore,
                skillScore: entry.breakdown.skillScore,
                stateScore: entry.breakdown.stateScore,
                zScore,
                sigmaTier: resolveSigmaTier(zScore)
            };
        })
        .sort((a, b) => a.actorId.localeCompare(b.actorId));

    return {
        playerScore,
        sigmaRef,
        entries
    };
};

