import { pointToKey, type GameState } from '@hop/engine';

export const WorldgenDebugPanel = ({ gameState }: { gameState: GameState }) => {
  const debug = gameState.worldgenDebug;
  const floorSummary = gameState.generationState?.currentFloorSummary;
  if (!debug) return null;

  return (
    <div className="absolute top-4 left-4 z-40 w-[min(24rem,80vw)] rounded-2xl border border-[var(--border-subtle)] bg-black/80 p-3 text-[10px] text-white shadow-xl backdrop-blur-md">
      <div className="font-black uppercase tracking-[0.2em] text-amber-200">Worldgen Debug</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>Floor {gameState.floor}</div>
        <div>{floorSummary?.floorFamilyId || 'procedural'}</div>
        <div>{debug.verificationReport.code}</div>
        <div>{floorSummary?.directorEntropyKey || 'no-entropy'}</div>
      </div>
      <div className="mt-2">
        <div className="font-black uppercase tracking-[0.16em] text-amber-100/80">Queue</div>
        <div>{(gameState.generationState?.recentOutcomeQueue || []).map(entry => entry.snapshotId).join(', ') || 'empty'}</div>
      </div>
      <div className="mt-2">
        <div className="font-black uppercase tracking-[0.16em] text-amber-100/80">Scene</div>
        <div>{debug.sceneSignature.sceneId} / {debug.sceneSignature.motif} / {debug.sceneSignature.encounterPosture}</div>
      </div>
      <div className="mt-2">
        <div className="font-black uppercase tracking-[0.16em] text-amber-100/80">Modules</div>
        <div>{debug.modulePlan.placements.map(placement => `${placement.slotId}:${placement.moduleId}@${pointToKey(placement.anchor)}`).join(' | ') || 'none'}</div>
      </div>
      <div className="mt-2">
        <div className="font-black uppercase tracking-[0.16em] text-amber-100/80">Path</div>
        <div>Main: {debug.pathNetwork.landmarks.filter(landmark => landmark.onPath).map(landmark => landmark.id).join(', ') || 'none'}</div>
        <div>Hidden: {debug.pathNetwork.landmarks.filter(landmark => !landmark.onPath).map(landmark => landmark.id).join(', ') || 'none'}</div>
        <div>Tactical / Visual: {debug.pathNetwork.tacticalTileKeys.length} / {debug.pathNetwork.visualTileKeys.length}</div>
      </div>
      <div className="mt-2">
        <div className="font-black uppercase tracking-[0.16em] text-amber-100/80">Claims</div>
        <div>{debug.claims.map(claim => `${claim.hardness}:${claim.kind}:${pointToKey(claim.from)}->${pointToKey(claim.to)}`).join(' | ') || 'none'}</div>
      </div>
      <div className="mt-2">
        <div className="font-black uppercase tracking-[0.16em] text-amber-100/80">Parity</div>
        <div>{Object.entries(debug.spatialBudget.closedPathOffsets).map(([id, offset]) => `${id}:${offset.pathParity}/${offset.wiggleHexes}`).join(' | ') || 'none'}</div>
      </div>
      <div className="mt-2">
        <div className="font-black uppercase tracking-[0.16em] text-amber-100/80">Path Diagnostics</div>
        <div>{debug.pathDiagnostics.join(' | ') || 'none'}</div>
      </div>
      {debug.verificationReport.conflict && (
        <div className="mt-2">
          <div className="font-black uppercase tracking-[0.16em] text-amber-100/80">Conflict</div>
          <div>{debug.verificationReport.conflict.authoredId} / {debug.verificationReport.conflict.constraintType}</div>
          <div>{debug.verificationReport.conflict.spatialContext.hexes.map(pointToKey).join(', ') || 'none'}</div>
        </div>
      )}
    </div>
  );
};
