import { SkillRegistry } from '../../../skillRegistry';
import type { GameState } from '../../../types';
import {
    adjacentHostileCount,
    aliveHostiles,
    nearestHostileDistance
} from './candidates';
import { getAiResourceSignals } from '../resource-signals';
export { getStrategicPolicyProfile, type StrategicIntent, type StrategicPolicyProfile } from '../strategic-policy';
import type { StrategicIntent, StrategicPolicyProfile } from '../strategic-policy';

const hasReadyTagSkill = (state: GameState, tag: string): boolean => {
    for (const skill of (state.player.activeSkills || [])) {
        if ((skill.currentCooldown || 0) > 0) continue;
        const profile = SkillRegistry.get(skill.id)?.intentProfile;
        if (!profile) continue;
        if (profile.intentTags.includes(tag as any)) return true;
    }
    return false;
};

export const chooseStrategicIntent = (state: GameState, profile: StrategicPolicyProfile): StrategicIntent => {
    const hpRatio = (state.player.hp || 0) / Math.max(1, state.player.maxHp || 1);
    const hostiles = aliveHostiles(state);
    const ires = state.player.ires;
    const resourceSignals = getAiResourceSignals(ires, state.ruleset);
    const adjacentThreat = adjacentHostileCount(state, state.player.position);
    const nearestThreat = nearestHostileDistance(state);
    const immediateThreat = adjacentThreat > 0 || nearestThreat <= 2;
    const sparkBand = resourceSignals.aiSparkBand;
    const preservingBandLikelyBetter = ires
        && (
            sparkBand === 'critical'
            || sparkBand === 'exhausted'
            || (sparkBand === 'caution' && Number(ires.actionCountThisTurn || 0) >= 1)
            || (sparkBand === 'rested_edge' && Number(ires.actionCountThisTurn || 0) >= 1)
            || (resourceSignals.postStablePressure >= 0.5 && Number(ires.actionCountThisTurn || 0) >= 1)
        );

    if (hpRatio < profile.thresholds.defenseHpRatio) return 'defense';
    if (hostiles <= 0) return 'positioning';
    if (
        ires
        && (
            sparkBand === 'exhausted'
            || sparkBand === 'critical'
            || (sparkBand === 'caution' && Number(ires.actionCountThisTurn || 0) >= 1)
            || (immediateThreat && preservingBandLikelyBetter)
            || (immediateThreat && resourceSignals.reservePressure >= 0.82)
        )
    ) {
        return 'defense';
    }

    if (adjacentThreat >= profile.thresholds.defensePressureAdjacentHostiles && hpRatio < profile.thresholds.defensePressureHpRatio) return 'defense';
    if (hasReadyTagSkill(state, 'control')
        && hostiles >= profile.thresholds.controlMinHostiles
        && (adjacentThreat > 0 || nearestThreat <= 2)) {
        return 'control';
    }
    return 'offense';
};
