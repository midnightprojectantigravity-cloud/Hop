import { useCallback, useEffect, useRef, useState } from 'react';
import { buildEngineMirrorSnapshot, validateStateMirrorSnapshot } from '@hop/engine';
import type { GameState, SimulationEvent, StateMirrorSnapshot } from '@hop/engine';

type MobileToast = {
  id: string;
  text: string;
  tone: 'damage' | 'heal' | 'status' | 'system';
  createdAt: number;
};

interface UseSimulationFeedbackArgs {
  gameState: GameState;
  appendTurnTrace: (event: string, details?: Record<string, unknown>) => void;
}

export const useSimulationFeedback = ({ gameState, appendTurnTrace }: UseSimulationFeedbackArgs) => {
  const simulationEventLogRef = useRef<SimulationEvent[]>([]);
  const latestUiMirrorSnapshotRef = useRef<StateMirrorSnapshot | null>(null);
  const lastMirrorValidationKeyRef = useRef('');
  const [mobileToasts, setMobileToasts] = useState<MobileToast[]>([]);

  const pushMobileToast = useCallback((toast: Omit<MobileToast, 'createdAt'>) => {
    const now = Date.now();
    setMobileToasts(prev => {
      const next = [...prev, { ...toast, createdAt: now }];
      return next.slice(-4);
    });
  }, []);

  const handleSimulationEvents = useCallback((events: SimulationEvent[]) => {
    if (!events || events.length === 0) return;
    simulationEventLogRef.current = [...simulationEventLogRef.current, ...events].slice(-600);
    (window as any).__HOP_SIM_EVENTS = simulationEventLogRef.current;
    window.dispatchEvent(new CustomEvent('hop:simulation-events', {
      detail: {
        turn: gameState.turnNumber,
        events
      }
    }));
    appendTurnTrace('SIM_EVENTS', {
      count: events.length,
      lastType: events[events.length - 1]?.type ?? 'unknown'
    });

    for (const ev of events) {
      if (ev.type === 'DamageTaken' && ev.targetId === gameState.player.id) {
        const amount = Math.max(0, Number(ev.payload?.amount || 0));
        if (amount > 0) {
          pushMobileToast({
            id: `sim-toast-${ev.id}`,
            text: `-${amount} HP`,
            tone: 'damage'
          });
        }
      } else if (ev.type === 'Healed' && ev.targetId === gameState.player.id) {
        const amount = Math.max(0, Number(ev.payload?.amount || 0));
        if (amount > 0) {
          pushMobileToast({
            id: `sim-toast-${ev.id}`,
            text: `+${amount} HP`,
            tone: 'heal'
          });
        }
      } else if (ev.type === 'StatusApplied' && ev.targetId === gameState.player.id) {
        const raw = String(ev.payload?.status || 'Status');
        const label = raw
          .split('_')
          .filter(Boolean)
          .map(s => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' ');
        pushMobileToast({
          id: `sim-toast-${ev.id}`,
          text: label,
          tone: 'status'
        });
      } else if (ev.type === 'MessageLogged') {
        const text = String(ev.payload?.text || '').trim();
        if (!text) continue;
        const lower = text.toLowerCase();
        const isImportant =
          lower.includes('stun')
          || lower.includes('snare')
          || lower.includes('lava')
          || lower.includes('fire')
          || lower.includes('burn')
          || lower.includes('heal')
          || lower.includes('shrine')
          || lower.includes('stairs')
          || lower.includes('roll away')
          || lower.includes('ward')
          || lower.includes('orb');
        if (!isImportant) continue;
        const compact = text.length > 52 ? `${text.slice(0, 49)}...` : text;
        pushMobileToast({
          id: `sim-toast-${ev.id}`,
          text: compact,
          tone: 'system'
        });
      }
    }
  }, [appendTurnTrace, gameState.turnNumber, gameState.player.id, pushMobileToast]);

  const handleUiMirrorSnapshot = useCallback((snapshot: StateMirrorSnapshot) => {
    latestUiMirrorSnapshotRef.current = snapshot;
    (window as any).__HOP_UI_MIRROR = snapshot;
  }, []);

  useEffect(() => {
    (window as any).__HOP_SIM_EVENTS = simulationEventLogRef.current;
    (window as any).__HOP_DUMP_SIM_EVENTS = () => [...simulationEventLogRef.current];
    (window as any).__HOP_CLEAR_SIM_EVENTS = () => {
      simulationEventLogRef.current = [];
      (window as any).__HOP_SIM_EVENTS = [];
    };
    (window as any).__HOP_DUMP_MIRROR = () => (window as any).__HOP_MIRROR_LAST;
    return () => {
      delete (window as any).__HOP_DUMP_SIM_EVENTS;
      delete (window as any).__HOP_CLEAR_SIM_EVENTS;
      delete (window as any).__HOP_DUMP_MIRROR;
    };
  }, []);

  useEffect(() => {
    if (mobileToasts.length === 0) return;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setMobileToasts(prev => prev.filter(t => (now - t.createdAt) < 2200));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [mobileToasts]);

  useEffect(() => {
    const engineSnapshot = buildEngineMirrorSnapshot(gameState);
    (window as any).__HOP_ENGINE_MIRROR = engineSnapshot;

    const uiSnapshot = latestUiMirrorSnapshotRef.current;
    if (!uiSnapshot) return;
    if (uiSnapshot.turn !== engineSnapshot.turn || uiSnapshot.stackTick !== engineSnapshot.stackTick) return;

    const result = validateStateMirrorSnapshot(engineSnapshot, uiSnapshot);
    const key = `${engineSnapshot.turn}:${engineSnapshot.stackTick}:${result.ok ? 'ok' : result.mismatches.length}`;
    if (key === lastMirrorValidationKeyRef.current) return;
    lastMirrorValidationKeyRef.current = key;

    (window as any).__HOP_MIRROR_LAST = {
      engineSnapshot,
      uiSnapshot,
      result
    };

    if (!result.ok) {
      appendTurnTrace('MIRROR_MISMATCH', { count: result.mismatches.length });
      console.warn('[HOP_MIRROR] snapshot mismatch detected', result.mismatches);
    }
  }, [gameState, appendTurnTrace]);

  return {
    mobileToasts,
    handleSimulationEvents,
    handleUiMirrorSnapshot,
  };
};
