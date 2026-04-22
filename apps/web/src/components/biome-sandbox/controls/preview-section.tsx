import React from 'react';
import type { FloorTheme } from '@hop/engine';
import type { BiomeSandboxPreviewSectionProps } from './shared';

const themeLabel = (theme: FloorTheme): string =>
  theme.charAt(0).toUpperCase() + theme.slice(1);

export const BiomeSandboxPreviewSection: React.FC<BiomeSandboxPreviewSectionProps> = ({
  settings,
  setSettings,
  themeOptions,
  onThemeChange
}) => (
  <section className="space-y-3">
    <div className="text-xs font-black uppercase tracking-[0.2em] text-white/75">Preview</div>
    <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Biome Preset</label>
    <select
      value={settings.theme}
      onChange={(e) => onThemeChange(e.target.value as FloorTheme)}
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
    >
      {themeOptions.map(theme => (
        <option key={theme} value={theme}>{themeLabel(theme)}</option>
      ))}
    </select>
    <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Seed</label>
    <input
      value={settings.seed}
      onChange={(e) => setSettings(prev => prev ? { ...prev, seed: e.target.value } : prev)}
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
    />
    <label className="flex items-center gap-2 text-xs text-white/80">
      <input
        type="checkbox"
        checked={settings.injectHazards}
        onChange={(e) => setSettings(prev => prev ? { ...prev, injectHazards: e.target.checked } : prev)}
      />
      Inject synthetic hazard patches for mask testing
    </label>
  </section>
);
