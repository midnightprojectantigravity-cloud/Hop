/**
 * TODO:
 * Understood. Since `migratePositionArraysToTiles` is fully deprecated and removed from the engine, your `App.tsx` needs to pivot from "migration mode" to "native Tile mode."
 * 
 * The logic you have in your `useReducer` initializer is currently trying to call a ghost function. Given that you're working with a **flat-top hex grid** and a **headless engine** for skill validation, keeping your local storage synchronization clean is vital.
 * 
 *  ### 🛠️ The Fix: Native Map Restoration
 * 
 *  Since `localStorage` cannot natively store a JavaScript `Map`, you should handle the conversion directly within the `App.tsx` initialization logic.
 * 
 *  **Replace your `useReducer` init block with this:**
 * 
 *  ```typescript
 *  const [gameState, dispatch] = useReducer(gameReducer, null, () => {
 *    const saved = localStorage.getItem('hop_save');
 *    if (saved) {
 *      try {
 *        const parsed = JSON.parse(saved);
 * 
 *        // 1. Restore BigInt Array (Occupancy Mask)
 *        if (parsed && Array.isArray(parsed.occupancyMask)) {
 *          parsed.occupancyMask = parsed.occupancyMask.map((v: any) => 
 *            typeof v === 'string' ? BigInt(v) : v
 *          );
 *        }
 * 
 *        // 2. Map Restoration (Unified Tile Service)
 *        // If tiles were saved as an array of entries [[key, value], ...], restore to Map
 *        if (Array.isArray(parsed.tiles)) {
 *          parsed.tiles = new Map(parsed.tiles);
 *        } else if (!parsed.tiles || typeof parsed.tiles !== 'object') {
 *          // Fallback for totally broken/empty tile states
 *          parsed.tiles = new Map();
 *        }
 * 
 *        const isCompatible = parsed.gridWidth === GRID_WIDTH && parsed.gridHeight === GRID_HEIGHT;
 *        if (isCompatible && (parsed.gameStatus === 'playing' || parsed.gameStatus === 'choosing_upgrade')) {
 *          return parsed;
 *        }
 *      } catch (e) {
 *        console.error('Failed to load save', e);
 *      }
 *    }
 *    return generateHubState();
 *  });
 * 
 *  ```
 * 
 *  ### 💾 Saving the Map correctly
 * 
 *  To ensure `JSON.stringify` doesn't turn your `tiles` Map into an empty object `{}`, you need to convert it to an array of entries before it hits `localStorage`.
 * 
 *  **Update your `useEffect` save hook:**
 * 
 *  ```typescript
 *  useEffect(() => {
 *    if (gameState.gameStatus === 'playing' || gameState.gameStatus === 'choosing_upgrade') {
 *      const stateToSave = {
 *        ...gameState,
 *        // Convert Map to Array for JSON serialization
 *        tiles: Array.from(gameState.tiles.entries()) 
 *      };
 * 
 *      const safeStringify = (obj: any) => 
 *        JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
 *      
 *      localStorage.setItem('hop_save', safeStringify(stateToSave));
 *    } else {
 *      localStorage.removeItem('hop_save');
 *    }
 *  }, [gameState]);
 * 
 *  ```
 * 
 *  ### Why this matters for your 2026 Engine
 * 
 *  * **Skill Mechanics Validation**: If the tiles aren't restored as a proper `Map`, your `SpatialSystem.isWalkable` calls will crash, breaking the automated testing framework you're building for skill balancing.
 *  * **Headless Parity**: By using `Array.from(tiles.entries())`, you ensure that the state format in your browser matches the JSON snapshots used in your vitest suites.
 * 
 *  Now that the legacy migration code is purged, would you like me to help you streamline the **Replay System** to ensure it correctly captures these new `Map`-based tile updates for deterministic playback?
 * 
 */


