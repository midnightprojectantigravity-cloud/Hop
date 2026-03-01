import React from 'react';
import { MOUNTAIN_BLEND_OPTIONS, WALL_MODE_OPTIONS } from './shared';
import type { BiomeSandboxPathSectionProps } from './shared';
import {
  clamp,
  readMountainBlendMode,
  toNumber
} from '../state/settings-utils';

interface BiomeSandboxWallsSectionProps extends BiomeSandboxPathSectionProps {
  mountainTintPickerColor: string;
}

export const BiomeSandboxWallsSection: React.FC<BiomeSandboxWallsSectionProps> = ({
  settings,
  setSettings,
  pathSets,
  mountainTintPickerColor
}) => (
  <section className="space-y-3">
    <div className="text-xs font-black uppercase tracking-[0.2em] text-rose-200">Walls / Mountains</div>
    <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Mountain Asset</label>
    <input
      list="sandbox-mountain-paths"
      value={settings.walls.mountainPath}
      onChange={(e) => setSettings(prev => prev ? {
        ...prev,
        walls: { ...prev.walls, mountainPath: e.target.value }
      } : prev)}
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs"
      placeholder="/assets/biomes/biome.volcano.mountain.01.webp"
    />
    <datalist id="sandbox-mountain-paths">
      {pathSets.mountain.map(path => (
        <option key={path} value={path} />
      ))}
    </datalist>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Scale</label>
        <input
          type="number"
          min={0.2}
          max={3}
          step={0.01}
          value={settings.walls.mountainScale}
          onChange={(e) => setSettings(prev => prev ? {
            ...prev,
            walls: { ...prev.walls, mountainScale: clamp(toNumber(e.target.value, prev.walls.mountainScale), 0.2, 3) }
          } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Anchor X</label>
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={settings.walls.mountainAnchorX}
          onChange={(e) => setSettings(prev => prev ? {
            ...prev,
            walls: { ...prev.walls, mountainAnchorX: clamp(toNumber(e.target.value, prev.walls.mountainAnchorX), 0, 1) }
          } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Offset X</label>
        <input
          type="number"
          step={2}
          value={settings.walls.mountainOffsetX}
          onChange={(e) => setSettings(prev => prev ? {
            ...prev,
            walls: { ...prev.walls, mountainOffsetX: toNumber(e.target.value, prev.walls.mountainOffsetX) }
          } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Offset Y</label>
        <input
          type="number"
          step={2}
          value={settings.walls.mountainOffsetY}
          onChange={(e) => setSettings(prev => prev ? {
            ...prev,
            walls: { ...prev.walls, mountainOffsetY: toNumber(e.target.value, prev.walls.mountainOffsetY) }
          } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
    </div>
    <div>
      <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Anchor Y</label>
      <input
        type="number"
        min={0}
        max={1}
        step={0.01}
        value={settings.walls.mountainAnchorY}
        onChange={(e) => setSettings(prev => prev ? {
          ...prev,
          walls: { ...prev.walls, mountainAnchorY: clamp(toNumber(e.target.value, prev.walls.mountainAnchorY), 0, 1) }
        } : prev)}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
      />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Crust Blend</label>
        <select
          value={settings.walls.mountainCrustBlendMode}
          onChange={(e) => setSettings(prev => prev ? {
            ...prev,
            walls: { ...prev.walls, mountainCrustBlendMode: readMountainBlendMode(e.target.value) }
          } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        >
          {MOUNTAIN_BLEND_OPTIONS.map(mode => (
            <option key={`mountain-blend-${mode}`} value={mode}>{mode}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">
          Blend Opacity {settings.walls.mountainCrustBlendOpacity.toFixed(2)}
        </label>
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={settings.walls.mountainCrustBlendOpacity}
          onChange={(e) => setSettings(prev => prev ? {
            ...prev,
            walls: { ...prev.walls, mountainCrustBlendOpacity: clamp(toNumber(e.target.value, prev.walls.mountainCrustBlendOpacity), 0, 1) }
          } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
    </div>
    <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Mountain Tint</div>
    <div className="grid grid-cols-[72px_1fr] gap-3">
      <input
        type="color"
        value={mountainTintPickerColor}
        onChange={(e) => setSettings(prev => prev ? {
          ...prev,
          walls: { ...prev.walls, mountainTintColor: e.target.value }
        } : prev)}
        className="h-10 w-full rounded-lg border border-white/15 bg-white/5 p-1 cursor-pointer"
        aria-label="Mountain Tint Color Picker"
      />
      <input
        value={settings.walls.mountainTintColor}
        onChange={(e) => setSettings(prev => prev ? {
          ...prev,
          walls: { ...prev.walls, mountainTintColor: e.target.value }
        } : prev)}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        placeholder="#8b6f4a"
      />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Tint Blend</label>
        <select
          value={settings.walls.mountainTintBlendMode}
          onChange={(e) => setSettings(prev => prev ? {
            ...prev,
            walls: { ...prev.walls, mountainTintBlendMode: readMountainBlendMode(e.target.value) }
          } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        >
          {MOUNTAIN_BLEND_OPTIONS.map(mode => (
            <option key={`mountain-tint-blend-${mode}`} value={mode}>{mode}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">
          Tint Opacity {settings.walls.mountainTintOpacity.toFixed(2)}
        </label>
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={settings.walls.mountainTintOpacity}
          onChange={(e) => setSettings(prev => prev ? {
            ...prev,
            walls: { ...prev.walls, mountainTintOpacity: clamp(toNumber(e.target.value, prev.walls.mountainTintOpacity), 0, 1) }
          } : prev)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
    </div>
    <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Wall Layout Mode</label>
    <select
      value={settings.walls.mode}
      onChange={(e) => setSettings(prev => prev ? {
        ...prev,
        walls: { ...prev.walls, mode: e.target.value as typeof settings.walls.mode }
      } : prev)}
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
    >
      {WALL_MODE_OPTIONS.map(mode => (
        <option key={`wall-mode-${mode}`} value={mode}>{mode}</option>
      ))}
    </select>
    <div className="space-y-2">
      <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">
        Interior Density {settings.walls.interiorDensity.toFixed(2)}
      </label>
      <input
        type="range"
        min={0}
        max={0.45}
        step={0.01}
        value={settings.walls.interiorDensity}
        onChange={(e) => setSettings(prev => prev ? {
          ...prev,
          walls: { ...prev.walls, interiorDensity: clamp(toNumber(e.target.value, prev.walls.interiorDensity), 0, 0.45) }
        } : prev)}
        className="w-full"
      />
    </div>
    <div className="space-y-2">
      <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">
        Cluster Bias {settings.walls.clusterBias.toFixed(2)}
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={settings.walls.clusterBias}
        onChange={(e) => setSettings(prev => prev ? {
          ...prev,
          walls: { ...prev.walls, clusterBias: clamp(toNumber(e.target.value, prev.walls.clusterBias), 0, 1) }
        } : prev)}
        className="w-full"
      />
    </div>
    <label className="flex items-center gap-2 text-xs text-white/80">
      <input
        type="checkbox"
        checked={settings.walls.keepPerimeter}
        onChange={(e) => setSettings(prev => prev ? {
          ...prev,
          walls: { ...prev.walls, keepPerimeter: e.target.checked }
        } : prev)}
      />
      Keep perimeter walls (custom mode)
    </label>
  </section>
);
