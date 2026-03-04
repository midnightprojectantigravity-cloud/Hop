import type { UiColorMode, UiHudDensity, UiMotionMode, UiPreferencesV1 } from './ui-preferences';

interface SettingsScreenProps {
  uiPreferences: UiPreferencesV1;
  onSetColorMode: (mode: UiColorMode) => void;
  onSetMotionMode: (mode: UiMotionMode) => void;
  onSetHudDensity: (density: UiHudDensity) => void;
  onBack: () => void;
}

export const SettingsScreen = ({
  uiPreferences,
  onSetColorMode,
  onSetMotionMode,
  onSetHudDensity,
  onBack
}: SettingsScreenProps) => {
  return (
    <div className="w-screen h-screen bg-[var(--surface-app)] text-[var(--text-primary)] font-[var(--font-body)] flex flex-col">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-3 flex items-center justify-between">
        <h1 className="text-sm font-black uppercase tracking-[0.2em] font-[var(--font-heading)]">Settings</h1>
        <button
          onClick={onBack}
          className="min-h-11 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-hover)] text-[10px] font-black uppercase tracking-widest"
        >
          Back
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5">
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
          <h2 className="text-[11px] uppercase tracking-[0.2em] font-black text-[var(--text-muted)] mb-3">Color Mode</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSetColorMode('light')}
              className={`min-h-11 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                uiPreferences.colorMode === 'light'
                  ? 'bg-[var(--accent-brass-soft)] border-[var(--accent-brass)]'
                  : 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)]'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => onSetColorMode('dark')}
              className={`min-h-11 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                uiPreferences.colorMode === 'dark'
                  ? 'bg-[var(--accent-danger-soft)] border-[var(--accent-danger)]'
                  : 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)]'
              }`}
            >
              Dark
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
          <h2 className="text-[11px] uppercase tracking-[0.2em] font-black text-[var(--text-muted)] mb-3">Motion</h2>
          <button
            onClick={() => onSetMotionMode(uiPreferences.motionMode === 'snappy' ? 'reduced' : 'snappy')}
            className="w-full min-h-11 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[10px] font-black uppercase tracking-widest"
          >
            {uiPreferences.motionMode === 'snappy' ? 'Snappy' : 'Reduced'}
          </button>
        </section>

        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
          <h2 className="text-[11px] uppercase tracking-[0.2em] font-black text-[var(--text-muted)] mb-3">HUD Density</h2>
          <button
            onClick={() => onSetHudDensity(uiPreferences.hudDensity === 'compact' ? 'comfortable' : 'compact')}
            className="w-full min-h-11 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[10px] font-black uppercase tracking-widest"
          >
            {uiPreferences.hudDensity === 'compact' ? 'Compact' : 'Comfortable'}
          </button>
        </section>
      </main>
    </div>
  );
};

