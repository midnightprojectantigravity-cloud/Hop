import { useEffect, useReducer, useRef } from 'react';
import {
  deriveMaxHpFromTrinity,
  ensureActorTrinity,
  ensurePlayerLoadoutIntegrity,
  gameReducer,
  generateHubState,
  pointToKey
} from '@hop/engine';
import type { Action, Actor, GameState } from '@hop/engine';

const toComponentMap = (components: unknown): Map<string, any> => {
  if (components instanceof Map) return components as Map<string, any>;
  if (Array.isArray(components)) return new Map(components as [string, any][]);
  if (components && typeof components === 'object') return new Map(Object.entries(components as Record<string, any>));
  return new Map();
};

const normalizeActor = (actor: any): Actor => {
  const withMap = { ...actor, components: toComponentMap(actor?.components) } as Actor;
  const withTrinity = ensureActorTrinity(withMap);
  const components = withTrinity.components ?? new Map<string, any>();
  const trinity = components.get('trinity') as { body: number; mind: number; instinct: number } | undefined;
  if (!trinity) return withTrinity;

  const maxHp = deriveMaxHpFromTrinity({
    body: Number(trinity.body || 0),
    mind: Number(trinity.mind || 0),
    instinct: Number(trinity.instinct || 0),
  });

  return {
    ...withTrinity,
    maxHp,
    hp: Math.min(maxHp, Math.max(0, Number(withTrinity.hp ?? maxHp))),
  };
};

const hydrateSavedState = (): GameState => {
  const saved = localStorage.getItem('hop_save');
  if (!saved) return generateHubState();

  try {
    const parsed = JSON.parse(saved);

    if (parsed.tiles) {
      const tileEntries = Array.isArray(parsed.tiles)
        ? parsed.tiles
        : Object.entries(parsed.tiles);

      parsed.tiles = new Map(
        tileEntries.map(([key, tile]: [string, any]) => [
          key,
          {
            ...tile,
            traits: new Set(tile.traits)
          }
        ])
      );
    }

    if (Array.isArray(parsed.occupancyMask)) {
      parsed.occupancyMask = parsed.occupancyMask.map((v: any) =>
        typeof v === 'string' ? BigInt(v) : v
      );
    }

    parsed.player = ensurePlayerLoadoutIntegrity(normalizeActor(parsed.player));
    parsed.enemies = Array.isArray(parsed.enemies) ? parsed.enemies.map(normalizeActor) : [];

    return parsed as GameState;
  } catch (e) {
    console.error('Failed to hydrate Map state:', e);
    return generateHubState();
  }
};

export const usePersistedGameState = (): [GameState, React.Dispatch<Action>] => {
  const [gameState, dispatch] = useReducer(gameReducer, null, hydrateSavedState);
  const persistSaveJobRef = useRef<number | null>(null);
  const lastPersistedSignatureRef = useRef<string>('');

  const isSaveEligible = gameState.gameStatus === 'playing' || gameState.gameStatus === 'choosing_upgrade';
  const saveSignature = `${gameState.gameStatus}|${gameState.floor}|${gameState.turnNumber}|${gameState.player.hp}|${pointToKey(gameState.player.position)}|${gameState.enemies.length}|${gameState.actionLog?.length ?? 0}|${gameState.message?.length ?? 0}`;

  useEffect(() => {
    if (persistSaveJobRef.current !== null) {
      if (typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(persistSaveJobRef.current);
      } else {
        window.clearTimeout(persistSaveJobRef.current);
      }
      persistSaveJobRef.current = null;
    }

    if (!isSaveEligible) {
      lastPersistedSignatureRef.current = '';
      localStorage.removeItem('hop_save');
      return;
    }

    if (saveSignature === lastPersistedSignatureRef.current) {
      return;
    }

    const persist = () => {
      const stateToSave = {
        ...gameState,
        tiles: Array.from(gameState.tiles.entries()).map(([key, tile]) => [
          key,
          {
            ...tile,
            traits: Array.from(tile.traits)
          }
        ])
      };

      const safeStringify = (obj: any) =>
        JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));

      localStorage.setItem('hop_save', safeStringify(stateToSave));
      lastPersistedSignatureRef.current = saveSignature;
      persistSaveJobRef.current = null;
    };

    if (typeof (window as any).requestIdleCallback === 'function') {
      persistSaveJobRef.current = (window as any).requestIdleCallback(persist, { timeout: 500 });
    } else {
      persistSaveJobRef.current = window.setTimeout(persist, 120);
    }

    return () => {
      if (persistSaveJobRef.current !== null) {
        if (typeof (window as any).cancelIdleCallback === 'function') {
          (window as any).cancelIdleCallback(persistSaveJobRef.current);
        } else {
          window.clearTimeout(persistSaveJobRef.current);
        }
        persistSaveJobRef.current = null;
      }
    };
  }, [gameState, isSaveEligible, saveSignature]);

  return [gameState, dispatch];
};
