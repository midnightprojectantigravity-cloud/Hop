import React, { useEffect, useState } from 'react';
import type { GameState, ReplayEnvelopeV3 } from '@hop/engine';
import { validateReplayEnvelopeV3 } from '@hop/engine';

export interface ReplayRecord {
  id: string;
  replay: ReplayEnvelopeV3;
  score: number;
  floor: number;
  date: string;
  diagnostics?: {
    actionCount: number;
    hasTurnAdvance: boolean;
    hasPendingResolve: boolean;
    suspiciouslyShort: boolean;
  };
}

const STORAGE_KEY = 'hop_replays_v3';
const LEADERBOARD_KEY = 'hop_leaderboard_v3';

const loadAll = (): ReplayRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ReplayRecord[];
  } catch (e) {
    console.error('Failed to load replays', e);
    return [];
  }
};

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  floor: number;
  date: string;
  replay: ReplayEnvelopeV3;
  diagnostics?: ReplayRecord['diagnostics'];
}

const loadLeaderboard = (): LeaderboardEntry[] => {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [] as LeaderboardEntry[];
    return JSON.parse(raw) as LeaderboardEntry[];
  } catch (e) {
    console.error('Failed to load leaderboard', e);
    return [] as LeaderboardEntry[];
  }
};

const analyzeReplay = (r: ReplayRecord) => {
  const actions = Array.isArray(r.replay.actions) ? r.replay.actions : [];
  const types = new Set(actions.map((a: any) => a?.type));
  const hasTurnAdvance = types.has('ADVANCE_TURN');
  const hasPendingResolve = types.has('RESOLVE_PENDING');
  const suspiciouslyShort = (r.floor || 0) >= 5 && actions.length < Math.max(25, (r.floor || 0) * 4);
  const invalid = actions.length === 0;
  const label = invalid ? 'invalid replay' : (suspiciouslyShort ? 'truncated replay' : null);

  return {
    invalid,
    suspicious: suspiciouslyShort || (r.floor > 1 && !hasPendingResolve),
    label,
    hasTurnAdvance,
    hasPendingResolve,
    actionCount: actions.length,
  };
};

export const parseManualReplayEnvelope = (text: string): { record?: ReplayRecord; error?: string } => {
  if (!text.trim()) {
    return { error: 'Paste a ReplayEnvelopeV3 JSON payload first.' };
  }

  try {
    const parsed = JSON.parse(text);
    const validation = validateReplayEnvelopeV3(parsed);
    if (!validation.valid || !validation.envelope) {
      return { error: `ReplayEnvelopeV3 required: ${validation.errors.slice(0, 2).join(' | ')}` };
    }

    const envelope = validation.envelope;
    return {
      record: {
        id: `manual-${Date.now()}`,
        replay: envelope,
        score: Number(envelope.meta.final?.score || 0),
        floor: Number(envelope.meta.final?.floor || envelope.run.startFloor || 1),
        date: envelope.meta.recordedAt,
        diagnostics: envelope.meta.diagnostics
      }
    };
  } catch (error: any) {
    return { error: `Invalid JSON: ${error?.message || 'parse error'}` };
  }
};

const ReplayManager: React.FC<{
  gameState: GameState;
  onStartReplay: (r: ReplayRecord) => void;
}> = ({ onStartReplay }) => {
  const [list, setList] = useState<ReplayRecord[]>(() => loadAll());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => loadLeaderboard());
  const [manualEnvelope, setManualEnvelope] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    const handleStorage = () => {
      setList(loadAll());
      setLeaderboard(loadLeaderboard());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const parseManualReplay = (): ReplayRecord | null => {
    setManualError(null);
    const parsed = parseManualReplayEnvelope(manualEnvelope);
    if (!parsed.record) {
      setManualError(parsed.error || 'Invalid ReplayEnvelopeV3');
      return null;
    }
    return parsed.record;
  };

  const handleStartManualReplay = () => {
    const replay = parseManualReplay();
    if (!replay) return;
    onStartReplay(replay);
  };

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-royal)]">Manual Replay</h3>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">Replay V3 Only</span>
        </div>
        <div className="space-y-2 p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)]">
          <textarea
            value={manualEnvelope}
            onChange={(e) => setManualEnvelope(e.target.value)}
            placeholder='Paste ReplayEnvelopeV3 JSON: {"version":3,"run":...,"actions":[...],"meta":...}'
            rows={8}
            className="w-full bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-royal)] font-mono"
          />
          {manualError && (
            <div className="text-[10px] text-[var(--accent-danger)] font-bold uppercase tracking-wider">{manualError}</div>
          )}
          <button
            onClick={handleStartManualReplay}
            className="w-full py-2 rounded-lg bg-[var(--accent-royal-soft)] hover:brightness-105 border border-[var(--accent-royal)] text-[var(--text-primary)] text-xs font-black uppercase tracking-widest transition-colors"
          >
            Start Manual Replay
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent-brass)]">Hall of Fame</h3>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">Top 5 Only</span>
        </div>

        <div className="space-y-2">
          {leaderboard.length === 0 && (
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-center">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-black">No Champions Yet</span>
            </div>
          )}
          {leaderboard.slice(0, 5).map((e, i) => {
            const replay: ReplayRecord = {
              id: e.id,
              replay: e.replay,
              score: e.score,
              floor: e.floor,
              date: e.date,
              diagnostics: e.diagnostics
            };
            const q = analyzeReplay(replay);

            return (
              <button
                key={e.id}
                onClick={() => onStartReplay(replay)}
                className="w-full group relative flex items-center gap-4 p-4 bg-[var(--surface-panel-muted)] hover:bg-[var(--surface-panel-hover)] border border-[var(--border-subtle)] hover:border-[var(--accent-royal)] rounded-2xl transition-all text-left"
              >
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-[var(--accent-royal-soft)] rounded-lg text-[var(--accent-royal)] font-black text-sm border border-[var(--accent-royal)]">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-black text-[var(--text-primary)] uppercase text-xs truncate tracking-wider">{e.name}</span>
                    <span className="text-[10px] font-black text-[var(--accent-royal)] tabular-nums">{e.score.toLocaleString()}</span>
                  </div>
                  <div className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest">
                    Floor {e.floor} * {new Date(e.date).toLocaleDateString()} * {q.actionCount} acts
                  </div>
                  {q.label && (
                    <div className="text-[9px] mt-1 text-[var(--accent-danger)] font-bold uppercase tracking-widest">
                      {q.label}
                    </div>
                  )}
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--accent-royal)] text-xs">Play</div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Recent Simulations</h3>
        </div>

        <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
          {list.length === 0 && (
            <div className="text-center py-4">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Log Empty</span>
            </div>
          )}
          {list.slice(0, 10).map((r) => {
            const q = analyzeReplay(r);
            return (
              <button
                key={r.id}
                onClick={() => onStartReplay(r)}
                className="w-full flex items-center justify-between p-3 hover:bg-[var(--surface-panel-hover)] rounded-xl transition-colors text-left group"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-[var(--text-secondary)] mb-0.5 truncate uppercase">
                    Score: <span className="text-[var(--text-primary)]">{r.score}</span> * F{r.floor} * {q.actionCount} acts
                  </div>
                  <div className="text-[9px] text-[var(--text-muted)] font-medium">
                    {new Date(r.date).toLocaleTimeString()}
                  </div>
                  {q.label && (
                    <div className="text-[9px] mt-1 text-[var(--accent-danger)] font-bold uppercase tracking-widest">
                      {q.label}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-transparent group-hover:text-[var(--text-secondary)] font-black uppercase tracking-widest transition-all">Replay</div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default ReplayManager;
