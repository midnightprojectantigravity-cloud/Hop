import type { Actor, AtomicEffect, GameState, Point, SimulationEvent, StackResolutionTick } from '../types';
import { pointToKey } from '../hex';
import { getActorAt } from '../helpers';
import { SkillRegistry } from '../skillRegistry';
import { applyEffects } from './effect-engine';

export interface ActionPreviewRequest {
    actorId: string;
    skillId: string;
    target?: Point;
    activeUpgrades?: string[];
    context?: Record<string, any>;
}

export interface ActionPreviewResult {
    ok: boolean;
    reason?: string;
    effects: AtomicEffect[];
    messages: string[];
    consumesTurn?: boolean;
    predictedState?: GameState;
    simulationEvents: SimulationEvent[];
    stackTrace: StackResolutionTick[];
}

export interface MovementPreviewPathResult {
    ok: boolean;
    reason?: string;
    path: Point[];
    destination: Point;
    interrupted: boolean;
    spottedByEnemyId?: string;
}

const clonePoint = (p: Point): Point => ({ q: p.q, r: p.r, s: p.s });

const cloneComponents = (components: Actor['components'] | Record<string, any> | undefined): Actor['components'] | undefined => {
    if (!components) return undefined;
    if (components instanceof Map) {
        return new Map(Array.from(components.entries()).map(([k, v]) => [k, typeof v === 'object' && v !== null ? { ...v } : v])) as Actor['components'];
    }
    if (Array.isArray(components)) {
        return new Map(components as any) as Actor['components'];
    }
    if (typeof components === 'object') {
        return new Map(
            Object.entries(components).map(([k, v]) => [k, typeof v === 'object' && v !== null ? { ...(v as any) } : v])
        ) as Actor['components'];
    }
    return undefined;
};

const cloneActor = (actor: Actor): Actor => ({
    ...actor,
    position: clonePoint(actor.position),
    previousPosition: actor.previousPosition ? clonePoint(actor.previousPosition) : undefined,
    intentPosition: actor.intentPosition ? clonePoint(actor.intentPosition) : undefined,
    statusEffects: actor.statusEffects.map(s => ({ ...s })),
    activeSkills: actor.activeSkills.map(s => ({
        ...s,
        upgrades: [...(s.upgrades || [])],
        activeUpgrades: [...(s.activeUpgrades || [])]
    })),
    components: cloneComponents(actor.components as any),
    companionState: actor.companionState
        ? {
            ...actor.companionState,
            markTarget: typeof actor.companionState.markTarget === 'object' && actor.companionState.markTarget
                ? clonePoint(actor.companionState.markTarget as Point)
                : actor.companionState.markTarget
        }
        : undefined
});

const cloneVisibility = (visibility: GameState['visibility']): GameState['visibility'] => {
    if (!visibility) return visibility;
    const enemyAwarenessById = Object.fromEntries(
        Object.entries(visibility.enemyAwarenessById || {}).map(([enemyId, awareness]) => [
            enemyId,
            {
                ...awareness,
                lastKnownPlayerPosition: awareness.lastKnownPlayerPosition
                    ? clonePoint(awareness.lastKnownPlayerPosition)
                    : null
            }
        ])
    );
    return {
        playerFog: {
            visibleTileKeys: [...(visibility.playerFog.visibleTileKeys || [])],
            exploredTileKeys: [...(visibility.playerFog.exploredTileKeys || [])],
            visibleActorIds: [...(visibility.playerFog.visibleActorIds || [])],
            detectedActorIds: [...(visibility.playerFog.detectedActorIds || [])]
        },
        enemyAwarenessById
    };
};

const cloneStateForPreview = (state: GameState): GameState => ({
    ...state,
    player: cloneActor(state.player),
    enemies: state.enemies.map(cloneActor),
    companions: state.companions?.map(cloneActor),
    dyingEntities: state.dyingEntities?.map(cloneActor),
    message: [...state.message],
    visualEvents: [...(state.visualEvents || [])],
    simulationEvents: [...(state.simulationEvents || [])],
    stackTrace: state.stackTrace ? state.stackTrace.map(t => ({ ...t })) : undefined,
    timelineEvents: state.timelineEvents ? state.timelineEvents.map(ev => ({ ...ev })) : undefined,
    occupancyMask: [...state.occupancyMask],
    tiles: new Map(
        Array.from(state.tiles.entries()).map(([key, tile]) => [
            key,
            {
                ...tile,
                position: clonePoint(tile.position),
                traits: new Set(tile.traits),
                effects: tile.effects.map(e => ({ ...e }))
            }
        ])
    ),
    traps: state.traps?.map(t => ({ ...t, position: clonePoint(t.position) })),
    lastSpearPath: state.lastSpearPath?.map(clonePoint),
    actionLog: state.actionLog ? [...state.actionLog] : undefined,
    visibility: cloneVisibility(state.visibility)
});

