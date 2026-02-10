import React from 'react';
import { ArchetypeSelector } from './ArchetypeSelector';
import ReplayManager from './ReplayManager';
import { TutorialManager } from './TutorialManager';
import type { GameState, Loadout } from '@hop/engine';
import type { ReplayRecord } from './ReplayManager';

interface HubProps {
  gameState: GameState;
  onSelectLoadout: (loadout: Loadout) => void;
  onStartRun: (mode: 'normal' | 'daily') => void;
  onOpenArcade: () => void;
  onLoadScenario: (state: GameState, instructions: string) => void;
  onStartReplay: (r: ReplayRecord) => void;
}

export const Hub: React.FC<HubProps> = ({ gameState, onSelectLoadout, onStartRun, onOpenArcade, onLoadScenario, onStartReplay }) => {
  return (
    <div className="w-full h-full flex flex-col bg-[#020617]">
      {/* Header */}
      <header className="h-20 border-b border-white/5 flex items-center justify-between px-12 bg-[#030712]/50 backdrop-blur-xl z-30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center font-black text-xl shadow-[0_0_20px_rgba(99,102,241,0.5)]">H</div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tighter leading-none italic">Hop <span className="text-indigo-500">Engine</span></h1>
            <div className="text-[10px] font-bold text-white/30 tracking-[0.3em] uppercase mt-1">Strategic Hub v5.0</div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Current Loadout</div>
            <div className="text-sm font-bold text-indigo-400">{gameState.selectedLoadoutId || 'No Archetype Selected'}</div>
          </div>
          {gameState.selectedLoadoutId && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onStartRun('normal')}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase text-sm tracking-widest transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(79,70,229,0.3)] flex flex-col items-center justify-center leading-tight"
              >
                <span>Start Run</span>
                <span className="text-[9px] opacity-50 tracking-[0.2em]">10 Floors | Boss Defeat</span>
              </button>
              <button
                onClick={() => onStartRun('daily')}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-sm tracking-widest transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(16,185,129,0.3)] flex flex-col items-center justify-center leading-tight"
              >
                <span>Daily</span>
                <span className="text-[9px] opacity-50 tracking-[0.2em]">Seeded Challenge</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Area: Archetype Selection */}
        <main className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto">
            <div className="mb-12">
              <button
                onClick={onOpenArcade}
                className="mb-5 w-full md:w-auto px-6 py-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 font-black uppercase tracking-widest text-sm transition-all"
              >
                Arcade Mode
              </button>
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-2 italic">Select Your <span className="text-indigo-500">Archetype</span></h2>
              <p className="text-white/40 max-w-xl">Choose your tactical specialty. Each archetype provides unique skills and modifies your core interaction with the engine.</p>
            </div>
            <ArchetypeSelector onSelect={onSelectLoadout} />
          </div>
        </main>

        {/* Right Sidebar: Intel & Simulations */}
        <aside className="w-[450px] border-l border-white/5 bg-[#030712]/80 backdrop-blur-md flex flex-col z-20">
          <div className="p-8 flex flex-col gap-12 h-full overflow-y-auto custom-scrollbar">

            <section>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30">Historical Replay</h3>
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 overflow-hidden">
                <ReplayManager gameState={gameState} onStartReplay={onStartReplay} />
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30">Training Simulations</h3>
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 overflow-hidden">
                <TutorialManager onLoadScenario={onLoadScenario} />
              </div>
            </section>

            <div className="mt-auto pt-8 border-t border-white/5 opacity-20 hover:opacity-100 transition-opacity">
              <div className="text-[10px] font-bold uppercase tracking-[0.4em] mb-2 text-center text-white/50">Engine Status: Online</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
