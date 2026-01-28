import React, { useState, useEffect } from 'react';
import type { GameState } from '@hop/engine';

export interface ReplayRecord {
  id: string;
  seed?: string;
  actions: any[]; // Changed to any[] for simplicity if Action type is tricky
  score: number;
  floor: number;
  date: string;
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

export const ReplayManager: React.FC<{
  gameState: GameState;
  onStartReplay: (r: ReplayRecord) => void;
}> = ({ onStartReplay }) => {
  const [list, setList] = useState<ReplayRecord[]>(() => loadAll());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => loadLeaderboard());

  // Use an effect to sync with localStorage periodically or on change
  useEffect(() => {
    const handleStorage = () => {
      setList(loadAll());
      setLeaderboard(loadLeaderboard());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <div className="flex flex-col gap-8">
      {/* Top 5 Leaderboard */}
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
          {leaderboard.slice(0, 5).map((e, i) => (
            <button
              key={e.id}
              onClick={() => onStartReplay({
                id: e.id,
                seed: e.seed,
                actions: (e as any).actions || [],
                score: e.score,
                floor: e.floor,
                date: e.date
              })}
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
                  Floor {e.floor} • {new Date(e.date).toLocaleDateString()}
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 text-xs">▶</div>
            </button>
          ))}
        </div>
      </section>

      {/* Recent Runs */}
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
          {list.slice(0, 10).map((r) => (
            <button
              key={r.id}
              onClick={() => onStartReplay(r)}
              className="w-full flex items-center justify-between p-3 hover:bg-white/[0.04] rounded-xl transition-colors text-left group"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-white/60 mb-0.5 truncate uppercase">
                  Score: <span className="text-white">{r.score}</span> • F{r.floor}
                </div>
                <div className="text-[9px] text-white/20 font-medium">
                  {new Date(r.date).toLocaleTimeString()}
                </div>
              </div>
              <div className="text-[10px] text-white/0 group-hover:text-white/40 font-black uppercase tracking-widest transition-all">Replay</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ReplayManager;
