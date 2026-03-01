import type { CameraZoomPreset } from '../../visual/camera';

interface CameraZoomControlsProps {
  presets: readonly CameraZoomPreset[];
  activePreset: CameraZoomPreset;
  onSelectPreset: (preset: CameraZoomPreset) => void;
  onResetView: () => void;
}

export const CameraZoomControls: React.FC<CameraZoomControlsProps> = ({
  presets,
  activePreset,
  onSelectPreset,
  onResetView
}) => (
  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-30 flex items-center gap-1.5 pointer-events-auto">
    <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-black/35 backdrop-blur-sm p-1">
      {presets.map((preset) => {
        const active = activePreset === preset;
        return (
          <button
            key={`zoom-${preset}`}
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onSelectPreset(preset)}
            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${active
              ? 'bg-white text-black'
              : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            aria-label={`Set zoom to ${preset} tiles wide`}
          >
            {preset}
          </button>
        );
      })}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onResetView}
        className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white/5 text-white/70 hover:bg-white/10"
        aria-label="Reset camera to player"
      >
        Fit
      </button>
    </div>
  </div>
);
