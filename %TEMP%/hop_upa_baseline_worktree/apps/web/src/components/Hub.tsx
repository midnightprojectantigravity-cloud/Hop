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
      <header className="border-b border-white/5 px-4 sm:px-6 lg:px-12 py-3 sm:py-4 bg-[#030712]/50 backdrop-blur-xl z-30">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-500 rounded-lg flex items-center justify-center font-black text-lg sm:text-xl shadow-[0_0_20px_rgba(99,102,241,0.5)]">H</div>
            <div>
              <h1 className="text-base sm:text-lg font-black uppercase tracking-tighter leading-none italic">Hop <span className="text-indigo-500">Engine</span></h1>
              <div className="text-[9px] sm:text-[10px] font-bold text-white/30 tracking-[0.22em] sm:tracking-[0.3em] uppercase mt-1">Strategic Hub v5.0</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 lg:gap-8">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 sm:bg-transparent sm:border-0 sm:p-0">
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Current Loadout</div>
              <div className="text-sm font-bold text-indigo-400 truncate">{gameState.selectedLoadoutId || 'No Archetype Selected'}</div>
            </div>
            {gameState.selectedLoadoutId && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
                <button
                  onClick={() => onStartRun('normal')}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase text-xs sm:text-sm tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_30px_rgba(79,70,229,0.3)] flex flex-col items-center justify-center leading-tight"
                >
                  <span>Start Run</span>
                  <span className="hidden sm:block text-[9px] opacity-50 tracking-[0.2em]">10 Floors | Boss Defeat</span>
                </button>
                <button
                  onClick={() => onStartRun('daily')}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-xs sm:text-sm tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_30px_rgba(16,185,129,0.3)] flex flex-col items-center justify-center leading-tight"
                >
                  <span>Daily</span>
                  <span className="hidden sm:block text-[9px] opacity-50 tracking-[0.2em]">Seeded Challenge</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        {/* Left Area: Archetype Selection */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 sm:mb-10 lg:mb-12">
              <button
                onClick={onOpenArcade}
                className="mb-4 sm:mb-5 w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 font-black uppercase tracking-widest text-xs sm:text-sm transition-all"
              >
                Arcade Mode
              </button>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-tighter mb-2 italic">Select Your <span className="text-indigo-500">Archetype</span></h2>
              <p className="text-sm sm:text-base text-white/40 max-w-xl">Choose your tactical specialty. Each archetype provides unique skills and modifies your core interaction with the engine.</p>
            </div>
            <ArchetypeSelector onSelect={onSelectLoadout} />
          </div>
        </main>

        {/* Mobile Secondary Panels */}
        <section className="lg:hidden border-t border-white/5 bg-[#030712]/50 backdrop-blur-sm p-4 sm:p-6 space-y-4">
          <details className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <summary className="cursor-pointer list-none flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Historical Replay</span>
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Optional</span>
            </summary>
            <div className="mt-3">
              <ReplayManager gameState={gameState} onStartReplay={onStartReplay} />
            </div>
          </details>

          <details className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <summary className="cursor-pointer list-none flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Training Simulations</span>
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Optional</span>
            </summary>
            <div className="mt-3">
              <TutorialManager onLoadScenario={onLoadScenario} />
            </div>
          </details>
        </section>

        {/* Right Sidebar: Intel & Simulations (desktop) */}
        <aside className="hidden lg:flex w-[450px] border-l border-white/5 bg-[#030712]/80 backdrop-blur-md flex-col z-20">
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
