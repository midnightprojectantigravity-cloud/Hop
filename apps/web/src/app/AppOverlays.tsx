import type { UiMotionMode } from './ui-preferences';
import { resolveTransitionClasses } from './screen-transition-shell';

type MobileToast = {
  id: string;
  text: string;
  tone: 'damage' | 'heal' | 'status' | 'system';
  createdAt: number;
};

type FloorIntroState = { floor: number; theme: string } | null;

export const ReplayErrorOverlay = ({ replayError }: { replayError: string | null }) => {
  if (!replayError) return null;
  return (
    <div className="absolute top-4 right-4 z-40 max-w-xl px-4 py-3 rounded-xl border border-[var(--accent-danger-border)] bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] text-xs font-bold tracking-wide">
      {replayError}
    </div>
  );
};

export const TutorialInstructionsOverlay = ({
  tutorialInstructions,
  motionMode = 'snappy',
  onDismiss,
}: {
  tutorialInstructions: string | null;
  motionMode?: UiMotionMode;
  onDismiss: () => void;
}) => {
  if (!tutorialInstructions) return null;
  return (
    <div className={`absolute top-8 left-1/2 -translate-x-1/2 bg-[var(--accent-royal-soft)] border border-[var(--accent-royal)] p-4 rounded-xl backdrop-blur-md shadow-xl z-30 max-w-lg text-center ${resolveTransitionClasses(motionMode, 'overlay')}`}>
      <h4 className="text-[var(--accent-royal)] font-bold uppercase text-xs tracking-widest mb-1">Simulation Objective</h4>
      <p className="text-[var(--text-primary)] text-sm">{tutorialInstructions}</p>
      <button
        onClick={onDismiss}
        className="absolute -top-2 -right-2 w-6 h-6 bg-[var(--surface-panel)] rounded-full border border-[var(--accent-royal)] flex items-center justify-center text-xs hover:bg-[var(--surface-panel-hover)] transition-colors"
      >
        X
      </button>
    </div>
  );
};

export const ResolvingTurnOverlay = ({ visible }: { visible: boolean }) => {
  if (!visible) return null;
  return (
    <div className="absolute inset-0 z-40 pointer-events-auto">
      <div
        className="absolute top-3 sm:top-4 lg:top-6 left-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-[color:var(--surface-panel)] border border-[var(--border-subtle)] text-lg flex items-center justify-center text-[var(--text-secondary)] animate-pulse"
        aria-label="Resolving turn"
        title="Resolving turn"
      >
        ...
      </div>
    </div>
  );
};

export const MobileToastsOverlay = ({
  mobileToasts,
  motionMode = 'snappy'
}: {
  mobileToasts: MobileToast[];
  motionMode?: UiMotionMode;
}) => {
  if (mobileToasts.length === 0) return null;
  return (
    <div
      data-mobile-toasts-overlay
      className="lg:hidden absolute bottom-3 right-3 z-50 pointer-events-none flex flex-col items-end gap-2 w-[min(58vw,16rem)]"
    >
      {mobileToasts.map((toast) => {
        const toneClass =
          toast.tone === 'damage'
            ? 'border-red-400/30 bg-red-950/75 text-red-100'
            : toast.tone === 'heal'
              ? 'border-emerald-400/30 bg-emerald-950/70 text-emerald-100'
              : toast.tone === 'status'
                ? 'border-cyan-300/30 bg-cyan-950/70 text-cyan-100'
                : 'border-[var(--border-subtle)] bg-[color:var(--surface-panel)] text-[var(--text-primary)]';
        return (
          <div
            key={toast.id}
            className={`rounded-xl border px-3 py-2 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.35)] text-xs font-bold tracking-wide ${toneClass} ${resolveTransitionClasses(motionMode, 'overlay')}`}
          >
            {toast.text}
          </div>
        );
      })}
    </div>
  );
};

