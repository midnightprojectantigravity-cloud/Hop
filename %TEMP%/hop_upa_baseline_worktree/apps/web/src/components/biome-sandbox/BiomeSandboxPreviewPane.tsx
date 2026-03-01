import React from 'react';
import type { GameState } from '@hop/engine';
import { GameBoard } from '../GameBoard';
import type { VisualAssetManifest } from '../../visual/asset-manifest';

interface BiomeSandboxPreviewPaneProps {
  theme: string;
  previewState: GameState;
  previewManifest: VisualAssetManifest;
}

export const BiomeSandboxPreviewPane: React.FC<BiomeSandboxPreviewPaneProps> = ({
  theme,
  previewState,
  previewManifest
}) => {
  return (
    <main className="flex-1 relative bg-[#050914] overflow-hidden">
      <div className="absolute top-4 right-5 z-20 px-3 py-2 rounded-lg border border-white/15 bg-black/35 text-[10px] font-black uppercase tracking-[0.2em]">
        Theme: {theme}
      </div>
      <div className="w-full h-full p-6">
        <div className="w-full h-full rounded-[28px] border border-white/10 bg-[#030712]/70 overflow-hidden">
          <GameBoard
            gameState={previewState}
            onMove={() => {}}
            selectedSkillId={null}
            showMovementRange={false}
            assetManifest={previewManifest}
          />
        </div>
      </div>
    </main>
  );
};
