import type { GameState } from '@hop/engine';
import { TutorialManager } from '../components/TutorialManager';
import type { TutorialProgress } from './tutorial/tutorial-state-machine';

interface TutorialReplayScreenProps {
  onLoadScenario: (state: GameState, instructions: string) => void;
  onStartGuidedTutorial: () => void;
  tutorialProgress: TutorialProgress;
  onResetTutorialProgress: () => void;
  onSkipTutorial: () => void;
  onBack: () => void;
}

export const TutorialReplayScreen = ({
  onLoadScenario,
  onStartGuidedTutorial,
  tutorialProgress,
  onResetTutorialProgress,
  onSkipTutorial,
  onBack
}: TutorialReplayScreenProps) => {
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
        <section className="surface-panel-material torn-edge-shell rounded-3xl border border-[var(--accent-royal)] bg-[var(--accent-royal-soft)] p-5">
          <div className="text-[10px] uppercase tracking-[0.22em] font-black text-[var(--accent-royal)]">Guided Tutorial</div>
          <h2 className="mt-2 text-lg font-black uppercase tracking-tight">Three-step onboarding</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Learn movement, attacking, and waiting through deterministic training setups. This path is UI-guided and can be relaunched at any time.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onStartGuidedTutorial}
              className="min-h-11 rounded-xl border border-[var(--accent-royal)] bg-[var(--surface-panel)] px-4 text-[10px] font-black uppercase tracking-[0.18em]"
            >
              {tutorialProgress.completed ? 'Replay Guided Tutorial' : 'Start Guided Tutorial'}
            </button>
            <button
              type="button"
              onClick={onResetTutorialProgress}
              className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-4 text-[10px] font-black uppercase tracking-[0.18em]"
            >
              Reset Progress
            </button>
            {!tutorialProgress.skipped && !tutorialProgress.completed ? (
              <button
                type="button"
                onClick={onSkipTutorial}
                className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-transparent px-4 text-[10px] font-black uppercase tracking-[0.18em]"
              >
                Skip For Now
              </button>
            ) : null}
          </div>
        </section>

        <div className="surface-panel-material torn-edge-shell rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
          <div className="text-[10px] uppercase tracking-[0.22em] font-black text-[var(--text-muted)]">Scenario Browser</div>
          <div className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Legacy skill scenarios remain available for training and debugging.
          </div>
        </div>
        <TutorialManager onLoadScenario={onLoadScenario} />
      </main>
    </div>
  );
};
