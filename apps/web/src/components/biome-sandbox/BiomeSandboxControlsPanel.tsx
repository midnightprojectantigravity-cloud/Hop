import React from 'react';
import type { FloorTheme } from '@hop/engine';
import type {
  BiomeSandboxPathSets,
  BiomeSandboxSettings,
  BlendMode,
  LayerMode,
  MountainBlendMode,
  WallMode
} from '../BiomeSandbox';

interface BiomeSandboxControlsPanelProps {
  settings: BiomeSandboxSettings;
  setSettings: React.Dispatch<React.SetStateAction<BiomeSandboxSettings | null>>;
  pathSets: BiomeSandboxPathSets;
  copyStatus: string;
  onBack: () => void;
  onReset: () => void;
  onCopySettings: () => void | Promise<void>;
  tintPickerColor: string;
  mountainTintPickerColor: string;
}

const FLOOR_THEMES: FloorTheme[] = ['catacombs', 'inferno', 'throne', 'frozen', 'void'];
const MODE_OPTIONS: LayerMode[] = ['off', 'repeat', 'cover'];
const UNDERCURRENT_SCALE_MIN = 64;
const UNDERCURRENT_SCALE_MAX = 192;
const DETAIL_SCALE_MIN = 64;
const DETAIL_SCALE_MAX = 512;
const BLEND_OPTIONS: BlendMode[] = ['normal', 'multiply', 'overlay', 'soft-light', 'screen', 'color-dodge'];
const MOUNTAIN_BLEND_OPTIONS: MountainBlendMode[] = ['off', 'multiply', 'overlay', 'soft-light', 'screen', 'color-dodge', 'normal'];
const TINT_SWATCHES: string[] = ['#8b6f4a', '#8f4a2e', '#5b6d41', '#536e8e', '#5f5977', '#b79a73', '#d15a3a', '#3e4f3a'];
const WALL_MODE_OPTIONS: WallMode[] = ['native', 'additive', 'custom'];

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

const toNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeHexColor = (value: string, fallback = '#8b6f4a'): string => {
  const raw = String(value || '').trim();
  const fullHex = /^#([0-9a-f]{6})$/i;
  if (fullHex.test(raw)) return raw.toLowerCase();
  const shortHex = /^#([0-9a-f]{3})$/i;
  if (shortHex.test(raw)) {
    const [r, g, b] = raw.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
};

const readBlendMode = (blend: unknown): BlendMode => {
  if (
    blend === 'normal'
    || blend === 'multiply'
    || blend === 'overlay'
    || blend === 'soft-light'
    || blend === 'screen'
    || blend === 'color-dodge'
  ) {
    return blend;
  }
  return 'multiply';
};

const readMountainBlendMode = (blend: unknown): MountainBlendMode => {
  if (blend === 'off') return 'off';
  return readBlendMode(blend);
};

export const BiomeSandboxControlsPanel: React.FC<BiomeSandboxControlsPanelProps> = ({
  settings,
  setSettings,
  pathSets,
  copyStatus,
  onBack,
  onReset,
  onCopySettings,
  tintPickerColor,
  mountainTintPickerColor
}) => {
  return (
      <aside className="w-[420px] border-r border-white/10 bg-[#02040a] overflow-y-auto">
        <div className="sticky top-0 z-20 border-b border-white/10 bg-[#02040a]/95 backdrop-blur p-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-[11px] font-black uppercase tracking-[0.18em]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onReset}
              className="px-3 py-2 rounded-lg border border-amber-300/40 bg-amber-500/10 hover:bg-amber-500/20 text-[11px] font-black uppercase tracking-[0.18em]"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onCopySettings}
              className="px-3 py-2 rounded-lg border border-cyan-300/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-[11px] font-black uppercase tracking-[0.18em]"
            >
              Copy JSON
            </button>
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-[0.22em] text-white/50">
            Hop / Biomes {copyStatus ? `* ${copyStatus}` : ''}
          </div>
        </div>

        <div className="p-4 space-y-6">
          <section className="space-y-3">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-white/75">Preview</div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Theme</label>
            <select
              value={settings.theme}
              onChange={(e) => setSettings(prev => prev ? { ...prev, theme: e.target.value as FloorTheme } : prev)}
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
              onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, mode: e.target.value as LayerMode } } : prev)}
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
              onChange={(e) => setSettings(prev => prev ? { ...prev, crust: { ...prev.crust, mode: e.target.value as LayerMode } } : prev)}
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
                walls: { ...prev.walls, mode: e.target.value as WallMode }
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
                onChange={(e) => setSettings(prev => prev ? { ...prev, materials: { ...prev.materials, detailA: { ...prev.materials.detailA, mode: e.target.value as LayerMode } } } : prev)}
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
                onChange={(e) => setSettings(prev => prev ? { ...prev, materials: { ...prev.materials, detailB: { ...prev.materials.detailB, mode: e.target.value as LayerMode } } } : prev)}
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
        </div>
      </aside>
  );
};
