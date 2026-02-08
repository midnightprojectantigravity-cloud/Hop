import type { Actor, AtomicEffect, GameState, IntentPreview, Point, TelegraphProjectionEntry } from '../types';
import type { Intent } from '../types/intent';
import { pointToKey } from './unified-tile-service';
import { StrategyRegistry } from './strategy-registry';
import { processIntent } from './intent-middleware';
import { TacticalEngine } from './tactical-engine';
import { getActorAt } from '../helpers';

const byPoint = (a: Point, b: Point) => {
    if (a.q !== b.q) return a.q - b.q;
    if (a.r !== b.r) return a.r - b.r;
    return a.s - b.s;
};

const getActorById = (state: GameState, id: string): Actor | undefined => {
    if (state.player.id === id) return state.player;
    return state.enemies.find(e => e.id === id) || state.companions?.find(c => c.id === id);
};

const resolveTargetActor = (state: GameState, intent: Intent): Actor | undefined => {
    if (intent.primaryTargetId) {
        return getActorById(state, intent.primaryTargetId);
    }
    if (intent.targetHex) {
        return getActorAt(state, intent.targetHex);
    }
    return undefined;
};

const collectDangerTiles = (state: GameState, intent: Intent, effects: AtomicEffect[]): Point[] => {
    const tiles = new Map<string, Point>();
    const resolvedTarget = resolveTargetActor(state, intent);

    const addPoint = (p?: Point) => {
        if (!p) return;
        tiles.set(pointToKey(p), p);
    };

    effects.forEach(effect => {
        if (effect.type === 'Damage') {
            if (typeof effect.target === 'string' && effect.target !== 'targetActor' && effect.target !== 'area') {
                addPoint(getActorById(state, effect.target)?.position);
            } else if (effect.target === 'targetActor') {
                addPoint(resolvedTarget?.position);
            } else if (effect.target === 'area') {
                addPoint(effect.source);
            } else if (typeof effect.target === 'object' && 'q' in effect.target) {
                addPoint(effect.target);
            }
        } else if (effect.type === 'Impact') {
            addPoint(getActorById(state, effect.target)?.position);
        } else if (effect.type === 'LavaSink') {
            addPoint(getActorById(state, effect.target)?.position);
        } else if (effect.type === 'Displacement') {
            addPoint(effect.destination);
        }
    });

    return [...tiles.values()].sort(byPoint);
};

export const buildIntentPreview = (state: GameState): IntentPreview => {
    const entries: TelegraphProjectionEntry[] = [];

    // Project only hostile actors so UI can draw "incoming danger" tiles.
    const hostiles = state.enemies.filter(e => e.hp > 0 && e.factionId !== state.player.factionId);

    hostiles.forEach(actor => {
        const strategy = StrategyRegistry.resolve(actor);
        const rawIntent = strategy.getIntent(state, actor);
        if (rawIntent instanceof Promise) return;

        const intent = processIntent(rawIntent, state, actor);
        let simulatedIntent = intent;
        // Playlist rule: telegraph previews must show the execute footprint.
        if (intent.skillId === 'SENTINEL_TELEGRAPH') {
            simulatedIntent = {
                ...intent,
                skillId: 'SENTINEL_BLAST'
            };
        }

        const simulation = TacticalEngine.simulate(simulatedIntent, actor, state);
        const dangerTiles = collectDangerTiles(state, simulatedIntent, simulation.effects);
        if (dangerTiles.length === 0) return;

        entries.push({
            actorId: actor.id,
            skillId: intent.skillId,
            targetHex: intent.targetHex,
            dangerTiles
        });
    });

    entries.sort((a, b) => {
        if (a.actorId !== b.actorId) return a.actorId.localeCompare(b.actorId);
        if (a.skillId !== b.skillId) return a.skillId.localeCompare(b.skillId);
        if (!a.targetHex && !b.targetHex) return 0;
        if (!a.targetHex) return -1;
        if (!b.targetHex) return 1;
        return byPoint(a.targetHex, b.targetHex);
    });

    const union = new Map<string, Point>();
    entries.forEach(entry => entry.dangerTiles.forEach(tile => union.set(pointToKey(tile), tile)));

    return {
        sourceTurn: state.turnNumber,
        dangerTiles: [...union.values()].sort(byPoint),
        projections: entries
    };
};