export const RunLostOverlay = ({
  visible,
  motionMode = 'snappy',
  onQuickRestart,
  onViewReplay,
  onActionsReady
}: {
  visible: boolean;
  motionMode?: UiMotionMode;
  onQuickRestart: () => void;
  onViewReplay: () => void;
  onActionsReady?: () => void;
}) => {
  if (!visible) return null;
  onActionsReady?.();
  return (
    <div className={`fixed inset-0 bg-[color:var(--overlay-defeat)] backdrop-blur-xl flex flex-col items-center justify-center z-[200] px-6 ${resolveTransitionClasses(motionMode, 'overlay')}`}>
      <div className="w-[min(92vw,34rem)] rounded-3xl border border-[var(--accent-danger-border)] bg-[color:var(--surface-panel)] p-8 text-center">
        <h2 className="text-3xl sm:text-5xl font-black text-[var(--text-primary)] mb-2 tracking-tighter uppercase font-[var(--font-heading)]">Defeat</h2>
        <p className="text-[var(--text-muted)] mb-8 text-sm sm:text-base font-bold uppercase tracking-[0.18em]">
          Your run ended. Continue immediately or inspect the replay.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={onQuickRestart}
            className="min-h-12 px-6 py-3 rounded-xl border border-[var(--accent-brass)] bg-[var(--accent-brass-soft)] text-[var(--text-primary)] font-black uppercase tracking-widest hover:brightness-105"
          >
            Quick Restart
          </button>
          <button
            onClick={onViewReplay}
            className="min-h-12 px-6 py-3 rounded-xl border border-[var(--accent-royal)] bg-[var(--accent-royal-soft)] text-[var(--text-primary)] font-black uppercase tracking-widest hover:brightness-105"
          >
            View Replay
          </button>
        </div>
      </div>
    </div>
  );
};

export const RunWonOverlay = ({
  visible,
  motionMode = 'snappy',
  score,
  onExitToHub,
}: {
  visible: boolean;
  motionMode?: UiMotionMode;
  score: number;
  onExitToHub: () => void;
}) => {
  if (!visible) return null;
  return (
    <div className={`fixed inset-0 bg-[color:var(--overlay-victory)] backdrop-blur-xl flex flex-col items-center justify-center z-[200] ${resolveTransitionClasses(motionMode, 'overlay')}`}>
      <h2 className="text-4xl sm:text-6xl font-black text-[var(--text-primary)] mb-2 tracking-tighter uppercase font-[var(--font-heading)]">Arcade Cleared</h2>
      <p className="text-[var(--text-muted)] mb-2 text-base sm:text-xl font-medium tracking-widest uppercase">The Sentinel has fallen</p>
      <p className="text-[var(--text-muted)] mb-12 text-sm font-bold uppercase tracking-[0.3em]">Score: {score}</p>
      <button
        onClick={onExitToHub}
        className="px-12 py-4 bg-[var(--surface-panel)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-2xl font-black uppercase tracking-widest hover:brightness-105 transition-all"
      >
        Home
      </button>
    </div>
  );
};

export const FloorIntroOverlay = ({
  floorIntro,
  motionMode = 'snappy'
}: {
  floorIntro: FloorIntroState;
  motionMode?: UiMotionMode;
}) => {
  if (!floorIntro) return null;
  return (
    <div className={`fixed inset-0 flex items-center justify-center z-[150] pointer-events-none ${resolveTransitionClasses(motionMode, 'floor')}`}>
      <div className="text-center">
        <div className={`text-[var(--accent-royal)] font-black text-2xl uppercase tracking-[0.5em] mb-4 ${resolveTransitionClasses(motionMode, 'floor')}`}>Floor {floorIntro.floor}</div>
        <h2 className={`text-6xl sm:text-8xl font-black text-[var(--text-primary)] uppercase tracking-tighter ${resolveTransitionClasses(motionMode, 'floor')}`}>{floorIntro.theme}</h2>
        <div className="h-1 w-64 bg-[var(--surface-panel-hover)] mx-auto mt-8 rounded-full overflow-hidden">
          <div className={`h-full bg-[var(--accent-royal)] ${motionMode === 'reduced' ? 'w-full' : 'animate-[progress_3s_linear]'}`} />
        </div>
      </div>
    </div>
  );
};

