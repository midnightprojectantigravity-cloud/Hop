import React from 'react';
import type { BiomeSandboxPathSectionProps } from './shared';
import { MODE_OPTIONS } from './shared';
import {
  UNDERCURRENT_SCALE_MAX,
  UNDERCURRENT_SCALE_MIN,
  clamp,
  toNumber
} from '../state/settings-utils';

export const BiomeSandboxUndercurrentSection: React.FC<BiomeSandboxPathSectionProps> = ({
  settings,
  setSettings,
  pathSets
}) => (
  <section className="space-y-3">
    <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Undercurrent</div>
    <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Asset Path</label>
    <input
      list="sandbox-undercurrent-paths"
      value={settings.undercurrent.path}
      onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, path: e.target.value } } : prev)}
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs"
    />
    <datalist id="sandbox-undercurrent-paths">
      {pathSets.undercurrent.map(path => (
        <option key={path} value={path} />
      ))}
    </datalist>
    <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Mode</label>
    <select
      value={settings.undercurrent.mode}
      onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, mode: e.target.value as typeof settings.undercurrent.mode } } : prev)}
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
          min={UNDERCURRENT_SCALE_MIN}
          max={UNDERCURRENT_SCALE_MAX}
          step={16}
          value={settings.undercurrent.scalePx}
          onChange={(e) => setSettings(prev => prev ? {
            ...prev,
            undercurrent: {
              ...prev.undercurrent,
              scalePx: clamp(toNumber(e.target.value, prev.undercurrent.scalePx), UNDERCURRENT_SCALE_MIN, UNDERCURRENT_SCALE_MAX)
            }
          } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Opacity</label>
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={settings.undercurrent.opacity}
          onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, opacity: clamp(toNumber(e.target.value, prev.undercurrent.opacity), 0, 1) } } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Scroll X</label>
        <input
          type="number"
          step={5}
          value={settings.undercurrent.scrollX}
          onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, scrollX: toNumber(e.target.value, prev.undercurrent.scrollX) } } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Scroll Y</label>
        <input
          type="number"
          step={5}
          value={settings.undercurrent.scrollY}
          onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, scrollY: toNumber(e.target.value, prev.undercurrent.scrollY) } } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Duration</label>
        <input
          type="number"
          min={1000}
          step={500}
          value={settings.undercurrent.scrollDurationMs}
          onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, scrollDurationMs: Math.max(1000, toNumber(e.target.value, prev.undercurrent.scrollDurationMs)) } } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Offset X</label>
        <input
          type="number"
          step={4}
          value={settings.undercurrent.offsetX}
          onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, offsetX: toNumber(e.target.value, prev.undercurrent.offsetX) } } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Offset Y</label>
        <input
          type="number"
          step={4}
          value={settings.undercurrent.offsetY}
          onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, offsetY: toNumber(e.target.value, prev.undercurrent.offsetY) } } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
    </div>
  </section>
);
