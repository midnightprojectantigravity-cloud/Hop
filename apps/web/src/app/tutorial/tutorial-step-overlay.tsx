import type { TutorialStepId } from './tutorial-state-machine';

export const TutorialStepOverlay = ({
  visible,
  title,
  body,
  allowedActionLabel,
  stepId,
  stepIndex,
  totalSteps,
  onSkip
}: {
  visible: boolean;
  title: string;
  body: string;
  allowedActionLabel: string;
  stepId: TutorialStepId;
  stepIndex: number;
  totalSteps: number;
  onSkip: () => void;
}) => {
  if (!visible) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[260] w-[min(92vw,34rem)] pointer-events-auto">
      <div className="surface-panel-material torn-edge-shell rounded-3xl border border-[var(--accent-royal)] bg-[color:var(--surface-panel)]/95 backdrop-blur-xl px-5 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.26em] text-[var(--accent-royal)]">
              Guided Tutorial {stepIndex + 1}/{totalSteps}
            </div>
            <h3 className="mt-1 text-base font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="min-h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]"
          >
            Skip
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-primary)]">{body}</p>
        <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-2">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Allowed Action</div>
          <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-primary)]">{allowedActionLabel}</div>
        </div>
        <div className="mt-4 flex gap-2">
          {(['movement', 'attack', 'wait'] as TutorialStepId[]).map((entry, index) => (
            <div
              key={entry}
              className={`h-2 flex-1 rounded-full ${index <= stepIndex ? 'bg-[var(--accent-royal)]' : 'bg-[var(--border-subtle)]'}`}
              aria-hidden
              data-tutorial-step={stepId}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export const TutorialOnboardingPrompt = ({
  visible,
  onStart,
  onContinue
}: {
  visible: boolean;
  onStart: () => void;
  onContinue: () => void;
}) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="surface-panel-material torn-edge-shell w-[min(92vw,38rem)] rounded-3xl border border-[var(--accent-royal)] bg-[var(--surface-panel)] p-6">
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--accent-royal)]">First Dawn In Hop</div>
        <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-[var(--text-primary)] font-[var(--font-heading)]">
          The March Begins In Ash
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-primary)]">
          The old roads are gone, the world is fractured into hexes, and every crossing is a wager against ruin. You wake as one
          more survivor carrying steel, memory, and a little light into the dark.
        </p>
        <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-4 py-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent-royal)]">First-Run Tutorial</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-primary)]">
            Learn movement, attack flow, and waiting in three quick guided encounters. If you would rather jump straight in, you
            can launch the tutorial later from Tutorials.
          </p>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">
          This intro only appears on first load unless you choose to start the tutorial now.
        </p>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onStart}
            className="min-h-12 rounded-2xl border border-[var(--accent-royal)] bg-[var(--accent-royal-soft)] text-[var(--text-primary)] text-xs font-black uppercase tracking-[0.18em]"
          >
            Start Tutorial
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="min-h-12 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[var(--text-muted)] text-xs font-black uppercase tracking-[0.18em]"
          >
            Continue To Hub
          </button>
        </div>
      </div>
    </div>
  );
};
