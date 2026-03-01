import React from 'react';
import type { BiomeSandboxSectionProps } from './shared';
import { clamp, toNumber } from '../state/settings-utils';

export const BiomeSandboxClutterSection: React.FC<BiomeSandboxSectionProps> = ({
  settings,
  setSettings
}) => (
  <section className="space-y-3 pb-8">
    <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Clutter</div>
    <div>
      <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Density</label>
      <input
        type="number"
        min={0}
        max={1}
        step={0.01}
        value={settings.clutter.density}
        onChange={(e) => setSettings(prev => prev ? { ...prev, clutter: { ...prev.clutter, density: clamp(toNumber(e.target.value, prev.clutter.density), 0, 1) } } : prev)}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
      />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Max / Hex</label>
        <input
          type="number"
          min={0}
          max={5}
          step={1}
          value={settings.clutter.maxPerHex}
          onChange={(e) => setSettings(prev => prev ? { ...prev, clutter: { ...prev.clutter, maxPerHex: Math.max(0, Math.floor(toNumber(e.target.value, prev.clutter.maxPerHex))) } } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Bleed Max</label>
        <input
          type="number"
          min={1}
          max={2}
          step={0.01}
          value={settings.clutter.bleedScaleMax}
          onChange={(e) => setSettings(prev => prev ? { ...prev, clutter: { ...prev.clutter, bleedScaleMax: clamp(toNumber(e.target.value, prev.clutter.bleedScaleMax), 1, 2) } } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
    </div>
  </section>
);
