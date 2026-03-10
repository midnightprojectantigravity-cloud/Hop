import type { CameraZoomPreset } from '../../visual/camera';

interface CameraZoomControlsProps {
  activePreset: CameraZoomPreset;
  tacticalPreset: CameraZoomPreset;
  actionPreset: CameraZoomPreset;
  onSelectPreset: (preset: CameraZoomPreset) => void;
}

export const CameraZoomControls: React.FC<CameraZoomControlsProps> = ({
  activePreset,
  tacticalPreset,
  actionPreset,
  onSelectPreset
}) => (
  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-30 flex items-center gap-1.5 pointer-events-auto">
    <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-black/35 backdrop-blur-sm p-1.5">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-white/80" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
          <path d="M16 16L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onSelectPreset(tacticalPreset)}
        className={`h-7 w-7 rounded-md text-sm font-black transition-colors ${activePreset === tacticalPreset
          ? 'bg-white text-black'
          : 'bg-white/5 text-white/80 hover:bg-white/10'
          }`}
        aria-label={`Zoom out to tactical view (${tacticalPreset} tiles wide)`}
      >
        -
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onSelectPreset(actionPreset)}
        className={`h-7 w-7 rounded-md text-sm font-black transition-colors ${activePreset === actionPreset
          ? 'bg-white text-black'
          : 'bg-white/5 text-white/80 hover:bg-white/10'
          }`}
        aria-label={`Zoom in to action view (${actionPreset} tiles wide)`}
      >
        +
      </button>
    </div>
  </div>
);
