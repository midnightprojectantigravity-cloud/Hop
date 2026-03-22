import { gameReducer } from '../../../logic';
import type { Action, GameState, SkillIntentProfile } from '../../../types';
import { pointToKey } from '../../../hex';
import { getFalconForHunter } from '../../falcon';
import type { StrategicIntent, StrategicPolicyProfile } from '../strategic-policy';
import { scoreFeatures } from '../core/scoring';
import { seededChoiceSource } from '../core/tiebreak';
import {
    adjacentHostileCount,
    aliveHostiles,
    buildSkillActions,
    distanceToShrine,
    distanceToStairs,
    hasImmediateAutoAttackKill,
    hasImmediateBasicAttackKill,
    hasReadySkill,
    isDefensiveOrControlSkill,
    isHazardTile,
    legalMoves,
    preRankAction,
    type ActionCandidate
} from './candidates';
import { transitionMetrics, type TransitionMetrics } from './features';
import { chooseStrategicIntent } from './policy';
import { getAiResourceSignals } from '../resource-signals';

export type HarnessBotPolicy = 'random' | 'heuristic';

export const resolvePending = (state: GameState): GameState => {
    let cur = state;
    let safety = 0;
    while (cur.pendingStatus && safety < 20) {
        cur = gameReducer(cur, { type: 'RESOLVE_PENDING' });
        safety++;
    }
    return cur;
};

const stateHash = (state: GameState): string => {
    const enemyBits = state.enemies
        .filter(e => e.hp > 0)
        .map(e => `${e.id}:${e.hp}:${pointToKey(e.position)}`)
        .sort()
        .join('|');
    return [
        state.turnsSpent,
        state.floor,
        state.rngCounter,
        state.player.hp,
        pointToKey(state.player.position),
        enemyBits
    ].join('::');
};

const actionKey = (action: Action): string => {
    if (action.type === 'USE_SKILL') {
        const targetKey = action.payload.target ? pointToKey(action.payload.target) : 'none';
        return `${action.type}:${action.payload.skillId}:${targetKey}`;
    }
    if (action.type === 'MOVE') {
        return `${action.type}:${pointToKey(action.payload)}`;
    }
    return action.type;
};

const tagWeight = (profile: SkillIntentProfile | undefined, tag: string): number => {
    if (!profile) return 0;
    return profile.intentTags.includes(tag as any) ? 1 : 0;
};

const utilityWeights = (_state: GameState, strategicIntent: StrategicIntent, policyProfile: StrategicPolicyProfile) => {
    return policyProfile.weightsByIntent[strategicIntent];
};

const firemageSpellSelectionScore = (
    entry: { value: number; metrics: TransitionMetrics; candidate: ActionCandidate }
): number => {
    if (entry.candidate.action.type !== 'USE_SKILL') return entry.value;
    const skillId = entry.candidate.action.payload.skillId;
    const metrics = entry.metrics;
    let score = entry.value;

    if (skillId === 'FIREBALL') {
        score += Math.min(14, metrics.enemyDamage * 1.2);
        score += metrics.killShot * 16;
        score += Math.max(0, metrics.enemyApproachProgress) * 2;
        score -= metrics.hazardDamage * 3;
        if (metrics.safetyDelta <= 0) {
            score += 2;
        }
    } else if (skillId === 'FIREWALL') {
        score += Math.min(10, metrics.enemyDamage);
        score += Math.max(0, metrics.safetyDelta) * 10;
        score += Math.max(0, metrics.enemyApproachProgress) * 2;
        score -= metrics.hazardDamage * 4;
        if (metrics.safetyDelta <= 0 && metrics.enemyDamage <= 2) {
            score -= 8;
        }
    }

    return score;
};

