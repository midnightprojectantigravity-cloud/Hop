import React from 'react';
import type { BiomeSandboxPathSectionProps } from './shared';
import {
  BLEND_OPTIONS,
  MODE_OPTIONS,
  TINT_SWATCHES
} from './shared';
import {
  DETAIL_SCALE_MAX,
  DETAIL_SCALE_MIN,
  clamp,
  normalizeHexColor,
  readBlendMode,
  toNumber
} from '../state/settings-utils';

interface BiomeSandboxMaterialsSectionProps extends BiomeSandboxPathSectionProps {
  tintPickerColor: string;
}

export const BiomeSandboxMaterialsSection: React.FC<BiomeSandboxMaterialsSectionProps> = ({
  settings,
  setSettings,
  pathSets,
  tintPickerColor
}) => (
  <section className="space-y-3">
    <div className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">Crust Materials</div>
    <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Detail A</div>
    <input
      list="sandbox-detail-paths"
      value={settings.materials.detailA.path}
      onChange={(e) => setSettings(prev => prev ? { ...prev, materials: { ...prev.materials, detailA: { ...prev.materials.detailA, path: e.target.value } } } : prev)}
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs"
    />
    <datalist id="sandbox-detail-paths">
      {pathSets.detail.map(path => (
        <option key={path} value={path} />
      ))}
    </datalist>
    <div className="grid grid-cols-2 gap-3">
      <select
        value={settings.materials.detailA.mode}
        onChange={(e) => setSettings(prev => prev ? { ...prev, materials: { ...prev.materials, detailA: { ...prev.materials.detailA, mode: e.target.value as typeof settings.materials.detailA.mode } } } : prev)}
        className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
      >
        {MODE_OPTIONS.map(mode => (
          <option key={`detail-a-${mode}`} value={mode}>{mode}</option>
        ))}
      </select>
      <input
        type="number"
        min={0}
        max={1}
        step={0.01}
        value={settings.materials.detailA.opacity}
        onChange={(e) => setSettings(prev => prev ? {
          ...prev,
          materials: {
            ...prev.materials,
            detailA: { ...prev.materials.detailA, opacity: clamp(toNumber(e.target.value, prev.materials.detailA.opacity), 0, 1) }
          }
        } : prev)}
        className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
      />
    </div>
    <input
      type="number"
      min={DETAIL_SCALE_MIN}
      max={DETAIL_SCALE_MAX}
      step={16}
      value={settings.materials.detailA.scalePx}
      onChange={(e) => setSettings(prev => prev ? {
        ...prev,
        materials: {
          ...prev.materials,
          detailA: {
            ...prev.materials.detailA,
            scalePx: clamp(toNumber(e.target.value, prev.materials.detailA.scalePx), DETAIL_SCALE_MIN, DETAIL_SCALE_MAX)
          }
        }
      } : prev)}
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
    />

    <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 pt-1">Detail B</div>
    <input
      list="sandbox-detail-paths"
      value={settings.materials.detailB.path}
      onChange={(e) => setSettings(prev => prev ? { ...prev, materials: { ...prev.materials, detailB: { ...prev.materials.detailB, path: e.target.value } } } : prev)}
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs"
    />
    <div className="grid grid-cols-2 gap-3">
      <select
        value={settings.materials.detailB.mode}
        onChange={(e) => setSettings(prev => prev ? { ...prev, materials: { ...prev.materials, detailB: { ...prev.materials.detailB, mode: e.target.value as typeof settings.materials.detailB.mode } } } : prev)}
        className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
      >
        {MODE_OPTIONS.map(mode => (
          <option key={`detail-b-${mode}`} value={mode}>{mode}</option>
        ))}
      </select>
      <input
        type="number"
        min={0}
        max={1}
        step={0.01}
        value={settings.materials.detailB.opacity}
        onChange={(e) => setSettings(prev => prev ? {
          ...prev,
          materials: {
            ...prev.materials,
            detailB: { ...prev.materials.detailB, opacity: clamp(toNumber(e.target.value, prev.materials.detailB.opacity), 0, 1) }
          }
        } : prev)}
        className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
      />
    </div>
    <input
      type="number"
      min={DETAIL_SCALE_MIN}
      max={DETAIL_SCALE_MAX}
      step={16}
      value={settings.materials.detailB.scalePx}
      onChange={(e) => setSettings(prev => prev ? {
        ...prev,
        materials: {
          ...prev.materials,
          detailB: {
            ...prev.materials.detailB,
            scalePx: clamp(toNumber(e.target.value, prev.materials.detailB.scalePx), DETAIL_SCALE_MIN, DETAIL_SCALE_MAX)
          }
        }
      } : prev)}
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
    />

    <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 pt-1">Tint</div>
    <div className="grid grid-cols-[72px_1fr] gap-3">
      <input
        type="color"
        value={tintPickerColor}
        onChange={(e) => setSettings(prev => prev ? {
          ...prev,
          materials: { ...prev.materials, tintColor: e.target.value }
        } : prev)}
        className="h-10 w-full rounded-lg border border-white/15 bg-white/5 p-1 cursor-pointer"
        aria-label="Tint Color Picker"
      />
      <input
        value={settings.materials.tintColor}
        onChange={(e) => setSettings(prev => prev ? { ...prev, materials: { ...prev.materials, tintColor: e.target.value } } : prev)}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        placeholder="#8b6f4a"
      />
    </div>
    <div className="grid grid-cols-8 gap-2">
      {TINT_SWATCHES.map((swatch) => (
        <button
          key={`tint-swatch-${swatch}`}
          type="button"
          onClick={() => setSettings(prev => prev ? {
            ...prev,
            materials: { ...prev.materials, tintColor: swatch }
          } : prev)}
          className={`h-6 rounded border ${normalizeHexColor(settings.materials.tintColor) === normalizeHexColor(swatch) ? 'border-white' : 'border-white/20'}`}
          style={{ backgroundColor: swatch }}
          title={swatch}
        />
      ))}
    </div>
    <div className="space-y-2">
      <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">
        Tint Opacity {settings.materials.tintOpacity.toFixed(2)}
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={settings.materials.tintOpacity}
        onChange={(e) => setSettings(prev => prev ? {
          ...prev,
          materials: {
            ...prev.materials,
            tintOpacity: clamp(toNumber(e.target.value, prev.materials.tintOpacity), 0, 1)
          }
        } : prev)}
        className="w-full"
      />
    </div>
    <select
      value={settings.materials.tintBlend}
      onChange={(e) => setSettings(prev => prev ? { ...prev, materials: { ...prev.materials, tintBlend: readBlendMode(e.target.value) } } : prev)}
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
    >
      {BLEND_OPTIONS.map(mode => (
        <option key={`blend-${mode}`} value={mode}>{mode}</option>
      ))}
    </select>
  </section>
);
