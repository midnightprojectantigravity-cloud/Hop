import React from 'react';
import type { BiomeSandboxSectionProps } from './shared';
import { FLOOR_THEMES } from './shared';

export const BiomeSandboxPreviewSection: React.FC<BiomeSandboxSectionProps> = ({
  settings,
  setSettings
}) => (
  <section className="space-y-3">
    <div className="text-xs font-black uppercase tracking-[0.2em] text-white/75">Preview</div>
    <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Theme</label>
    <select
      value={settings.theme}
      onChange={(e) => setSettings(prev => prev ? { ...prev, theme: e.target.value as typeof settings.theme } : prev)}
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
    >
      {FLOOR_THEMES.map(theme => (
        <option key={theme} value={theme}>{theme}</option>
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
      Inject synthetic lava/fire patches for mask testing
    </label>
  </section>
);
