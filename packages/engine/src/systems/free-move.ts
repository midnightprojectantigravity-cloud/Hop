import type { Actor, GameState, Skill } from '../types';
import type { Point } from '../types';
import { hexEquals } from '../hex';
import { recomputeVisibility } from './visibility';

const zeroSkillCooldowns = (skills: Skill[] | undefined): Skill[] | undefined => {
    if (!skills || skills.length === 0) return skills;
    let changed = false;
    const next = skills.map(skill => {
        if ((skill.currentCooldown || 0) <= 0) return skill;
        changed = true;
        return { ...skill, currentCooldown: 0 };
    });
    return changed ? next : skills;
};

const resetActorCooldowns = (actor: Actor): Actor => {
    const nextSkills = zeroSkillCooldowns(actor.activeSkills);
    const nextActionCooldown = (actor.actionCooldown || 0) > 0 ? 0 : actor.actionCooldown;
    if (nextSkills === actor.activeSkills && nextActionCooldown === actor.actionCooldown) return actor;
    return {
        ...actor,
        activeSkills: nextSkills || actor.activeSkills,
        actionCooldown: nextActionCooldown
    };
};

export const isFreeMoveMode = (state: GameState): boolean => {
    const hostiles = state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy');
    if (hostiles.length === 0) return true;
    if (!state.visibility) return false;

    return hostiles.every(enemy => {
        const awareness = state.visibility?.enemyAwarenessById?.[enemy.id];
        return !awareness
            || awareness.memoryTurnsRemaining <= 0
            || !awareness.lastKnownPlayerPosition;
    });
};

export const isEnemyAwareOfPlayer = (state: GameState, enemyId: string): boolean => {
    const awareness = state.visibility?.enemyAwarenessById?.[enemyId];
    return Boolean(
        awareness
        && awareness.memoryTurnsRemaining > 0
        && awareness.lastKnownPlayerPosition
    );
};

export const resolveFreeMoveInterruption = (
    state: GameState,
    path: Point[]
): { interrupted: boolean; destination: Point; spottedByEnemyId?: string } => {
    const fallbackDestination = path[path.length - 1] || state.player.position;
    if (!isFreeMoveMode(state) || path.length < 2) {
        return { interrupted: false, destination: fallbackDestination };
    }

    let simulatedState = state;
    const sortedHostiles = [...state.enemies]
        .filter(enemy => enemy.hp > 0 && enemy.factionId === 'enemy')
        .sort((a, b) => a.id.localeCompare(b.id));

    for (let i = 1; i < path.length; i++) {
        const step = path[i];
        simulatedState = recomputeVisibility({
            ...simulatedState,
            player: {
                ...simulatedState.player,
                previousPosition: simulatedState.player.position,
                position: step
            }
        });

        const spottingEnemy = sortedHostiles.find(enemy => {
            const awareness = simulatedState.visibility?.enemyAwarenessById?.[enemy.id];
            if (!awareness || awareness.memoryTurnsRemaining <= 0) return false;
            if (!awareness.lastKnownPlayerPosition) return false;
            return awareness.lastSeenTurn === simulatedState.turnNumber
                && hexEquals(awareness.lastKnownPlayerPosition, step);
        });

        if (spottingEnemy) {
            return {
                interrupted: true,
                destination: step,
                spottedByEnemyId: spottingEnemy.id
            };
        }
    }

    return { interrupted: false, destination: fallbackDestination };
};

export const resetCooldownsForFreeMove = (state: GameState): GameState => {
    if (!isFreeMoveMode(state)) return state;

    const nextPlayer = resetActorCooldowns(state.player);
    const nextCompanions = state.companions?.map(resetActorCooldowns);
    const nextTraps = state.traps?.map(t => (t.cooldown > 0 ? { ...t, cooldown: 0 } : t));

    const companionsChanged = !!state.companions && nextCompanions?.some((c, i) => c !== state.companions?.[i]);
    const trapsChanged = !!state.traps && nextTraps?.some((t, i) => t !== state.traps?.[i]);

    if (nextPlayer === state.player && !companionsChanged && !trapsChanged) return state;

    return {
        ...state,
        player: nextPlayer,
        ...(companionsChanged ? { companions: nextCompanions } : {}),
        ...(trapsChanged ? { traps: nextTraps } : {})
    };
};