const resolveActorById = (state: GameState, actorId: string): Actor | undefined => {
    if (state.player.id === actorId) return state.player;
    return state.enemies.find(e => e.id === actorId) || state.companions?.find(e => e.id === actorId);
};

const resolveTargetId = (state: GameState, target?: Point): string | undefined => {
    if (!target) return undefined;
    return getActorAt(state, target)?.id;
};

export const previewActionOutcome = (
    state: GameState,
    request: ActionPreviewRequest
): ActionPreviewResult => {
    const actor = resolveActorById(state, request.actorId);
    if (!actor) {
        return { ok: false, reason: `Actor ${request.actorId} not found`, effects: [], messages: [], simulationEvents: [], stackTrace: [] };
    }

    const skillDef = SkillRegistry.get(request.skillId);
    if (!skillDef) {
        return { ok: false, reason: `Skill ${request.skillId} not found`, effects: [], messages: [], simulationEvents: [], stackTrace: [] };
    }

    if (request.target && skillDef.getValidTargets) {
        const valid = skillDef.getValidTargets(state, actor.position).some(p => pointToKey(p) === pointToKey(request.target as Point));
        if (!valid) {
            return { ok: false, reason: `Target ${pointToKey(request.target)} is invalid`, effects: [], messages: [], simulationEvents: [], stackTrace: [] };
        }
    }

    if (request.target && actor.id === state.player.id && state.visibility) {
        const targetActor = getActorAt(state, request.target);
        if (targetActor && targetActor.factionId !== actor.factionId) {
            const visible = new Set(state.visibility.playerFog.visibleActorIds || []);
            const detected = new Set(state.visibility.playerFog.detectedActorIds || []);
            if (!visible.has(targetActor.id) && !detected.has(targetActor.id)) {
                return {
                    ok: false,
                    reason: `Target ${targetActor.id} is outside current perception`,
                    effects: [],
                    messages: [],
                    simulationEvents: [],
                    stackTrace: []
                };
            }
        }
    }

    const previewState = cloneStateForPreview(state);
    const previewActor = resolveActorById(previewState, request.actorId) as Actor;
    const execution = skillDef.execute(
        previewState,
        previewActor,
        request.target,
        request.activeUpgrades || [],
        request.context || {}
    );

    const beforeEvents = previewState.simulationEvents?.length || 0;
    const beforeTrace = previewState.stackTrace?.length || 0;
    const targetId = resolveTargetId(previewState, request.target);
    const resolvedState = applyEffects(previewState, execution.effects, {
        sourceId: previewActor.id,
        targetId,
        stackReactions: execution.stackReactions
    });

    return {
        ok: true,
        effects: execution.effects,
        messages: execution.messages,
        consumesTurn: execution.consumesTurn,
        predictedState: resolvedState,
        simulationEvents: (resolvedState.simulationEvents || []).slice(beforeEvents),
        stackTrace: (resolvedState.stackTrace || []).slice(beforeTrace)
    };
};

const cloneMovementPath = (path: Point[] | undefined, origin: Point, destination: Point): Point[] => {
    if (Array.isArray(path) && path.length > 1) {
        return path.map(clonePoint);
    }
    return [clonePoint(origin), clonePoint(destination)];
};

export const resolveMovementPreviewPath = (
    state: GameState,
    actor: Actor,
    skillId: 'BASIC_MOVE' | 'DASH' | 'JUMP',
    target: Point
): MovementPreviewPathResult => {
    const actorSkill = actor.activeSkills.find(skill => skill.id === skillId);
    const preview = previewActionOutcome(state, {
        actorId: actor.id,
        skillId,
        target,
        activeUpgrades: actorSkill?.activeUpgrades || []
    });

    if (!preview.ok) {
        return {
            ok: false,
            reason: preview.reason,
            path: [clonePoint(actor.position)],
            destination: clonePoint(actor.position),
            interrupted: false
        };
    }

    const displacement = preview.effects.find((effect): effect is Extract<AtomicEffect, { type: 'Displacement' }> => {
        if (effect.type !== 'Displacement') return false;
        if (effect.target === 'self') return true;
        return typeof effect.target === 'string' && effect.target === actor.id;
    });

    if (!displacement) {
        return {
            ok: false,
            reason: `No displacement effect produced by ${skillId}`,
            path: [clonePoint(actor.position)],
            destination: clonePoint(actor.position),
            interrupted: false
        };
    }

    const destination = clonePoint(displacement.destination);
    const path = cloneMovementPath(displacement.path, actor.position, displacement.destination);
    const interrupted = pointToKey(destination) !== pointToKey(target);

    return {
        ok: true,
        path,
        destination,
        interrupted
    };
};
