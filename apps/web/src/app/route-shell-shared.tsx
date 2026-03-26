import splashPlaceholderImage from '../assets/ui/splash-placeholder.webp';

export type WorldgenUiError = {
  kind: 'init' | 'start_run' | 'stairs';
  message: string;
};

export const AppScreenFallback = ({ label }: { label: string }) => (
  <div className="surface-app-material w-screen h-screen flex items-center justify-center bg-[var(--surface-app)] text-[var(--text-muted)] text-xs font-black uppercase tracking-[0.28em]">
    {label}
  </div>
);

export const ArcadeSplashGate = ({
  worldgenInitialized,
  worldgenWarmState,
  waitingForReady,
  showDelayedPulse,
  statusLine,
  error,
  onStartArcade,
  onOpenHub
}: {
  worldgenInitialized: boolean;
  worldgenWarmState: 'idle' | 'warming' | 'ready' | 'error';
  waitingForReady: boolean;
  showDelayedPulse: boolean;
  statusLine?: string;
  error?: string;
  onStartArcade: () => void;
  onOpenHub: () => void;
}) => {
  const primaryLabel = waitingForReady
    ? (worldgenInitialized ? 'Starting...' : 'Preparing...')
    : 'Start';

  return (
    <div className="w-screen h-screen relative overflow-hidden bg-[var(--surface-app)] text-[var(--text-inverse)]">
      <div
        className="absolute inset-0 bg-center bg-cover arcade-splash-layer"
        style={{
          backgroundImage: `url('${splashPlaceholderImage}')`
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(241,200,117,0.18),transparent_34%),linear-gradient(180deg,rgba(8,5,2,0.28),rgba(8,5,2,0.62)_48%,rgba(8,5,2,0.82))]" />
      <div data-arcade-splash-shell className="arcade-splash-shell absolute inset-0">
        <div className="arcade-splash-panel mx-auto h-full w-full max-w-6xl text-center">
          <div data-arcade-splash-title-stack className="arcade-splash-title-stack">
            <h1 className="splash-title-main font-[var(--font-heading)]">ASHES</h1>
            <h2 className="splash-title-connector font-[var(--font-heading)]">OF THE</h2>
            <h1 className="splash-title-main font-[var(--font-heading)]">WORLD</h1>
          </div>
          <div data-arcade-splash-action-stack className="arcade-splash-action-stack mx-auto w-full max-w-sm">
            <div className="flex w-full flex-col justify-center gap-3">
              <button
                type="button"
                onClick={onStartArcade}
                disabled={waitingForReady}
                className={`min-h-12 w-full rounded-2xl border text-xs font-black uppercase tracking-[0.2em] ${
                  waitingForReady
                    ? 'border-white/20 bg-white/10 text-white/60'
                    : 'border-amber-300/50 bg-amber-100/20 text-amber-50 hover:bg-amber-100/28'
                }`}
              >
                {primaryLabel}
              </button>
              <button
                type="button"
                onClick={onOpenHub}
                className="min-h-12 w-full rounded-2xl border border-white/30 bg-white/10 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-white/15"
              >
                Hub
              </button>
            </div>
            {waitingForReady && (
              <div
                className={`mt-4 rounded-xl border border-white/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] ${
                  showDelayedPulse ? 'arcade-ready-pulse' : ''
                }`}
              >
                {statusLine || (worldgenWarmState === 'warming' ? 'Warming worldgen runtime...' : 'Worldgen runtime standing by')}
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-xl border border-red-300/40 bg-red-950/50 px-3 py-3 text-[11px] text-red-100">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-200">Worldgen Error</div>
                <div className="mt-1 leading-relaxed">{error}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const WorldgenErrorOverlay = ({
  error,
  progressLabel,
  onDismiss,
  onRetry,
  onExitToHub
}: {
  error: WorldgenUiError | null;
  progressLabel?: string;
  onDismiss: () => void;
  onRetry?: () => void;
  onExitToHub?: () => void;
}) => {
  if (!error) return null;

  const heading = error.kind === 'init' ? 'Worldgen Runtime Blocked' : 'Worldgen Compile Blocked';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 px-4">
      <div className="w-full max-w-md rounded-3xl border border-red-300/30 bg-[var(--surface-panel)] p-5 text-[var(--text-primary)] shadow-2xl">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-red-400">{heading}</div>
        <div className="mt-3 text-sm leading-relaxed">{error.message}</div>
        {progressLabel && (
          <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {progressLabel}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 rounded-xl bg-[var(--accent-brass)] px-4 text-xs font-black uppercase tracking-[0.16em] text-[var(--text-inverse)]"
            >
              Retry
            </button>
          )}
          {onExitToHub && (
            <button
              type="button"
              onClick={onExitToHub}
              className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-4 text-xs font-black uppercase tracking-[0.16em]"
            >
              Home
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-transparent px-4 text-xs font-black uppercase tracking-[0.16em]"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