export const ReplayControlsOverlay = ({
  isReplayMode,
  replayIndex,
  replayLength,
  replayActive,
  motionMode = 'snappy',
  onToggleReplay,
  onStepReplay,
  onJumpReplay,
  markerIndices,
  onCloseReplay,
}: {
  isReplayMode: boolean;
  replayIndex: number;
  replayLength: number;
  replayActive: boolean;
  motionMode?: UiMotionMode;
  onToggleReplay: () => void;
  onStepReplay: () => void;
  onJumpReplay?: (index: number) => void;
  markerIndices?: number[];
  onCloseReplay: () => void;
}) => {
  if (!isReplayMode) return null;
  const pipTargets = (() => {
    if (markerIndices && markerIndices.length > 0) {
      return Array.from(new Set(markerIndices.filter((index) => index >= 0 && index <= replayLength))).sort((a, b) => a - b);
    }
    const pipCount = replayLength <= 0 ? 0 : Math.min(8, replayLength + 1);
    if (pipCount <= 1) return [0];
    return Array.from({ length: pipCount }, (_, index) => Math.round((index / (pipCount - 1)) * replayLength));
  })();

  return (
    <div className={`fixed top-3 sm:top-auto sm:bottom-12 left-1/2 -translate-x-1/2 w-[min(94vw,40rem)] sm:w-auto bg-[color:var(--surface-panel)] border border-[var(--accent-royal)] p-4 sm:p-6 rounded-3xl backdrop-blur-2xl shadow-[0_0_50px_rgba(79,70,229,0.15)] z-[250] flex flex-col sm:flex-row items-center gap-4 sm:gap-8 ${resolveTransitionClasses(motionMode, 'overlay')}`}>
      <div className="flex flex-col">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent-royal)] mb-1">Replay System</span>
        <span className="text-[var(--text-primary)] font-bold text-sm">Step {replayIndex} / {replayLength}</span>
      </div>

      <div className="hidden sm:block h-8 w-px bg-[var(--border-subtle)]" />

      <div className="flex items-center gap-4">
        <button
          onClick={onToggleReplay}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${replayActive ? 'bg-[var(--accent-royal)] text-[var(--text-inverse)] shadow-[0_0_20px_rgba(79,70,229,0.5)]' : 'bg-[var(--surface-panel-hover)] text-[var(--text-muted)] hover:bg-[var(--surface-panel)]'}`}
        >
          {replayActive ? 'PAUSE' : 'PLAY'}
        </button>
        <button
          onClick={onStepReplay}
          disabled={replayActive}
          className="w-12 h-12 bg-[var(--surface-panel-hover)] hover:bg-[var(--surface-panel)] disabled:opacity-30 text-[var(--text-primary)] rounded-xl flex items-center justify-center transition-all"
        >
          NEXT
        </button>
      </div>

      <div className="hidden sm:block h-8 w-px bg-[var(--border-subtle)]" />

      <button
        onClick={onCloseReplay}
        className="w-full sm:w-auto px-6 py-3 bg-[var(--accent-danger-soft)] hover:brightness-105 text-[var(--accent-danger)] rounded-xl font-bold uppercase text-xs tracking-widest transition-all"
      >
        Close
      </button>
      <div className={`w-full sm:w-auto items-center justify-center gap-1.5 ${onJumpReplay ? 'flex' : 'hidden'}`}>
        {pipTargets.map((index) => (
          <button
            key={`replay-pip-${index}`}
            onClick={() => onJumpReplay?.(index)}
            disabled={replayActive}
            className={`h-2.5 rounded-full transition-all disabled:opacity-30 ${
              replayIndex === index
                ? 'w-6 bg-[var(--accent-royal)]'
                : 'w-2.5 bg-[var(--border-subtle)] hover:bg-[var(--accent-royal-soft)]'
            }`}
            title={`Jump to ${index}`}
          />
        ))}
      </div>
    </div>
  );
};
