import React, { useState, useEffect } from 'react';
import type { GameState } from '@hop/engine';

export interface ReplayRecord {
  id: string;
  seed?: string;
  loadoutId?: string;
  actions: any[];
  score: number;
  floor: number;
  date: string;
  replayVersion?: number;
  diagnostics?: {
    actionCount: number;
    hasTurnAdvance: boolean;
    hasPendingResolve: boolean;
    suspiciouslyShort: boolean;
  };
}

const STORAGE_KEY = 'hop_replays_v1';
const LEADERBOARD_KEY = 'hop_leaderboard_v1';

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
  seed?: string;
  actions?: any[];
  loadoutId?: string;
  replayVersion?: number;
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
  const actions = Array.isArray(r.actions) ? r.actions : [];
  const types = new Set(actions.map((a: any) => a?.type));
  const hasTurnAdvance = types.has('ADVANCE_TURN');
  const hasPendingResolve = types.has('RESOLVE_PENDING');
  const suspiciouslyShort = (r.floor || 0) >= 5 && actions.length < Math.max(25, (r.floor || 0) * 4);
  const isLegacy = (r.replayVersion ?? 1) < 2;
  const invalid = actions.length === 0;
  const label = invalid
    ? 'invalid replay'
    : (suspiciouslyShort ? 'truncated replay' : (isLegacy ? 'legacy replay' : null));

  return {
    isLegacy,
    invalid,
    suspicious: suspiciouslyShort || (r.floor > 1 && !hasPendingResolve),
    label,
    hasTurnAdvance,
    hasPendingResolve,
    actionCount: actions.length,
  };
};

const ReplayManager: React.FC<{
  gameState: GameState;
  onStartReplay: (r: ReplayRecord) => void;
}> = ({ onStartReplay }) => {
  const [list, setList] = useState<ReplayRecord[]>(() => loadAll());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => loadLeaderboard());
  const [manualSeed, setManualSeed] = useState('');
  const [manualLoadoutId, setManualLoadoutId] = useState('');
  const [manualActions, setManualActions] = useState('');
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
    try {
      const text = manualActions.trim();
      if (!text) {
        setManualError('Paste actions JSON first.');
        return null;
      }

      const parsed = JSON.parse(text);
      let seed = manualSeed.trim() || undefined;
      let loadoutId = manualLoadoutId.trim() || undefined;
      let actions: any[] = [];

      if (Array.isArray(parsed)) {
        actions = parsed;
      } else if (parsed && typeof parsed === 'object') {
        actions = Array.isArray((parsed as any).actions) ? (parsed as any).actions : [];
        seed = seed || (typeof (parsed as any).seed === 'string' ? (parsed as any).seed : undefined);
        loadoutId = loadoutId || (typeof (parsed as any).loadoutId === 'string' ? (parsed as any).loadoutId : undefined);
      }

      if (!Array.isArray(actions) || actions.length === 0) {
        setManualError('No actions found. Provide a JSON action array or object with "actions".');
        return null;
      }

      const actionCount = actions.filter(a => a && typeof a.type === 'string').length;
      if (actionCount === 0) {
        setManualError('Actions must be objects with a "type" field.');
        return null;
      }

      const replay: ReplayRecord = {
        id: `manual-${Date.now()}`,
        seed,
        loadoutId,
        actions,
        score: 0,
        floor: 1,
        date: new Date().toISOString(),
        replayVersion: 2,
        diagnostics: {
          actionCount: actions.length,
          hasTurnAdvance: actions.some(a => a?.type === 'ADVANCE_TURN'),
          hasPendingResolve: actions.some(a => a?.type === 'RESOLVE_PENDING'),
          suspiciouslyShort: false
        }
      };

      return replay;
    } catch (e: any) {
      setManualError(`Invalid JSON: ${e?.message || 'parse error'}`);
      return null;
    }
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
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Manual Replay</h3>
          <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Paste from UPA</span>
        </div>
        <div className="space-y-2 p-3 rounded-2xl border border-white/5 bg-white/[0.02]">
          <input
            value={manualSeed}
            onChange={(e) => setManualSeed(e.target.value)}
            placeholder="Seed (optional if included in JSON)"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-400/40"
          />
          <input
            value={manualLoadoutId}
            onChange={(e) => setManualLoadoutId(e.target.value)}
            placeholder="Loadout ID (optional)"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-400/40"
          />
          <textarea
            value={manualActions}
            onChange={(e) => setManualActions(e.target.value)}
            placeholder='Paste JSON actions array, or object: {"seed":"...","loadoutId":"...","actions":[...]}'
            rows={6}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-400/40 font-mono"
          />
          {manualError && (
            <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">{manualError}</div>
          )}
          <button
            onClick={handleStartManualReplay}
            className="w-full py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-300 text-xs font-black uppercase tracking-widest transition-colors"
          >
            Start Manual Replay
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Hall of Fame</h3>
          <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Top 5 Only</span>
        </div>

        <div className="space-y-2">
          {leaderboard.length === 0 && (
            <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] text-center">
              <span className="text-[10px] text-white/30 uppercase font-black">No Champions Yet</span>
            </div>
          )}
          {leaderboard.slice(0, 5).map((e, i) => {
            const replay: ReplayRecord = {
              id: e.id,
              seed: e.seed,
              loadoutId: e.loadoutId,
              actions: e.actions || [],
              score: e.score,
              floor: e.floor,
              date: e.date,
              replayVersion: e.replayVersion,
              diagnostics: e.diagnostics
            };
            const q = analyzeReplay(replay);

            return (
              <button
                key={e.id}
                onClick={() => onStartReplay(replay)}
                className="w-full group relative flex items-center gap-4 p-4 bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-indigo-500/30 rounded-2xl transition-all text-left"
              >
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-indigo-500/10 rounded-lg text-indigo-400 font-black text-sm border border-indigo-500/20">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-black text-white uppercase text-xs truncate tracking-wider">{e.name}</span>
                    <span className="text-[10px] font-black text-indigo-400 tabular-nums">{e.score.toLocaleString()}</span>
                  </div>
                  <div className="text-[9px] text-white/30 font-bold uppercase tracking-widest">
                    Floor {e.floor} * {new Date(e.date).toLocaleDateString()} * {q.actionCount} acts
                  </div>
                  {q.label && (
                    <div className="text-[9px] mt-1 text-amber-400/80 font-bold uppercase tracking-widest">
                      {q.label}
                    </div>
                  )}
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 text-xs">Play</div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Recent Simulations</h3>
        </div>

        <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
          {list.length === 0 && (
            <div className="text-center py-4">
              <span className="text-[10px] text-white/10 uppercase font-bold">Log Empty</span>
            </div>
          )}
          {list.slice(0, 10).map((r) => {
            const q = analyzeReplay(r);
            return (
              <button
                key={r.id}
                onClick={() => onStartReplay(r)}
                className="w-full flex items-center justify-between p-3 hover:bg-white/[0.04] rounded-xl transition-colors text-left group"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-white/60 mb-0.5 truncate uppercase">
                    Score: <span className="text-white">{r.score}</span> * F{r.floor} * {q.actionCount} acts
                  </div>
                  <div className="text-[9px] text-white/20 font-medium">
                    {new Date(r.date).toLocaleTimeString()}
                  </div>
                  {q.label && (
                    <div className="text-[9px] mt-1 text-amber-400/80 font-bold uppercase tracking-widest">
                      {q.label}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-white/0 group-hover:text-white/40 font-black uppercase tracking-widest transition-all">Replay</div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default ReplayManager;