import { useReducer, useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { GameBoard } from './components/GameBoard';
import { UI } from './components/UI';
import { UpgradeOverlay } from './components/UpgradeOverlay';
import { SkillTray } from './components/SkillTray';
import { gameReducer, generateInitialState, generateHubState, hexEquals, pointToKey, ensureActorTrinity, deriveMaxHpFromTrinity, DEFAULT_LOADOUTS, validateReplayActions, ensurePlayerLoadoutIntegrity } from '@hop/engine';
import type { Point, Action, GameState, Actor, TimelineEvent } from '@hop/engine';
import type { ReplayRecord } from './components/ReplayManager';
import { isPlayerTurn } from '@hop/engine';
import { Hub } from './components/Hub';
import { ArcadeHub } from './components/ArcadeHub';
import { deriveTurnDriverState } from './turn-driver';

type TurnTraceEntry = {
  id: number;
  t: number;
  event: string;
  turnNumber: number;
  phase: string;
  gameStatus: string;
  playerTurn: boolean;
  isBusy: boolean;
  postCommitInputLock: boolean;
  pendingStatus: string;
  pendingFrames: number;
  canPlayerInput: boolean;
  shouldAdvanceQueue: boolean;
  shouldResolvePending: boolean;
  actionLogLength: number;
  queueHead: string;
  details?: Record<string, unknown>;
};

const summarizeActionPayload = (action: Action): Record<string, unknown> | undefined => {
  const payload = (action as any).payload;
  if (!payload || typeof payload !== 'object') return undefined;

  if ('q' in payload && 'r' in payload) {
    return {
      q: Number((payload as any).q ?? 0),
      r: Number((payload as any).r ?? 0),
      s: Number((payload as any).s ?? 0)
    };
  }

  if ((action as any).type === 'USE_SKILL') {
    const p = payload as any;
    return {
      skillId: p.skillId ?? 'unknown',
      target: p.target ? { q: p.target.q, r: p.target.r, s: p.target.s } : null
    };
  }

  if ((action as any).type === 'START_RUN') {
    return {
      loadoutId: (payload as any).loadoutId ?? 'unknown',
      mode: (payload as any).mode ?? 'normal'
    };
  }

  if ((action as any).type === 'LOAD_STATE') {
    const state = payload as any;
    return {
      floor: state?.floor ?? 0,
      gameStatus: state?.gameStatus ?? 'unknown',
      turnNumber: state?.turnNumber ?? 0,
      queueLength: Array.isArray(state?.initiativeQueue) ? state.initiativeQueue.length : 0
    };
  }

  return {};
};

function App() {
  const buildReplayDiagnostics = (actions: Action[], floor: number) => {
    const types = new Set(actions.map(a => a.type));
    const hasTurnAdvance = types.has('ADVANCE_TURN');
    const hasPendingResolve = types.has('RESOLVE_PENDING');
    const actionCount = actions.length;
    const suspiciouslyShort = floor >= 5 && actionCount < Math.max(25, floor * 4);
    return { actionCount, hasTurnAdvance, hasPendingResolve, suspiciouslyShort };
  };

  const getVisualEventsSignature = (events: Array<{ type: string; payload: any }> | undefined): string => {
    const arr = events || [];
    const last = arr.length > 0 ? arr[arr.length - 1] : undefined;
    return `${arr.length}:${last?.type ?? 'none'}`;
  };

  const getTimelineEventsSignature = (events: TimelineEvent[] | undefined): string => {
    const arr = events || [];
    const last = arr.length > 0 ? arr[arr.length - 1] : undefined;
    return `${arr.length}:${last?.id ?? 'none'}:${last?.phase ?? 'none'}`;
  };

  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setPathname(path);
  };

  const hubBase = pathname.toLowerCase().startsWith('/hop') ? '/Hop' : '';
  const hubPath = `${hubBase || ''}` || '/';
  const arcadePath = `${hubBase}/Arcade` || '/Arcade';
  const isArcadeRoute = pathname.toLowerCase().endsWith('/arcade') || pathname.toLowerCase().endsWith('/arcarde');

  // packages/web/src/App.tsx

  const [gameState, dispatch] = useReducer(gameReducer, null, () => {
    const saved = localStorage.getItem('hop_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        // 1. Check if tiles exists and convert it to a Map
        if (parsed.tiles) {
          const tileEntries = Array.isArray(parsed.tiles)
            ? parsed.tiles
            : Object.entries(parsed.tiles);

          // Convert entries to Map AND convert trait arrays back to Sets
          parsed.tiles = new Map(
            tileEntries.map(([key, tile]: [string, any]) => [
              key,
              {
                ...tile,
                traits: new Set(tile.traits) // Convert Array -> Set
              }
            ])
          );
        }

        // 2. BigInt restoration for the occupancy mask
        if (Array.isArray(parsed.occupancyMask)) {
          parsed.occupancyMask = parsed.occupancyMask.map((v: any) =>
            typeof v === 'string' ? BigInt(v) : v
          );
        }

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

        parsed.player = ensurePlayerLoadoutIntegrity(normalizeActor(parsed.player));
        parsed.enemies = Array.isArray(parsed.enemies) ? parsed.enemies.map(normalizeActor) : [];

        return parsed;
      } catch (e) {
        console.error('Failed to hydrate Map state:', e);
      }
    }
    return generateHubState();
  });

  const isDebugQueryEnabled = typeof window !== 'undefined' && Boolean((window as any).__HOP_DEBUG_QUERY);

  useEffect(() => {
    if (!isDebugQueryEnabled) return;
    (window as any).state = gameState;
    (window as any).QUERY = {
      // Direct tile lookup
      tile: (q: number, r: number) => {
        const p: Point = { q, r, s: -q - r };
        const key = pointToKey(p);
        console.log(`Checking Map for Key: "${key}"`);
        return gameState.tiles.get(key);
      },
      // NEW: Find where the player is according to the engine
      whereAmI: () => {
        const p = gameState.player.position;
        const key = pointToKey(p);
        const tile = gameState.tiles.get(key);
        return {
          coords: p,
          key: key,
          tileExists: !!tile,
          tileData: tile
        };
      },
      // NEW: See all keys currently in the map to spot patterns
      dumpKeys: () => Array.from(gameState.tiles.keys())
    };
  }, [gameState, isDebugQueryEnabled]);

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
            traits: Array.from(tile.traits) // Convert Set -> Array
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

  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replayActions, setReplayActions] = useState<Action[]>([]);
  const [replayActive, setReplayActive] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const replayIndexRef = useRef(0);
  const lastRecordedRunRef = useRef<string | null>(null);

  useEffect(() => {
    const enabled = typeof window !== 'undefined' && Boolean((window as any).__HOP_DEBUG_PERF);
    if (!enabled) return;
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let totalMs = 0;
    let windowStart = last;
    const tick = (ts: number) => {
      const dt = ts - last;
      last = ts;
      frames++;
      totalMs += dt;
      if (ts - windowStart >= 2000) {
        const avgMs = totalMs / Math.max(1, frames);
        const fps = 1000 / Math.max(1, avgMs);
        console.log('[HOP_PERF]', { fps: Number(fps.toFixed(1)), avgFrameMs: Number(avgMs.toFixed(2)), frames });
        windowStart = ts;
        frames = 0;
        totalMs = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gameState.gameStatus, isReplayMode]);

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [showMovementRange, setShowMovementRange] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [postCommitInputLock, setPostCommitInputLock] = useState(false);
  const [postCommitTick, setPostCommitTick] = useState(0);
  const commitLockTurnRef = useRef<number | null>(null);
  const commitLockActionLenRef = useRef<number | null>(null);
  const postCommitLockedAtRef = useRef<number | null>(null);
  const postCommitWatchdogRef = useRef<number | null>(null);
  const pendingFrameCount = gameState.pendingFrames?.length ?? 0;
  const turnDriver = useMemo(() => deriveTurnDriverState({
    gameStatus: gameState.gameStatus,
    isReplayMode,
    isBusy,
    postCommitInputLock,
    isPlayerTurn: isPlayerTurn(gameState),
    hasPendingStatus: Boolean(gameState.pendingStatus),
    pendingFrameCount
  }), [gameState.gameStatus, isReplayMode, isBusy, postCommitInputLock, gameState.pendingStatus, pendingFrameCount, gameState.initiativeQueue, gameState.player.id, gameState.enemies]);
  const isInputLocked = !turnDriver.canPlayerInput;
  const turnTraceRef = useRef<TurnTraceEntry[]>([]);
  const turnTraceSeqRef = useRef(0);
  const lastDriverSignatureRef = useRef('');
  const queueHead = gameState.initiativeQueue?.entries?.[
    Math.max(0, gameState.initiativeQueue.currentIndex ?? 0)
  ]?.actorId
    ?? gameState.initiativeQueue?.entries?.[0]?.actorId
    ?? 'none';

  const appendTurnTrace = useCallback((event: string, details?: Record<string, unknown>) => {
    const entry: TurnTraceEntry = {
      id: ++turnTraceSeqRef.current,
      t: Date.now(),
      event,
      turnNumber: gameState.turnNumber,
      phase: turnDriver.phase,
      gameStatus: gameState.gameStatus,
      playerTurn: isPlayerTurn(gameState),
      isBusy,
      postCommitInputLock,
      pendingStatus: gameState.pendingStatus?.status ?? 'none',
      pendingFrames: gameState.pendingFrames?.length ?? 0,
      canPlayerInput: turnDriver.canPlayerInput,
      shouldAdvanceQueue: turnDriver.shouldAdvanceQueue,
      shouldResolvePending: turnDriver.shouldResolvePending,
      actionLogLength: gameState.actionLog?.length ?? 0,
      queueHead,
      details
    };
    turnTraceRef.current.push(entry);
    if (turnTraceRef.current.length > 800) {
      turnTraceRef.current.splice(0, turnTraceRef.current.length - 800);
    }
  }, [
    gameState.turnNumber,
    gameState.gameStatus,
    gameState.pendingStatus,
    gameState.pendingFrames,
    gameState.actionLog,
    gameState.initiativeQueue,
    gameState.player.id,
    gameState.enemies,
    turnDriver.phase,
    turnDriver.canPlayerInput,
    turnDriver.shouldAdvanceQueue,
    turnDriver.shouldResolvePending,
    isBusy,
    postCommitInputLock,
    queueHead
  ]);

  const dispatchWithTrace = useCallback((action: Action, source: string) => {
    appendTurnTrace('DISPATCH', {
      source,
      actionType: action.type,
      payload: summarizeActionPayload(action)
    });
    dispatch(action);
  }, [appendTurnTrace]);

  useEffect(() => {
    const signature = [
      turnDriver.phase,
      gameState.turnNumber,
      gameState.gameStatus,
      gameState.pendingStatus?.status ?? 'none',
      gameState.pendingFrames?.length ?? 0,
      isBusy ? 1 : 0,
      postCommitInputLock ? 1 : 0,
      queueHead
    ].join('|');
    if (signature !== lastDriverSignatureRef.current) {
      appendTurnTrace('TURN_STATE');
      lastDriverSignatureRef.current = signature;
    }
  }, [
    turnDriver.phase,
    gameState.turnNumber,
    gameState.gameStatus,
    gameState.pendingStatus,
    gameState.pendingFrames,
    isBusy,
    postCommitInputLock,
    queueHead,
    appendTurnTrace
  ]);

  useEffect(() => {
    (window as any).__HOP_TURN_TRACE = turnTraceRef.current;
    (window as any).__HOP_DUMP_TURN_TRACE = () => [...turnTraceRef.current];
    (window as any).__HOP_PRINT_TURN_TRACE = (limit: number = 80) => {
      const rows = turnTraceRef.current.slice(-Math.max(1, Math.floor(limit)));
      console.table(rows.map(r => ({
        id: r.id,
        event: r.event,
        turn: r.turnNumber,
        phase: r.phase,
        status: r.gameStatus,
        playerTurn: r.playerTurn,
        busy: r.isBusy,
        lock: r.postCommitInputLock,
        pending: `${r.pendingStatus}/${r.pendingFrames}`,
        queueHead: r.queueHead,
        actionLog: r.actionLogLength,
        details: r.details ? JSON.stringify(r.details) : ''
      })));
      return rows;
    };
    (window as any).__HOP_CLEAR_TURN_TRACE = () => {
      turnTraceRef.current.length = 0;
      turnTraceSeqRef.current = 0;
    };
    turnTraceRef.current.push({
      id: ++turnTraceSeqRef.current,
      t: Date.now(),
      event: 'TRACE_READY',
      turnNumber: 0,
      phase: 'INIT',
      gameStatus: 'init',
      playerTurn: false,
      isBusy: false,
      postCommitInputLock: false,
      pendingStatus: 'none',
      pendingFrames: 0,
      canPlayerInput: false,
      shouldAdvanceQueue: false,
      shouldResolvePending: false,
      actionLogLength: 0,
      queueHead: 'none'
    });
    return () => {
      delete (window as any).__HOP_DUMP_TURN_TRACE;
      delete (window as any).__HOP_PRINT_TURN_TRACE;
      delete (window as any).__HOP_CLEAR_TURN_TRACE;
    };
  }, []);

  useEffect(() => {
    if (!turnDriver.shouldAdvanceQueue) return;
    appendTurnTrace('QUEUE_SCHEDULE', { delayMs: turnDriver.queueAdvanceDelayMs });

    // One-shot queue pump with explicit driver phase gate.
    const timer = window.setTimeout(() => {
      dispatchWithTrace({ type: 'ADVANCE_TURN' }, 'queue_pump');
    }, turnDriver.queueAdvanceDelayMs);
    return () => window.clearTimeout(timer);
  }, [turnDriver.shouldAdvanceQueue, turnDriver.queueAdvanceDelayMs, gameState.turnNumber, gameState.initiativeQueue, gameState.player.id, gameState.enemies, dispatchWithTrace, appendTurnTrace]);

  const clearPostCommitLock = (reason: string = 'unknown') => {
    if (postCommitInputLock) {
      appendTurnTrace('LOCK_RELEASE', {
        reason,
        lockTurn: commitLockTurnRef.current,
        expectedActionLogLength: commitLockActionLenRef.current
      });
    }
    setPostCommitInputLock(false);
    commitLockTurnRef.current = null;
    commitLockActionLenRef.current = null;
    postCommitLockedAtRef.current = null;
    postCommitObservedBusyRef.current = false;
    postCommitEventHashAtArmRef.current = '';
    postCommitTimelineHashAtArmRef.current = '';
    if (postCommitWatchdogRef.current !== null) {
      window.clearTimeout(postCommitWatchdogRef.current);
      postCommitWatchdogRef.current = null;
    }
  };

  const lastProcessedEventsHash = useRef('');
  const currentEventsHash = getVisualEventsSignature(gameState.visualEvents);
  const lastProcessedTimelineHash = useRef('');
  const currentTimelineHash = getTimelineEventsSignature(gameState.timelineEvents);
  const postCommitObservedBusyRef = useRef(false);
  const postCommitEventHashAtArmRef = useRef('');
  const postCommitTimelineHashAtArmRef = useRef('');
  const POST_COMMIT_MIN_LOCK_MS = 220;
  const POST_COMMIT_BUSY_WAIT_TIMEOUT_MS = 900;
  const pendingObservedBusy = useRef(false);
  const pendingResolveStartedAtRef = useRef<number>(0);
  const pendingInterceptSignature = `${gameState.pendingStatus?.status ?? 'none'}:${pendingFrameCount}`;

  // Update processed hash when animations settle
  useEffect(() => {
    if (!isBusy) {
      lastProcessedEventsHash.current = currentEventsHash;
      lastProcessedTimelineHash.current = currentTimelineHash;
    }
  }, [isBusy, currentEventsHash, currentTimelineHash]);

  useEffect(() => {
    pendingObservedBusy.current = false;
    pendingResolveStartedAtRef.current = performance.now();
  }, [pendingInterceptSignature]);

  useEffect(() => {
    if ((gameState.pendingStatus || pendingFrameCount > 0) && isBusy) {
      pendingObservedBusy.current = true;
    }
  }, [gameState.pendingStatus, pendingFrameCount, isBusy]);

  useEffect(() => {
    if (!postCommitInputLock) return;
    if (isBusy) {
      postCommitObservedBusyRef.current = true;
    }
  }, [postCommitInputLock, isBusy]);

  useEffect(() => {
    if (!postCommitInputLock) return;
    const timer = window.setTimeout(() => {
      setPostCommitTick(v => v + 1);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [postCommitInputLock, postCommitTick]);

  // Auto-resolve pending transitions when animations settle
  useEffect(() => {
    const noPendingAnimations =
      !isBusy
      && (currentEventsHash === lastProcessedEventsHash.current)
      && (currentTimelineHash === lastProcessedTimelineHash.current);
    const hasBlockingTimeline = (gameState.timelineEvents || []).some(ev => ev.blocking);
    const blockingDurationMs = (gameState.timelineEvents || [])
      .filter(ev => ev.blocking)
      .reduce((sum, ev) => sum + (ev.suggestedDurationMs || 0), 0);
    const movementTraceBudgetMs = (gameState.visualEvents || []).reduce((maxMs, ev) => {
      if (ev.type !== 'kinetic_trace') return maxMs;
      const trace = ev.payload as { startDelayMs?: number; durationMs?: number } | undefined;
      if (!trace) return maxMs;
      const startDelayMs = Math.max(0, Number(trace.startDelayMs || 0));
      const durationMs = Math.max(0, Number(trace.durationMs || 0));
      return Math.max(maxMs, startDelayMs + durationMs);
    }, 0);
    const interactionBudgetMs = Math.max(blockingDurationMs, movementTraceBudgetMs);
    const requiredFallbackDelayMs = interactionBudgetMs > 0
      ? Math.max(160, Math.min(3200, interactionBudgetMs + 40))
      : 0;
    const elapsedPendingMs = Math.max(0, performance.now() - pendingResolveStartedAtRef.current);
    const canResolveByBusySignal = !hasBlockingTimeline || pendingObservedBusy.current;
    const canResolveByFallbackDelay = !hasBlockingTimeline || elapsedPendingMs >= requiredFallbackDelayMs;
    const readyForResolve = noPendingAnimations && (canResolveByBusySignal || canResolveByFallbackDelay);

    if (!turnDriver.shouldResolvePending) return;

    if (readyForResolve) {
      appendTurnTrace('PENDING_RESOLVE_READY', {
        noPendingAnimations,
        hasBlockingTimeline,
        movementTraceBudgetMs,
        elapsedPendingMs,
        requiredFallbackDelayMs
      });
      dispatchWithTrace({ type: 'RESOLVE_PENDING' }, 'pending_ready');
      return;
    }

    // Fail-safe: if the busy signal was missed, resolve once the blocking budget elapsed.
    if (!isBusy && hasBlockingTimeline && !pendingObservedBusy.current) {
      appendTurnTrace('PENDING_RESOLVE_WAIT', {
        movementTraceBudgetMs,
        elapsedPendingMs,
        requiredFallbackDelayMs
      });
      const remainingMs = Math.max(0, requiredFallbackDelayMs - elapsedPendingMs);
      const timer = window.setTimeout(() => {
        dispatchWithTrace({ type: 'RESOLVE_PENDING' }, 'pending_fallback_delay');
      }, remainingMs);
      return () => window.clearTimeout(timer);
    }
  }, [turnDriver.shouldResolvePending, gameState.timelineEvents, gameState.visualEvents, isBusy, currentEventsHash, currentTimelineHash, dispatchWithTrace, appendTurnTrace]);

  useEffect(() => {
    if (!postCommitInputLock) return;

    if (isReplayMode || gameState.gameStatus !== 'playing') {
      clearPostCommitLock('mode_or_status_change');
      return;
    }

    // Intercept stack (shrine/stairs/win/loss) now owns flow control.
    // Post-commit lock is only for normal queue handoff back to player input.
    if (gameState.pendingStatus || (gameState.pendingFrames?.length ?? 0) > 0) {
      clearPostCommitLock('pending_intercept');
      return;
    }

    const lockTurn = commitLockTurnRef.current;
    const expectedActionLen = commitLockActionLenRef.current;
    const lockAgeMs = postCommitLockedAtRef.current !== null
      ? Math.max(0, performance.now() - postCommitLockedAtRef.current)
      : Number.POSITIVE_INFINITY;
    const turnAdvanced = lockTurn !== null ? gameState.turnNumber > lockTurn : false;
    const actionCommitted = expectedActionLen !== null ? (gameState.actionLog?.length ?? 0) >= expectedActionLen : false;
    const minimumLockSatisfied = lockAgeMs >= POST_COMMIT_MIN_LOCK_MS;
    const visualsChangedSinceArm =
      currentEventsHash !== postCommitEventHashAtArmRef.current
      || currentTimelineHash !== postCommitTimelineHashAtArmRef.current;
    const noActionProgressYet = !turnAdvanced && !actionCommitted;
    const waitForExpectedBusy =
      !postCommitObservedBusyRef.current
      && visualsChangedSinceArm
      && lockAgeMs < POST_COMMIT_BUSY_WAIT_TIMEOUT_MS;
    // IMPORTANT: Do not derive this from turnDriver.canPlayerInput because
    // turnDriver itself is lock-aware and would deadlock this release path.
    const queueResolved =
      gameState.gameStatus === 'playing'
      && !isReplayMode
      && !isBusy
      && !gameState.pendingStatus
      && (gameState.pendingFrames?.length ?? 0) === 0
      && isPlayerTurn(gameState);

    // Release only when the committed action has been observed and the queue
    // has returned control to the player (same turn or next turn).
    // Age fallback prevents stale-lock deadlocks across hub/run transitions.
    if (waitForExpectedBusy) {
      appendTurnTrace('LOCK_WAIT_FOR_BUSY', {
        lockAgeMs,
        visualsChangedSinceArm
      });
      return;
    }

    // If no state progress occurred at all (e.g. invalid/no-op intent), never let
    // post-commit lock hang until watchdog.
    if (queueResolved && noActionProgressYet && lockAgeMs > 450) {
      clearPostCommitLock('no_progress_timeout');
      return;
    }

    if (queueResolved && minimumLockSatisfied && (turnAdvanced || actionCommitted || lockAgeMs > 1500)) {
      clearPostCommitLock(turnAdvanced ? 'turn_advanced' : actionCommitted ? 'action_committed' : 'age_fallback');
    }
  }, [postCommitInputLock, isReplayMode, gameState.gameStatus, gameState.turnNumber, gameState.pendingStatus, gameState.pendingFrames, gameState.initiativeQueue, gameState.actionLog, isBusy, gameState.player.id, gameState.enemies, appendTurnTrace, currentEventsHash, currentTimelineHash, postCommitTick]);

  useEffect(() => {
    if (gameState.gameStatus !== 'playing' && postCommitInputLock) {
      clearPostCommitLock('not_playing');
    }
  }, [gameState.gameStatus, postCommitInputLock, appendTurnTrace]);

  useEffect(() => {
    if (!postCommitInputLock) return;
    if (postCommitWatchdogRef.current !== null) {
      window.clearTimeout(postCommitWatchdogRef.current);
    }
    // Fail-safe: if lock remains far beyond normal turn resolution, release lock
    // and emit a diagnostic so we never hard-freeze input.
    postCommitWatchdogRef.current = window.setTimeout(() => {
      if (postCommitInputLock) {
        console.error('[HOP_INPUT_LOCK] Watchdog released stuck post-commit lock', {
          turnNumber: gameState.turnNumber,
          pendingStatus: gameState.pendingStatus?.status,
          pendingFrames: gameState.pendingFrames?.length ?? 0,
          playerTurn: isPlayerTurn(gameState),
          isBusy,
          actionLogLength: gameState.actionLog?.length ?? 0,
          traceTail: turnTraceRef.current.slice(-40)
        });
        appendTurnTrace('LOCK_WATCHDOG_RELEASE');
        clearPostCommitLock('watchdog');
      }
    }, 8000);

    return () => {
      if (postCommitWatchdogRef.current !== null) {
        window.clearTimeout(postCommitWatchdogRef.current);
        postCommitWatchdogRef.current = null;
      }
    };
  }, [postCommitInputLock, gameState.turnNumber, gameState.pendingStatus, gameState.actionLog, isBusy, gameState.initiativeQueue, gameState.player.id, gameState.enemies, appendTurnTrace]);

  useEffect(() => {
    if (!postCommitInputLock) return;
    const timer = window.setTimeout(() => {
      appendTurnTrace('LOCK_STALL_SNAPSHOT', {
        lockAgeMs: postCommitLockedAtRef.current !== null
          ? Math.max(0, performance.now() - postCommitLockedAtRef.current)
          : null
      });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [postCommitInputLock, appendTurnTrace]);

  const [tutorialInstructions, setTutorialInstructions] = useState<string | null>(null);
  const [floorIntro, setFloorIntro] = useState<{ floor: number; theme: string } | null>(null);

  // Trigger floor intro on floor change
  const lastFloorRef = useRef(gameState.floor);
  useEffect(() => {
    if (gameState.gameStatus === 'playing' && gameState.floor !== lastFloorRef.current) {
      setFloorIntro({ floor: gameState.floor, theme: gameState.theme || 'Catacombs' });
      lastFloorRef.current = gameState.floor;
      const timer = setTimeout(() => setFloorIntro(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState.floor, gameState.gameStatus, gameState.theme]);

  // Also trigger intro on initial start
  useEffect(() => {
    if (gameState.gameStatus === 'playing' && gameState.floor === 1 && !lastFloorRef.current) {
      setFloorIntro({ floor: 1, theme: gameState.theme || 'Catacombs' });
      lastFloorRef.current = 1;
      const timer = setTimeout(() => setFloorIntro(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState.gameStatus]);

  const armPostCommitLock = () => {
    if (postCommitWatchdogRef.current !== null) {
      window.clearTimeout(postCommitWatchdogRef.current);
      postCommitWatchdogRef.current = null;
    }
    commitLockTurnRef.current = gameState.turnNumber;
    commitLockActionLenRef.current = (gameState.actionLog?.length ?? 0) + 1;
    postCommitLockedAtRef.current = performance.now();
    postCommitObservedBusyRef.current = false;
    postCommitEventHashAtArmRef.current = currentEventsHash;
    postCommitTimelineHashAtArmRef.current = currentTimelineHash;
    setPostCommitInputLock(true);
    appendTurnTrace('LOCK_ARM', {
      lockTurn: gameState.turnNumber,
      expectedActionLogLength: (gameState.actionLog?.length ?? 0) + 1,
      eventHashAtArm: currentEventsHash,
      timelineHashAtArm: currentTimelineHash
    });
  };

  const handleSelectSkill = (skillId: string | null) => {
    if (isInputLocked) return;
    setSelectedSkillId(skillId);
  };

  const handleTileClick = (target: Point) => {
    if (isInputLocked) return;
    if (selectedSkillId) {
      armPostCommitLock();
      dispatchWithTrace({ type: 'USE_SKILL', payload: { skillId: selectedSkillId, target } }, 'player_use_skill');
      setSelectedSkillId(null);
      return;
    }
    if (hexEquals(target, gameState.player.position)) {
      setShowMovementRange(!showMovementRange);
      return;
    }
    armPostCommitLock();
    dispatchWithTrace({ type: 'MOVE', payload: target }, 'player_move');
    setShowMovementRange(false);
  };

  const handleSelectUpgrade = (upgrade: string) => {
    if (isReplayMode || isBusy) return;
    dispatchWithTrace({ type: 'SELECT_UPGRADE', payload: upgrade }, 'upgrade_select');
  };

  const handleReset = () => { dispatchWithTrace({ type: 'RESET' }, 'reset'); setSelectedSkillId(null); setIsReplayMode(false); setReplayError(null); };
  const handleWait = () => {
    if (isInputLocked) return;
    armPostCommitLock();
    dispatchWithTrace({ type: 'WAIT' }, 'player_wait');
    setSelectedSkillId(null);
  };

  const startReplay = (r: ReplayRecord) => {
    if (!r) return;
    const validation = validateReplayActions(r.actions || []);
    if (!validation.valid) {
      const msg = `Replay rejected: ${validation.errors.slice(0, 3).join(' | ')}`;
      setReplayError(msg);
      console.error('[HOP_REPLAY] Invalid replay actions', {
        replayId: r.id,
        errors: validation.errors
      });
      return;
    }
    setReplayError(null);
    setIsReplayMode(true);
    setReplayActions(validation.actions);
    setReplayActive(false); // Start paused
    replayIndexRef.current = 0;

    const seed = r.seed || r.id || String(Date.now());
    const loadout = r.loadoutId ? (DEFAULT_LOADOUTS as any)[r.loadoutId] : undefined;
    const init = generateInitialState(1, seed, seed, undefined, loadout);
    dispatchWithTrace({ type: 'LOAD_STATE', payload: init } as Action, 'replay_start');
  };

  const stepReplay = () => {
    const idx = replayIndexRef.current;
    if (idx >= replayActions.length) {
      setReplayActive(false);
      return;
    }
    dispatchWithTrace(replayActions[idx] as Action, 'replay_step');
    replayIndexRef.current = idx + 1;
  };

  useEffect(() => {
    if (!replayActive || !isReplayMode) return;
    const timer = window.setInterval(stepReplay, 500);
    return () => window.clearInterval(timer);
  }, [replayActive, isReplayMode, replayActions]);

  const stopReplay = () => {
    setIsReplayMode(false);
    setReplayError(null);
    handleExitToHub();
  };

  const handleLoadScenario = (state: GameState, instructions: string) => { dispatchWithTrace({ type: 'LOAD_STATE', payload: state }, 'scenario_load'); setTutorialInstructions(instructions); setSelectedSkillId(null); };

  const handleExitToHub = () => { dispatchWithTrace({ type: 'EXIT_TO_HUB' }, 'exit_to_hub'); setSelectedSkillId(null); setIsReplayMode(false); setReplayError(null); navigateTo(hubPath); };

  // Auto-record runs on win/loss
  useEffect(() => {
    if (isReplayMode) return;
    if ((gameState.gameStatus === 'won' || gameState.gameStatus === 'lost') && lastRecordedRunRef.current !== gameState.initialSeed) {
      lastRecordedRunRef.current = gameState.initialSeed || 'default';
      // Record to local storage
      const seed = gameState.initialSeed ?? gameState.rngSeed ?? '0';
      const score = gameState.completedRun?.score || (gameState.player.hp || 0) + (gameState.floor || 0) * 100;
      const replayValidation = validateReplayActions(gameState.actionLog || []);
      if (!replayValidation.valid) {
        console.error('[HOP_REPLAY] Refusing to persist replay with invalid action log', {
          errors: replayValidation.errors
        });
        return;
      }
      const diagnostics = buildReplayDiagnostics(replayValidation.actions, gameState.floor || 0);
      const rec: ReplayRecord = {
        id: `run-${Date.now()}`,
        seed,
        loadoutId: gameState.player.archetype,
        actions: replayValidation.actions,
        score,
        floor: gameState.floor,
        date: new Date().toISOString(),
        replayVersion: 2,
        diagnostics
      };

      const raw = localStorage.getItem('hop_replays_v1');
      const list = raw ? JSON.parse(raw) as ReplayRecord[] : [];
      const next = [rec, ...list].slice(0, 100);
      localStorage.setItem('hop_replays_v1', JSON.stringify(next));

      // Also update leaderboard if top 5
      const rawLB = localStorage.getItem('hop_leaderboard_v1');
      let lb = rawLB ? JSON.parse(rawLB) as any[] : [];
      lb.push({
        id: rec.id,
        name: 'Player',
        score: rec.score,
        floor: rec.floor,
        date: rec.date,
        seed: rec.seed,
        loadoutId: rec.loadoutId,
        actions: rec.actions,
        replayVersion: rec.replayVersion,
        diagnostics: rec.diagnostics
      });
      lb.sort((a, b) => b.score - a.score);
      lb = lb.slice(0, 5);
      localStorage.setItem('hop_leaderboard_v1', JSON.stringify(lb));
    }
    if (gameState.gameStatus === 'hub') {
      lastRecordedRunRef.current = null;
    }
  }, [gameState.gameStatus, isReplayMode, gameState.initialSeed]);

  const handleStartRun = (mode: 'normal' | 'daily') => {
    const id = gameState.selectedLoadoutId;
    if (!id) { console.warn('Start Run called without a selected loadout.'); return; }
    dispatchWithTrace({ type: 'START_RUN', payload: { loadoutId: id, mode } }, 'hub_start_run');
  };

  const handleStartArcadeRun = (loadoutId: string) => {
    dispatchWithTrace({ type: 'START_RUN', payload: { loadoutId, mode: 'daily' } }, 'arcade_start_run');
    navigateTo(hubPath);
  };

  if (gameState.gameStatus === 'hub') {
    return (
      <div className="w-screen h-screen bg-[#030712] overflow-hidden text-white font-['Inter',_sans-serif]">
        {isArcadeRoute ? (
          <ArcadeHub
            onBack={() => navigateTo(hubPath)}
            onLaunchArcade={handleStartArcadeRun}
          />
        ) : (
          <Hub
            gameState={gameState}
            onSelectLoadout={(l) => {
              dispatchWithTrace({ type: 'APPLY_LOADOUT', payload: l }, 'hub_select_loadout');
            }}
            onStartRun={handleStartRun}
            onOpenArcade={() => navigateTo(arcadePath)}
            onLoadScenario={handleLoadScenario}
            onStartReplay={startReplay}
          />
        )}
        {replayError && (
          <div className="absolute top-4 right-4 z-40 max-w-xl px-4 py-3 rounded-xl border border-red-400/40 bg-red-900/70 text-red-100 text-xs font-bold tracking-wide">
            {replayError}
          </div>
        )}
        {/* Hub instructions overlay */}
        {
          tutorialInstructions && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-blue-900/90 border border-blue-500/30 p-4 rounded-xl backdrop-blur-md shadow-xl z-30 max-w-lg text-center animate-in fade-in slide-in-from-top-4">
              <h4 className="text-blue-200 font-bold uppercase text-xs tracking-widest mb-1">Simulation Objective</h4>
              <p className="text-white text-sm">{tutorialInstructions}</p>
              <button
                onClick={() => setTutorialInstructions(null)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-blue-950 rounded-full border border-blue-500/50 flex items-center justify-center text-xs hover:bg-blue-800 transition-colors"
              >
                ✕
              </button>
            </div>
          )
        }
      </div >
    );
  }

  return (
    <div className="flex w-screen h-screen bg-[#030712] overflow-hidden text-white font-['Inter',_sans-serif]">
      {/* Left Sidebar: HUD & Tactical Log */}
      <aside className="w-80 border-r border-white/5 bg-[#030712] flex flex-col z-20 overflow-y-auto">
        <UI gameState={gameState} onReset={handleReset} onWait={handleWait} onExitToHub={handleExitToHub} inputLocked={isInputLocked} />
      </aside>

      {/* Center: The Map (Full Height) */}
      <main className="flex-1 relative flex items-center justify-center bg-[#020617] overflow-hidden">
        <div className="w-full h-full p-8 flex items-center justify-center">
          <div className={`w-full h-full relative border border-white/5 bg-[#030712]/50 rounded-[40px] shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden ${gameState.isShaking ? 'animate-shake' : ''}`}>
            <GameBoard
              gameState={gameState}
              onMove={handleTileClick}
              selectedSkillId={selectedSkillId}
              showMovementRange={showMovementRange}
              onBusyStateChange={setIsBusy}
            />
            {isInputLocked && gameState.gameStatus === 'playing' && (
              <div className="absolute inset-0 z-40 pointer-events-auto">
                <div className="absolute top-6 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg bg-black/55 border border-white/15 text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                  Resolving Turn...
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Right Sidebar: Skills */}
      <aside className="w-80 border-l border-white/5 bg-[#030712] flex flex-col z-20 overflow-y-auto">
        <div className="p-6 flex flex-col gap-8 h-full">
          <div className="flex-1">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-6">Tactical Skills</h3>
            <SkillTray
              skills={gameState.player.activeSkills || []}
              selectedSkillId={selectedSkillId}
              onSelectSkill={handleSelectSkill}
              hasSpear={gameState.hasSpear}
              gameState={gameState}
              inputLocked={isInputLocked}
            />
          </div>

          <div className="pt-8 border-t border-white/5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/20">
              Hop Engine v5.0
            </div>
          </div>
        </div>
      </aside>

      {/* Tutorial Instructions Overlay */}
      {tutorialInstructions && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-blue-900/90 border border-blue-500/30 p-4 rounded-xl backdrop-blur-md shadow-xl z-30 max-w-lg text-center animate-in fade-in slide-in-from-top-4">
          <h4 className="text-blue-200 font-bold uppercase text-xs tracking-widest mb-1">Simulation Objective</h4>
          <p className="text-white text-sm">{tutorialInstructions}</p>
          <button
            onClick={() => setTutorialInstructions(null)}
            className="absolute -top-2 -right-2 w-6 h-6 bg-blue-950 rounded-full border border-blue-500/50 flex items-center justify-center text-xs hover:bg-blue-800 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Overlays */}
      {gameState.gameStatus === 'choosing_upgrade' && (
        <UpgradeOverlay onSelect={handleSelectUpgrade} gameState={gameState} />
      )}
      {gameState.gameStatus === 'lost' && (
        <div className="fixed inset-0 bg-red-950/90 backdrop-blur-xl flex flex-col items-center justify-center z-[200] transition-opacity duration-500">
          <div className="text-8xl mb-8 animate-bounce">💀</div>
          <h2 className="text-6xl font-black text-white mb-2 tracking-tighter italic uppercase">Identity Deleted</h2>
          <p className="text-red-200/60 mb-12 text-xl font-medium tracking-widest uppercase">Simulation Terminated</p>
          <button
            onClick={handleReset}
            className="px-12 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.3)]"
          >
            Reinitialize Simulation
          </button>
        </div>
      )}
      {gameState.gameStatus === 'won' && (
        <div className="fixed inset-0 bg-indigo-950/90 backdrop-blur-xl flex flex-col items-center justify-center z-[200] transition-opacity duration-500">
          <div className="text-8xl mb-8 animate-bounce">🏆</div>
          <h2 className="text-6xl font-black text-white mb-2 tracking-tighter italic uppercase">Arcade Mode Cleared</h2>
          <p className="text-indigo-200/60 mb-2 text-xl font-medium tracking-widest uppercase">The Sentinel has fallen</p>
          <p className="text-white/20 mb-12 text-sm font-bold uppercase tracking-[0.3em]">Score: {gameState.completedRun?.score || 0}</p>
          <button
            onClick={handleExitToHub}
            className="px-12 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.3)]"
          >
            Return to Command Center
          </button>
        </div>
      )}

      {/* Floor Intro Overlay */}
      {floorIntro && (
        <div className="fixed inset-0 flex items-center justify-center z-[150] pointer-events-none animate-in fade-in duration-700">
          <div className="text-center">
            <div className="text-indigo-500 font-black text-2xl uppercase tracking-[0.5em] mb-4 animate-in slide-in-from-bottom-8 duration-1000">Floor {floorIntro.floor}</div>
            <h2 className="text-8xl font-black text-white uppercase tracking-tighter italic animate-in slide-in-from-top-12 duration-1000">{floorIntro.theme}</h2>
            <div className="h-1 w-64 bg-white/20 mx-auto mt-8 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 animate-[progress_3s_linear]" />
            </div>
          </div>
        </div>
      )}

      {/* Replay Controls Overlay */}
      {isReplayMode && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-[#030712]/90 border border-indigo-500/30 p-6 rounded-3xl backdrop-blur-2xl shadow-[0_0_50px_rgba(79,70,229,0.2)] z-[250] flex items-center gap-8 animate-in slide-in-from-bottom-8 duration-500">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-1">Replay System</span>
            <span className="text-white font-bold text-sm">Step {replayIndexRef.current} / {replayActions.length}</span>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="flex items-center gap-4">
            <button
              onClick={() => setReplayActive(!replayActive)}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${replayActive ? 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.5)]' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
            >
              {replayActive ? '⏸' : '▶'}
            </button>
            <button
              onClick={stepReplay}
              disabled={replayActive}
              className="w-12 h-12 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-white rounded-xl flex items-center justify-center transition-all"
            >
              ⏭
            </button>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <button
            onClick={stopReplay}
            className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold uppercase text-xs tracking-widest transition-all"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
