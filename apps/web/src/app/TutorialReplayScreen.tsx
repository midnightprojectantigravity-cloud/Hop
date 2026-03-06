import type { GameState } from '@hop/engine';
import { TutorialManager } from '../components/TutorialManager';

interface TutorialReplayScreenProps {
  onLoadScenario: (state: GameState, instructions: string) => void;
  onBack: () => void;
}

export const TutorialReplayScreen = ({ onLoadScenario, onBack }: TutorialReplayScreenProps) => {
  return (
    <div className="surface-app-material w-screen h-screen bg-[var(--surface-app)] text-[var(--text-primary)] font-[var(--font-body)] flex flex-col">
      <header className="surface-panel-material torn-edge-shell border-b border-[var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-3 flex items-center justify-between">
        <h1 className="text-sm font-black uppercase tracking-[0.2em] font-[var(--font-heading)]">Tutorials</h1>
        <button
          onClick={onBack}
          className="min-h-11 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-hover)] text-[10px] font-black uppercase tracking-widest"
        >
          Back
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="surface-panel-material torn-edge-shell rounded-2xl border border-[var(--accent-royal)] bg-[var(--accent-royal-soft)] p-3 text-[11px] uppercase tracking-[0.18em] font-black">
          Forced replay path is scaffolded in this release. Full guided lock-step path follows in tutorial milestone polish.
        </div>
        <TutorialManager onLoadScenario={onLoadScenario} />
      </main>
    </div>
  );
};
