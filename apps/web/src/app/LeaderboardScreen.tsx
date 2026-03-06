import type { GameState } from '@hop/engine';
import ReplayManager from '../components/ReplayManager';
import type { ReplayRecord } from '../components/ReplayManager';

interface LeaderboardScreenProps {
  gameState: GameState;
  onStartReplay: (record: ReplayRecord) => void;
  onBack: () => void;
}

export const LeaderboardScreen = ({ gameState, onStartReplay, onBack }: LeaderboardScreenProps) => {
  return (
    <div className="surface-app-material w-screen h-screen bg-[var(--surface-app)] text-[var(--text-primary)] font-[var(--font-body)] flex flex-col">
      <header className="surface-panel-material torn-edge-shell border-b border-[var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-3 flex items-center justify-between">
        <h1 className="text-sm font-black uppercase tracking-[0.2em] font-[var(--font-heading)]">Leaderboard</h1>
        <button
          onClick={onBack}
          className="min-h-11 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-hover)] text-[10px] font-black uppercase tracking-widest"
        >
          Back
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <ReplayManager gameState={gameState} onStartReplay={onStartReplay} />
      </main>
    </div>
  );
};
