import React from 'react';
import type { BiomeSandboxPathSectionProps } from './shared';
import { MODE_OPTIONS } from './shared';
import { toNumber } from '../state/settings-utils';

export const BiomeSandboxCrustSection: React.FC<BiomeSandboxPathSectionProps> = ({
  settings,
  setSettings,
  pathSets
}) => (
  <section className="space-y-3">
    <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">Crust</div>
    <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Asset Path</label>
    <input
      list="sandbox-crust-paths"
      value={settings.crust.path}
      onChange={(e) => setSettings(prev => prev ? { ...prev, crust: { ...prev.crust, path: e.target.value } } : prev)}
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs"
    />
    <datalist id="sandbox-crust-paths">
      {pathSets.crust.map(path => (
        <option key={path} value={path} />
      ))}
    </datalist>
    <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Mode</label>
    <select
      value={settings.crust.mode}
      onChange={(e) => setSettings(prev => prev ? { ...prev, crust: { ...prev.crust, mode: e.target.value as typeof settings.crust.mode } } : prev)}
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
    >
      {MODE_OPTIONS.map(mode => (
        <option key={mode} value={mode}>{mode}</option>
      ))}
    </select>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Scale Px</label>
        <input
          type="number"
          min={64}
          step={16}
          value={settings.crust.scalePx}
          onChange={(e) => setSettings(prev => prev ? { ...prev, crust: { ...prev.crust, scalePx: Math.max(64, toNumber(e.target.value, prev.crust.scalePx)) } } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Opacity</label>
        <input
          type="number"
          min={1}
          max={1}
          step={0.01}
          value={1}
          onChange={() => setSettings(prev => prev ? { ...prev, crust: { ...prev.crust, opacity: 1 } } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
    </div>
    <div>
      <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Seed Shift Budget</label>
      <input
        type="number"
        min={0}
        step={8}
        value={settings.crust.seedShiftPx}
        onChange={(e) => setSettings(prev => prev ? { ...prev, crust: { ...prev.crust, seedShiftPx: Math.max(0, toNumber(e.target.value, prev.crust.seedShiftPx)) } } : prev)}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
      />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Offset X</label>
        <input
          type="number"
          step={4}
          value={settings.crust.offsetX}
          onChange={(e) => setSettings(prev => prev ? { ...prev, crust: { ...prev.crust, offsetX: toNumber(e.target.value, prev.crust.offsetX) } } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Offset Y</label>
        <input
          type="number"
          step={4}
          value={settings.crust.offsetY}
          onChange={(e) => setSettings(prev => prev ? { ...prev, crust: { ...prev.crust, offsetY: toNumber(e.target.value, prev.crust.offsetY) } } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
    </div>
  </section>
);
