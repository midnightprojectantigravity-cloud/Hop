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
    <div className="absolute top-4 right-4 z-40 max-w-xl px-4 py-3 rounded-xl border border-red-400/40 bg-red-900/70 text-red-100 text-xs font-bold tracking-wide">
      {replayError}
    </div>
  );
};

export const TutorialInstructionsOverlay = ({
  tutorialInstructions,
  onDismiss,
}: {
  tutorialInstructions: string | null;
  onDismiss: () => void;
}) => {
  if (!tutorialInstructions) return null;
  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-blue-900/90 border border-blue-500/30 p-4 rounded-xl backdrop-blur-md shadow-xl z-30 max-w-lg text-center animate-in fade-in slide-in-from-top-4">
      <h4 className="text-blue-200 font-bold uppercase text-xs tracking-widest mb-1">Simulation Objective</h4>
      <p className="text-white text-sm">{tutorialInstructions}</p>
      <button
        onClick={onDismiss}
        className="absolute -top-2 -right-2 w-6 h-6 bg-blue-950 rounded-full border border-blue-500/50 flex items-center justify-center text-xs hover:bg-blue-800 transition-colors"
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
        className="absolute top-3 sm:top-4 lg:top-6 left-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-black/55 border border-white/15 text-lg flex items-center justify-center text-white/80 animate-pulse"
        aria-label="Resolving turn"
        title="Resolving turn"
      >
        ...
      </div>
    </div>
  );
};

export const MobileToastsOverlay = ({ mobileToasts }: { mobileToasts: MobileToast[] }) => {
  if (mobileToasts.length === 0) return null;
  return (
    <div className="lg:hidden fixed left-1/2 -translate-x-1/2 top-16 z-50 pointer-events-none flex flex-col gap-2 w-[min(92vw,26rem)]">
      {mobileToasts.map((toast) => {
        const toneClass =
          toast.tone === 'damage'
            ? 'border-red-400/30 bg-red-950/75 text-red-100'
            : toast.tone === 'heal'
              ? 'border-emerald-400/30 bg-emerald-950/70 text-emerald-100'
              : toast.tone === 'status'
                ? 'border-cyan-300/30 bg-cyan-950/70 text-cyan-100'
                : 'border-white/15 bg-black/65 text-white/85';
        return (
          <div
            key={toast.id}
            className={`rounded-xl border px-3 py-2 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.35)] text-xs font-bold tracking-wide ${toneClass}`}
          >
            {toast.text}
          </div>
        );
      })}
    </div>
  );
};

export const RunLostOverlay = ({ visible, onReset }: { visible: boolean; onReset: () => void }) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-red-950/90 backdrop-blur-xl flex flex-col items-center justify-center z-[200] transition-opacity duration-500">
      <div className="text-8xl mb-8 animate-bounce">X</div>
      <h2 className="text-6xl font-black text-white mb-2 tracking-tighter italic uppercase">Identity Deleted</h2>
      <p className="text-red-200/60 mb-12 text-xl font-medium tracking-widest uppercase">Simulation Terminated</p>
      <button
        onClick={onReset}
        className="px-12 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.3)]"
      >
        Reinitialize Simulation
      </button>
    </div>
  );
};

export const RunWonOverlay = ({
  visible,
  score,
  onExitToHub,
}: {
  visible: boolean;
  score: number;
  onExitToHub: () => void;
}) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-indigo-950/90 backdrop-blur-xl flex flex-col items-center justify-center z-[200] transition-opacity duration-500">
      <div className="text-8xl mb-8 animate-bounce">OK</div>
      <h2 className="text-6xl font-black text-white mb-2 tracking-tighter italic uppercase">Arcade Mode Cleared</h2>
      <p className="text-indigo-200/60 mb-2 text-xl font-medium tracking-widest uppercase">The Sentinel has fallen</p>
      <p className="text-white/20 mb-12 text-sm font-bold uppercase tracking-[0.3em]">Score: {score}</p>
      <button
        onClick={onExitToHub}
        className="px-12 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.3)]"
      >
        Return to Command Center
      </button>
    </div>
  );
};

export const FloorIntroOverlay = ({ floorIntro }: { floorIntro: FloorIntroState }) => {
  if (!floorIntro) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center z-[150] pointer-events-none animate-in fade-in duration-700">
      <div className="text-center">
        <div className="text-indigo-500 font-black text-2xl uppercase tracking-[0.5em] mb-4 animate-in slide-in-from-bottom-8 duration-1000">Floor {floorIntro.floor}</div>
        <h2 className="text-8xl font-black text-white uppercase tracking-tighter italic animate-in slide-in-from-top-12 duration-1000">{floorIntro.theme}</h2>
        <div className="h-1 w-64 bg-white/20 mx-auto mt-8 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 animate-[progress_3s_linear]" />
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
  onToggleReplay,
  onStepReplay,
  onCloseReplay,
}: {
  isReplayMode: boolean;
  replayIndex: number;
  replayLength: number;
  replayActive: boolean;
  onToggleReplay: () => void;
  onStepReplay: () => void;
  onCloseReplay: () => void;
}) => {
  if (!isReplayMode) return null;
  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-[#030712]/90 border border-indigo-500/30 p-6 rounded-3xl backdrop-blur-2xl shadow-[0_0_50px_rgba(79,70,229,0.2)] z-[250] flex items-center gap-8 animate-in slide-in-from-bottom-8 duration-500">
      <div className="flex flex-col">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-1">Replay System</span>
        <span className="text-white font-bold text-sm">Step {replayIndex} / {replayLength}</span>
      </div>

      <div className="h-8 w-px bg-white/10" />

      <div className="flex items-center gap-4">
        <button
          onClick={onToggleReplay}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${replayActive ? 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.5)]' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
        >
          {replayActive ? 'PAUSE' : 'PLAY'}
        </button>
        <button
          onClick={onStepReplay}
          disabled={replayActive}
          className="w-12 h-12 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-white rounded-xl flex items-center justify-center transition-all"
        >
          NEXT
        </button>
      </div>

      <div className="h-8 w-px bg-white/10" />

      <button
        onClick={onCloseReplay}
        className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold uppercase text-xs tracking-widest transition-all"
      >
        Close
      </button>
    </div>
  );
};
