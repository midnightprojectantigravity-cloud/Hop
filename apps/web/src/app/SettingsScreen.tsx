import React from 'react';
import { getUiInformationRevealMode, setUiInformationRevealMode, type UiInformationRevealMode } from './information-reveal';
import { UI_THEME_OPTIONS, type UiColorMode, type UiHudDensity, type UiMotionMode, type UiPreferencesV1 } from './ui-preferences';

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
  const [intelMode, setIntelMode] = React.useState<UiInformationRevealMode>(() => getUiInformationRevealMode());

  const handleIntelModeChange = (mode: UiInformationRevealMode) => {
    setIntelMode(mode);
    setUiInformationRevealMode(mode);
  };

  return (
    <div className="surface-app-material w-screen h-screen bg-[var(--surface-app)] text-[var(--text-primary)] font-[var(--font-body)] flex flex-col">
      <header className="surface-panel-material torn-edge-shell border-b border-[var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-3 flex items-center justify-between">
        <h1 className="text-sm font-black uppercase tracking-[0.2em] font-[var(--font-heading)]">Settings</h1>
        <button
          onClick={onBack}
          className="min-h-11 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-hover)] text-[10px] font-black uppercase tracking-widest"
        >
          Back
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5">
        <section className="surface-panel-material torn-edge-shell rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
          <h2 className="text-[11px] uppercase tracking-[0.2em] font-black text-[var(--text-muted)] mb-3">Theme</h2>
          <select
            aria-label="Theme"
            value={uiPreferences.colorMode}
            onChange={(event) => onSetColorMode(event.target.value as UiColorMode)}
            className="w-full min-h-11 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-primary)]"
          >
            {UI_THEME_OPTIONS.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.label}
              </option>
            ))}
          </select>
        </section>

        <section className="surface-panel-material torn-edge-shell rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
          <h2 className="text-[11px] uppercase tracking-[0.2em] font-black text-[var(--text-muted)] mb-3">Motion</h2>
          <button
            onClick={() => onSetMotionMode(uiPreferences.motionMode === 'snappy' ? 'reduced' : 'snappy')}
            className="w-full min-h-11 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[10px] font-black uppercase tracking-widest"
          >
            {uiPreferences.motionMode === 'snappy' ? 'Snappy' : 'Reduced'}
          </button>
        </section>

        <section className="surface-panel-material torn-edge-shell rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
          <h2 className="text-[11px] uppercase tracking-[0.2em] font-black text-[var(--text-muted)] mb-3">HUD Density</h2>
          <button
            onClick={() => onSetHudDensity(uiPreferences.hudDensity === 'compact' ? 'comfortable' : 'compact')}
            className="w-full min-h-11 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[10px] font-black uppercase tracking-widest"
          >
            {uiPreferences.hudDensity === 'compact' ? 'Compact' : 'Comfortable'}
          </button>
        </section>

        <section className="surface-panel-material torn-edge-shell rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
          <h2 className="text-[11px] uppercase tracking-[0.2em] font-black text-[var(--text-muted)] mb-3">Intel Policy (Debug)</h2>
          <select
            aria-label="Intel Policy"
            value={intelMode}
            onChange={(event) => handleIntelModeChange(event.target.value as UiInformationRevealMode)}
            className="w-full min-h-11 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-primary)]"
          >
            <option value="force_reveal">Force Reveal</option>
            <option value="strict">Strict</option>
          </select>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Debug control for capability-gated info reveal.
          </p>
        </section>
      </main>
    </div>
  );
};
