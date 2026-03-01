import React from 'react';
import type { BiomeSandboxPathSets, BiomeSandboxSettings } from './types';
import type { BiomeSandboxSettingsSetter } from './controls/shared';
import { BiomeSandboxPreviewSection } from './controls/preview-section';
import { BiomeSandboxUndercurrentSection } from './controls/undercurrent-section';
import { BiomeSandboxCrustSection } from './controls/crust-section';
import { BiomeSandboxWallsSection } from './controls/walls-section';
import { BiomeSandboxMaterialsSection } from './controls/materials-section';
import { BiomeSandboxClutterSection } from './controls/clutter-section';

interface BiomeSandboxControlsPanelProps {
  settings: BiomeSandboxSettings;
  setSettings: BiomeSandboxSettingsSetter;
  pathSets: BiomeSandboxPathSets;
  copyStatus: string;
  onBack: () => void;
  onReset: () => void;
  onCopySettings: () => void | Promise<void>;
  tintPickerColor: string;
  mountainTintPickerColor: string;
}

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
        <BiomeSandboxPreviewSection
          settings={settings}
          setSettings={setSettings}
        />

        <BiomeSandboxUndercurrentSection
          settings={settings}
          setSettings={setSettings}
          pathSets={pathSets}
        />

        <BiomeSandboxCrustSection
          settings={settings}
          setSettings={setSettings}
          pathSets={pathSets}
        />

        <BiomeSandboxWallsSection
          settings={settings}
          setSettings={setSettings}
          pathSets={pathSets}
          mountainTintPickerColor={mountainTintPickerColor}
        />

        <BiomeSandboxMaterialsSection
          settings={settings}
          setSettings={setSettings}
          pathSets={pathSets}
          tintPickerColor={tintPickerColor}
        />

        <BiomeSandboxClutterSection
          settings={settings}
          setSettings={setSettings}
        />
      </div>
    </aside>
  );
};
