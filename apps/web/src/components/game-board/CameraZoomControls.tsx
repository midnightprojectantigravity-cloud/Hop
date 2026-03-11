import type { CameraZoomMode } from '../../visual/camera';

interface CameraZoomControlsProps {
  activeMode: CameraZoomMode;
  isDetached: boolean;
  onSelectMode: (mode: CameraZoomMode) => void;
  onRecenter: () => void;
}

export const CameraZoomControls: React.FC<CameraZoomControlsProps> = ({
  activeMode,
  isDetached,
  onSelectMode,
  onRecenter
}) => (
  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-30 flex items-center gap-1.5 pointer-events-auto">
    <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-black/35 backdrop-blur-sm p-1.5">
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onRecenter}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
          isDetached
            ? 'bg-white text-black'
            : 'bg-white/5 text-white/80 hover:bg-white/10'
        }`}
        aria-label={isDetached ? 'Recenter camera' : 'Center camera on player'}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
          <path d="M16 16L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onSelectMode('tactical')}
        className={`h-7 w-7 rounded-md text-sm font-black transition-colors ${
          activeMode === 'tactical'
            ? 'bg-white text-black'
            : 'bg-white/5 text-white/80 hover:bg-white/10'
        }`}
        aria-label="Zoom out to tactical view"
      >
        -
      </button>
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onSelectMode('action')}
        className={`h-7 w-7 rounded-md text-sm font-black transition-colors ${
          activeMode === 'action'
            ? 'bg-white text-black'
            : 'bg-white/5 text-white/80 hover:bg-white/10'
        }`}
        aria-label="Zoom in to action view"
      >
        +
      </button>
    </div>
  </div>
);