const scoreIresTransition = (
    state: GameState,
    next: GameState,
    candidate: ActionCandidate,
    metrics: TransitionMetrics,
    hostilesRemaining: number,
    archetype: string,
    resourceWeight: number
): number => {
    const current = state.player.ires;
    const projected = next.player.ires;
    if (!current || !projected) return 0;

    const weightedResource = Math.max(1, resourceWeight);
    const sparkSpent = Math.max(0, current.spark - projected.spark);
    const sparkRecovered = Math.max(0, projected.spark - current.spark);
    const manaSpent = Math.max(0, current.mana - projected.mana);
    const manaRecovered = Math.max(0, projected.mana - current.mana);
    const exhaustionGained = Math.max(0, projected.exhaustion - current.exhaustion);
    const exhaustionCleared = Math.max(0, current.exhaustion - projected.exhaustion);
    const enteredExhausted = !current.isExhausted && projected.isExhausted;
    const clearedExhausted = current.isExhausted && !projected.isExhausted;
    const stayedExhausted = current.isExhausted && projected.isExhausted;
    const isWait = candidate.action.type === 'WAIT';
    const isRestAction = isWait && !current.actedThisTurn && !current.movedThisTurn;
    const isEndTurnAction = isWait && !isRestAction;
    const currentSignals = getAiResourceSignals(current);
    const projectedSignals = getAiResourceSignals(projected);
    const normalizedSparkSpent = sparkSpent / Math.max(1, current.maxSpark || 1);
    const normalizedManaSpent = manaSpent / Math.max(1, current.maxMana || 1);
    const normalizedSparkRecovered = sparkRecovered / Math.max(1, current.maxSpark || 1);
    const normalizedManaRecovered = manaRecovered / Math.max(1, current.maxMana || 1);
    const normalizedExhaustionGained = exhaustionGained / 100;
    const normalizedExhaustionCleared = exhaustionCleared / 100;

    let value = 0;
    value += normalizedSparkRecovered * 24 * weightedResource;
    value += normalizedManaRecovered * 20 * weightedResource;
    value += normalizedExhaustionCleared * 42 * weightedResource;
    value -= normalizedSparkSpent * 14 * weightedResource;
    value -= normalizedManaSpent * 16 * weightedResource;
    value -= normalizedExhaustionGained * 34 * weightedResource;

    if (enteredExhausted) value -= 26;
    if (stayedExhausted && !isWait) value -= 12;
    if (clearedExhausted) value += 18;

    value -= projectedSignals.reservePressure * 16;
    value -= projectedSignals.fatiguePressure * 22;

    if (isRestAction) {
        value += 4 + (currentSignals.recoveryPressure * 18);
        if (hostilesRemaining > 0) {
            value += normalizedExhaustionCleared * 20;
            value += normalizedSparkRecovered * 12;
            value += normalizedManaRecovered * 12;
        }
    }

    if (isEndTurnAction && current.actionCountThisTurn > 0) {
        value += 2 + (currentSignals.recoveryPressure * 12);
        if (current.actionCountThisTurn >= 2) {
            value += 5;
        }
    }

    if (archetype === 'FIREMAGE') {
        value += normalizedExhaustionCleared * 18;
        value -= normalizedExhaustionGained * 12;

        if (isWait) {
            if (isRestAction && currentSignals.recoveryPressure >= 0.45) {
                value += 16;
            }
            if (isEndTurnAction && (current.actionCountThisTurn >= 2 || projectedSignals.fatiguePressure >= 0.65)) {
                value += 10;
            }
        } else if (candidate.action.type === 'MOVE') {
            if (currentSignals.fatiguePressure >= 0.5) {
                value -= 6;
            }
        } else if (candidate.action.type === 'USE_SKILL') {
            const skillId = candidate.action.payload.skillId;
            if (skillId === 'FIREWALK') {
                if (metrics.enemyDamage === 0 && metrics.killShot === 0) {
                    value -= 10;
                }
                if (metrics.enemyApproachProgress <= 0 && metrics.safetyDelta <= 0) {
                    value -= 10;
                }
                if (currentSignals.recoveryPressure >= 0.45 || currentSignals.sparkRatio <= 0.35) {
                    value -= 12;
                }
                if (enteredExhausted) {
                    value -= 10;
                }
            }
            if ((skillId === 'FIREBALL' || skillId === 'FIREWALL') && metrics.enemyDamage > 0) {
                value += 6;
            }
            if (currentSignals.manaRatio <= 0.25 && manaSpent > 0) {
                value -= 8;
            }
        }
    }

    return value;
};

