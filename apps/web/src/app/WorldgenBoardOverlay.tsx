import { pointToKey, type GameState } from '@hop/engine';

export const WorldgenBoardOverlay = ({ gameState }: { gameState: GameState }) => {
  const debug = gameState.worldgenDebug;
  if (!debug) return null;

  const conflictHexes = debug.verificationReport.conflict?.spatialContext.hexes.map(pointToKey) || [];
  const footprintSummary = debug.modulePlan.placements
    .map((placement) => `${placement.moduleId}: ${placement.footprintKeys.slice(0, 4).join(', ')}${placement.footprintKeys.length > 4 ? '...' : ''}`);
  const claimSummary = debug.claims
    .map((claim) => `${claim.hardness} ${claim.kind}: ${pointToKey(claim.from)} -> ${pointToKey(claim.to)}`);
  const pinnedAnchors = Object.entries(debug.spatialPlan.anchorById)
    .map(([id, point]) => `${id}@${pointToKey(point)}`);
  const mainLandmarks = debug.pathNetwork.landmarks
    .filter((landmark) => landmark.onPath)
    .map((landmark) => `${landmark.id}@${pointToKey(landmark.point)}`);
  const hiddenLandmarks = debug.pathNetwork.landmarks
    .filter((landmark) => !landmark.onPath)
    .map((landmark) => `${landmark.id}@${pointToKey(landmark.point)}`);
  const segmentSummary = debug.pathNetwork.segments
    .map((segment) => `${segment.kind}:${segment.fromLandmarkId}->${segment.toLandmarkId}`);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-end justify-end p-4">
      <div className="w-[min(28rem,78vw)] rounded-2xl border border-white/15 bg-black/60 p-3 text-[10px] text-white shadow-xl backdrop-blur-sm">
        <div className="font-black uppercase tracking-[0.2em] text-amber-200">Board Overlay</div>
        <div className="mt-2">
          <div className="font-black uppercase tracking-[0.16em] text-amber-100/80">Anchors</div>
          <div>{pinnedAnchors.join(' | ') || 'none'}</div>
        </div>
        <div className="mt-2">
          <div className="font-black uppercase tracking-[0.16em] text-amber-100/80">Footprints</div>
          <div>{footprintSummary.join(' | ') || 'none'}</div>
        </div>
        <div className="mt-2">
          <div className="font-black uppercase tracking-[0.16em] text-amber-100/80">Claims</div>
          <div>{claimSummary.join(' | ') || 'none'}</div>
        </div>
        <div className="mt-2">
          <div className="font-black uppercase tracking-[0.16em] text-amber-100/80">Path</div>
          <div>Main: {mainLandmarks.join(' | ') || 'none'}</div>
          <div>Hidden: {hiddenLandmarks.join(' | ') || 'none'}</div>
          <div>Tiles: {debug.pathNetwork.tacticalTileKeys.length} tactical / {debug.pathNetwork.visualTileKeys.length} visual</div>
          <div>Segments: {segmentSummary.join(' | ') || 'none'}</div>
        </div>
        {conflictHexes.length > 0 && (
          <div className="mt-2">
            <div className="font-black uppercase tracking-[0.16em] text-red-200">Conflict Hexes</div>
            <div>{conflictHexes.join(', ')}</div>
          </div>
        )}
      </div>
    </div>
  );
};
