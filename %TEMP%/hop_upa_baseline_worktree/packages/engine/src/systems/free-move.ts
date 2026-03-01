import type { Actor, GameState, Skill } from '../types';

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
    const hostileCount = state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy').length;
    return hostileCount === 0;
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