const evaluateAction = (
    state: GameState,
    candidate: ActionCandidate,
    strategicIntent: StrategicIntent,
    profile: StrategicPolicyProfile,
    memo: Map<string, { value: number; metrics: TransitionMetrics; next: GameState }>
): { value: number; metrics: TransitionMetrics; next: GameState } => {
    const key = `${stateHash(state)}|${state.player.id}|${actionKey(candidate.action)}`;
    const cached = memo.get(key);
    if (cached) return cached;

    const next = resolvePending(gameReducer(state, candidate.action));
    const metrics = transitionMetrics(state, next, candidate.action);
    const endsOnHazard = isHazardTile(next, next.player.position);
    const prevCombatCount = (state.combatScoreEvents || []).length;
    const newCombatEvents = ((next.combatScoreEvents || []).slice(prevCombatCount) as any[]);
    const autoAttackEvents = newCombatEvents.filter(e =>
        e && e.attackerId === state.player.id && e.skillId === 'AUTO_ATTACK'
    );
    const autoAttackDamage = autoAttackEvents.reduce((sum, e) => sum + Number(e.finalPower || 0), 0);
    const autoAttackHits = autoAttackEvents.length;
    const archetype = String(state.player.archetype || '');
    const w = utilityWeights(state, strategicIntent, profile);
    const immediateBasicKill = hasImmediateBasicAttackKill(state);
    const immediateAutoKill = hasImmediateAutoAttackKill(state);

    // Keep shared scorer available for convergence tooling, but preserve legacy arithmetic order
    // for exact deterministic tie behavior in harness regression/golden fingerprint checks.
    const _baseBreakdown = scoreFeatures(
        {
            healing_received: metrics.healingReceived,
            hazard_damage: metrics.hazardDamage,
            enemy_damage: metrics.enemyDamage,
            kill_shot: metrics.killShot,
            enemy_approach_progress: metrics.enemyApproachProgress,
            safety_delta: metrics.safetyDelta,
            stairs_progress: metrics.stairsProgress,
            shrine_progress: metrics.shrineProgress,
            floor_progress: metrics.floorProgress,
            wait_penalty: -metrics.waitPenalty,
            no_progress_penalty: -metrics.noProgressPenalty
        },
        {
            healing_received: w.survival,
            hazard_damage: -1.8 * w.survival,
            enemy_damage: 2.5 * w.lethality,
            kill_shot: 18 * w.lethality,
            enemy_approach_progress: w.position,
            safety_delta: w.position,
            stairs_progress: w.objective,
            shrine_progress: w.objective,
            floor_progress: 6 * w.objective,
            wait_penalty: w.tempo,
            no_progress_penalty: 2.5 * w.tempo
        }
    );
    void _baseBreakdown;

    let value = 0;
    value += (metrics.healingReceived - (metrics.hazardDamage * 1.8)) * w.survival;
    value += (metrics.enemyDamage * 2.5 + metrics.killShot * 18) * w.lethality;
    value += (metrics.enemyApproachProgress + metrics.safetyDelta) * w.position;
    value += (metrics.stairsProgress + metrics.shrineProgress + metrics.floorProgress * 6) * w.objective;
    value += (-metrics.waitPenalty - (metrics.noProgressPenalty * 2.5)) * w.tempo;
    if (endsOnHazard) {
        value -= 18 * Math.max(1, w.survival);
    }

    const hostilesRemaining = aliveHostiles(state);
    if (hostilesRemaining === 0) {
        if (candidate.action.type === 'WAIT') {
            value -= 20;
        }
        if (candidate.action.type === 'MOVE') {
            if (metrics.floorProgress > 0 || metrics.stairsProgress > 0 || metrics.shrineProgress > 0) {
                value += 12;
            } else {
                value -= 12;
            }
        }
    }

    const p = candidate.profile;
    if (p) {
        value += (p.estimates.damage || 0) * tagWeight(p, 'damage') * 0.8;
        value += (p.estimates.healing || 0) * tagWeight(p, 'heal') * (w.survival * 0.3);
        value += (p.estimates.movement || 0) * tagWeight(p, 'move') * 0.4;
        value += (p.estimates.control || 0) * tagWeight(p, 'control') * (0.3 + (w.status * 0.2));
        value += (p.estimates.summon || 0) * tagWeight(p, 'summon') * 0.9;
        value -= (p.economy.cooldown || 0) * 0.12;
        value -= (p.economy.cost || 0) * 0.08 * w.resource;
    }
    if (autoAttackHits > 0) {
        value += (autoAttackDamage * 0.8) + (autoAttackHits * 1.5);
    } else if (
        candidate.action.type === 'USE_SKILL'
        && p?.risk?.requireEnemyContact
        && metrics.enemyDamage === 0
        && metrics.killShot === 0
    ) {
        value -= 4;
    }
    if (candidate.action.type === 'USE_SKILL' && candidate.action.payload.skillId === 'SHIELD_BASH') {
        const passivePotential = adjacentHostileCount(state, state.player.position);
        if (passivePotential >= 2 && autoAttackHits < passivePotential && metrics.enemyDamage <= autoAttackDamage) {
            value -= 8;
        }
        if (immediateBasicKill && metrics.killShot === 0) {
            value -= 18;
        }
    }
    if (candidate.action.type === 'USE_SKILL' && candidate.action.payload.skillId === 'BASIC_ATTACK') {
        if (metrics.killShot > 0) {
            value += 28 * metrics.killShot;
        } else if (immediateBasicKill) {
            value += 16;
        }
    }
    const isOffensiveAction = candidate.action.type === 'USE_SKILL'
        ? (candidate.action.payload.skillId === 'BASIC_ATTACK' || tagWeight(p, 'damage') > 0)
        : (candidate.action.type === 'WAIT' && hasReadySkill(state, 'AUTO_ATTACK'));
    if (metrics.killShot > 0 && isOffensiveAction) {
        value += 22 * metrics.killShot;
    }
    const skippedImmediateKill = metrics.killShot === 0 && (immediateBasicKill || immediateAutoKill);
    if (skippedImmediateKill) {
        if (candidate.action.type === 'MOVE') {
            value -= 16;
        } else if (candidate.action.type === 'USE_SKILL' && isDefensiveOrControlSkill(p)) {
            value -= 22;
        }
    }
    if (candidate.action.type === 'USE_SKILL') {
        const deadCast = metrics.noProgressPenalty > 0
            && metrics.enemyDamage === 0
            && metrics.killShot === 0
            && metrics.stairsProgress === 0
            && metrics.shrineProgress === 0
            && metrics.floorProgress === 0
            && metrics.enemyApproachProgress === 0
            && metrics.safetyDelta <= 0;
        if (deadCast) {
            value -= p?.risk?.noProgressCastPenalty ?? 40;
        }

        const skillId = candidate.action.payload.skillId;
        if (
            skillId === 'FALCON_COMMAND'
            && getFalconForHunter(state, state.player.id)
            && metrics.enemyDamage === 0
            && metrics.killShot === 0
        ) {
            value -= 20;
        }
        if (
            profile.version === 'sp-v1-balance'
            && archetype === 'HUNTER'
            && skillId === 'FALCON_COMMAND'
            && !getFalconForHunter(state, state.player.id)
        ) {
            value += hostilesRemaining > 0 ? 24 : 12;
        }
        if (skillId === 'KINETIC_TRI_TRAP' && metrics.enemyDamage === 0 && metrics.killShot === 0) {
            value -= 14;
        }
        if (skillId === 'WITHDRAWAL' && metrics.enemyDamage === 0 && metrics.killShot === 0) {
            value -= 10;
        }
        if (
            profile.version === 'sp-v1-balance'
            && archetype === 'HUNTER'
            && skillId === 'WITHDRAWAL'
        ) {
            const adjacentThreat = adjacentHostileCount(state, state.player.position);
            if (adjacentThreat > 0) {
                value += 10 + (metrics.safetyDelta * 4);
            }
        }

        if (profile.version === 'sp-v1-balance' && archetype === 'SKIRMISHER') {
            if (skillId === 'SHIELD_THROW' || skillId === 'GRAPPLE_HOOK') {
                value += (metrics.enemyDamage * 1.1) + (metrics.killShot * 8);
                if (metrics.noProgressPenalty > 0 && metrics.enemyDamage === 0) {
                    value -= 6;
                }
            }
        }
    }

    if (
        profile.version === 'sp-v1-balance'
        && archetype === 'ASSASSIN'
        && candidate.action.type === 'MOVE'
        && aliveHostiles(state) > 0
        && metrics.enemyApproachProgress <= 0
        && metrics.enemyDamage === 0
        && metrics.killShot === 0
    ) {
        value -= 6;
    }

    value += scoreIresTransition(
        state,
        next,
        candidate,
        metrics,
        hostilesRemaining,
        archetype,
        w.resource
    );

    const evaluated = { value, metrics, next };
    memo.set(key, evaluated);
    return evaluated;
};

