import React from 'react';
import { ArchetypeSelector } from './ArchetypeSelector';
import ReplayManager from './ReplayManager';
import { TutorialManager } from './TutorialManager';
import type { GameState } from '@hop/engine/types';
import type { Loadout } from '@hop/engine/loadout';
import type { ReplayRecord } from './ReplayManager';

interface HubProps {
  gameState: GameState;
  onSelectLoadout: (loadout: Loadout) => void;
  onStartRun: () => void;
  onLoadScenario: (state: GameState, instructions: string) => void;
  onStartReplay: (r: ReplayRecord) => void;
}

export const Hub: React.FC<HubProps> = ({ gameState, onSelectLoadout, onStartRun, onLoadScenario, onStartReplay }) => {
  return (
    <div className="w-full h-full p-8 flex items-start justify-center gap-8">
      <div className="flex-1 flex flex-col items-center">
        <ArchetypeSelector onSelect={onSelectLoadout} />
      </div>

      <aside className="w-80 border-l border-white/5 bg-[#030712] flex flex-col z-20 overflow-y-auto p-6">
        <div className="mb-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-4">Selected Loadout</h3>
          <div className="text-sm text-white/60">{gameState.selectedLoadoutId || 'None'}</div>
          {gameState.selectedLoadoutId && (
            <button
              onClick={onStartRun}
              className="mt-4 w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold uppercase text-sm"
            >
              Start Run
            </button>
          )}
        </div>

        <div className="pt-4 border-t border-white/5">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-4">Historical Replay</h3>
          <ReplayManager gameState={gameState} onStartReplay={onStartReplay} onStopReplay={() => {}} onStepReplay={() => {}} />
        </div>

        <div className="pt-6 border-t border-white/5">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-4">Training Simulations</h3>
          <TutorialManager onLoadScenario={onLoadScenario} />
        </div>
      </aside>
    </div>
  );
};
