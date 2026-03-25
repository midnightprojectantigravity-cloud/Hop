import type { BootState } from './boot-state';
import type { UiPreferencesV2 } from './ui-preferences';

export const AppBootOverlay = ({
  bootState,
  motionMode,
  splashImage
}: {
  bootState: BootState;
  motionMode: UiPreferencesV2['motionMode'];
  splashImage: string;
}) => {
  const reducedMotion = motionMode === 'reduced';

  return (
    <div
      className={`fixed inset-0 z-[115] overflow-hidden bg-[var(--surface-app)] text-[var(--text-inverse)] ${
        reducedMotion ? 'transition-opacity duration-150' : 'transition-opacity duration-500'
      }`}
      aria-live="polite"
      aria-label="Application boot status"
    >
      <div
        className="absolute inset-0 bg-center bg-cover opacity-70"
        style={{ backgroundImage: `url('${splashImage}')` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(233,196,106,0.18),transparent_48%),linear-gradient(180deg,rgba(9,6,3,0.5),rgba(9,6,3,0.88))]" />
      <div className="relative flex min-h-full items-end justify-center p-5 sm:p-8">
        <div className="w-full max-w-3xl rounded-[28px] border border-white/15 bg-black/45 p-5 shadow-2xl backdrop-blur-md sm:p-7">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-100/75">
            Boot Sequence
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-[var(--font-heading)] text-3xl font-black uppercase tracking-[0.04em] sm:text-5xl">
                Hop
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-amber-50/82 sm:text-base">
                Preparing the parchment shell and loading the visual atlas.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-amber-50/88">
              {bootState.statusLine}
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {bootState.milestones.map((milestone) => (
              <div
                key={milestone.id}
                className={`rounded-2xl border px-4 py-4 ${
                  milestone.ready
                    ? 'border-emerald-300/35 bg-emerald-100/10'
                    : 'border-white/15 bg-white/6'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-50/75">
                    {milestone.label}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase tracking-[0.18em] ${
                      milestone.ready ? 'text-emerald-200' : 'text-amber-100/65'
                    }`}
                  >
                    {milestone.ready ? 'Ready' : 'Pending'}
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/30">
                  <div
                    className={`h-full rounded-full ${
                      milestone.ready ? 'bg-emerald-300' : 'bg-amber-200/55'
                    } ${!reducedMotion && !milestone.ready ? 'animate-pulse' : ''}`}
                    style={{ width: milestone.ready ? '100%' : '42%' }}
                  />
                </div>
                <div className="mt-3 text-xs leading-relaxed text-amber-50/72">
                  {milestone.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