export const selectByOnePlySimulation = (
    state: GameState,
    strategicIntent: StrategicIntent,
    profile: StrategicPolicyProfile,
    simSeed: string,
    decisionCounter: number,
    topK = 6
): Action => {
    const hostiles = aliveHostiles(state);
    const archetype = String(state.player.archetype || '');
    if (hostiles === 0 && profile.version === 'sp-v1-balance' && archetype === 'ASSASSIN') {
        const moves = legalMoves(state);
        if (moves.length > 0) {
            const hpRatio = (state.player.hp || 0) / Math.max(1, state.player.maxHp || 1);
            const preferShrine = !!state.shrinePosition && hpRatio < 0.6;
            const rankedMoves = moves.map(move => {
                const primary = preferShrine
                    ? distanceToShrine(state, move)
                    : distanceToStairs(state, move);
                const secondary = preferShrine
                    ? distanceToStairs(state, move)
                    : distanceToShrine(state, move);
                const hazardPenalty = isHazardTile(state, move) ? 6 : 0;
                const score = (primary * 100) + (secondary * 2) + hazardPenalty;
                return { move, score };
            });
            rankedMoves.sort((a, b) => a.score - b.score);
            const best = rankedMoves[0].score;
            const ties = rankedMoves.filter(x => x.score === best).map(x => x.move);
            const tie = seededChoiceSource.chooseIndex(ties.length, { seed: `${simSeed}:assassin_obj`, counter: decisionCounter });
            return { type: 'MOVE', payload: ties[tie.index] || ties[0] };
        }
    }

    const moveCandidates: ActionCandidate[] = legalMoves(state).map(move => {
        const action: Action = { type: 'MOVE', payload: move };
        return { action, preScore: preRankAction(state, action) };
    });
    const skillCandidates = buildSkillActions(state);
    const waitCandidate: ActionCandidate = { action: { type: 'WAIT' }, preScore: preRankAction(state, { type: 'WAIT' }) };

    const allCandidates = [waitCandidate, ...moveCandidates, ...skillCandidates];
    if (allCandidates.length === 0) return { type: 'WAIT' };

    const filtered = allCandidates;
    const ranked = [...filtered].sort((a, b) => b.preScore - a.preScore);
    const shortlist = ranked.slice(0, Math.max(1, Math.min(topK, ranked.length)));

    const memo = new Map<string, { value: number; metrics: TransitionMetrics; next: GameState }>();
    const scored = shortlist.map(candidate => {
        const evald = evaluateAction(state, candidate, strategicIntent, profile, memo);
        return { candidate, ...evald };
    });

    const nonStallingSkillActions = scored.filter(s => {
        if (s.candidate.action.type !== 'USE_SKILL') return true;
        const m = s.metrics;
        const noProgress = m.noProgressPenalty > 0
            && m.enemyDamage === 0
            && m.killShot === 0
            && m.stairsProgress === 0
            && m.shrineProgress === 0
            && m.floorProgress === 0;
        return !noProgress;
    });

    const candidatePool = nonStallingSkillActions.length > 0 ? nonStallingSkillActions : scored;
    if (candidatePool.length === 0) return { type: 'WAIT' };
    const killers = candidatePool.filter(s => s.metrics.killShot > 0);
    const bestPool = killers.length > 0 ? killers : candidatePool;
    bestPool.sort((a, b) => b.value - a.value);

    if (archetype === 'FIREMAGE') {
        const current = state.player.ires;
        const resourceSignals = getAiResourceSignals(current);
        const stableSpellWindow = !!current
            && resourceSignals.fatiguePressure < 0.55
            && resourceSignals.sparkRatio > 0.25
            && resourceSignals.manaRatio > 0.25;
        if (stableSpellWindow) {
            const fireSpells = bestPool
                .filter(entry =>
                    entry.candidate.action.type === 'USE_SKILL'
                    && (entry.candidate.action.payload.skillId === 'FIREBALL' || entry.candidate.action.payload.skillId === 'FIREWALL')
                    && entry.metrics.enemyDamage > 0
                )
                .sort((a, b) => firemageSpellSelectionScore(b) - firemageSpellSelectionScore(a));

            const bestSpell = fireSpells[0];
            const currentBest = bestPool[0];
            if (bestSpell && currentBest) {
                const currentBestIsSpell = currentBest.candidate.action.type === 'USE_SKILL'
                    && (currentBest.candidate.action.payload.skillId === 'FIREBALL' || currentBest.candidate.action.payload.skillId === 'FIREWALL');

                if (
                    !currentBestIsSpell
                    && firemageSpellSelectionScore(bestSpell) >= currentBest.value - 4
                ) {
                    return bestSpell.candidate.action;
                }

                if (
                    currentBestIsSpell
                    && firemageSpellSelectionScore(bestSpell) > firemageSpellSelectionScore(currentBest) + 2
                ) {
                    return bestSpell.candidate.action;
                }
            }
        }
    }

    const best = bestPool[0].value;
    const ties = bestPool.filter(x => x.value === best).map(x => x.candidate.action);
    const tie = seededChoiceSource.chooseIndex(ties.length, { seed: `${simSeed}:sim`, counter: decisionCounter });
    return ties[tie.index] || { type: 'WAIT' };
};

export const selectHarnessPlayerAction = (
    state: GameState,
    policy: HarnessBotPolicy,
    profile: StrategicPolicyProfile,
    simSeed: string,
    decisionCounter: number
): { action: Action; strategicIntent: StrategicIntent } => {
    const strategicIntent = chooseStrategicIntent(state, profile);

    if (policy === 'random') {
        const moves = legalMoves(state);
        const options: Action[] = [{ type: 'WAIT' }, ...moves.map(m => ({ type: 'MOVE' as const, payload: m }))];
        const tie = seededChoiceSource.chooseIndex(options.length, { seed: simSeed, counter: decisionCounter });
        return { action: options[tie.index] || { type: 'WAIT' }, strategicIntent };
    }

    return {
        action: selectByOnePlySimulation(state, strategicIntent, profile, simSeed, decisionCounter),
        strategicIntent
    };
};
