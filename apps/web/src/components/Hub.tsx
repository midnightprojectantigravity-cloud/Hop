import React from 'react';
import { ArchetypeSelector } from './ArchetypeSelector';
import ReplayManager from './ReplayManager';
import { TutorialManager } from './TutorialManager';
import type { GameState, Loadout } from '@hop/engine';
import type { ReplayRecord } from './ReplayManager';

interface HubProps {
  gameState: GameState;
  capabilityPassivesEnabled: boolean;
  onCapabilityPassivesEnabledChange: (enabled: boolean) => void;
  movementRuntimeEnabled: boolean;
  onMovementRuntimeEnabledChange: (enabled: boolean) => void;
  onSelectLoadout: (loadout: Loadout) => void;
  onStartRun: (mode: 'normal' | 'daily') => void;
  onOpenArcade: () => void;
  onLoadScenario: (state: GameState, instructions: string) => void;
  onStartReplay: (r: ReplayRecord) => void;
}

export const Hub: React.FC<HubProps> = ({
  gameState,
  capabilityPassivesEnabled,
  onCapabilityPassivesEnabledChange,
  movementRuntimeEnabled,
  onMovementRuntimeEnabledChange,
  onSelectLoadout,
  onStartRun,
  onOpenArcade,
  onLoadScenario,
  onStartReplay
}) => {
  return (
    <div className="w-full h-full flex flex-col bg-[var(--surface-app)] relative">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] px-4 sm:px-6 lg:px-12 py-3 sm:py-4 bg-[color:var(--surface-panel)] backdrop-blur-xl z-30">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[var(--accent-brass)] rounded-lg flex items-center justify-center font-black text-lg sm:text-xl text-[var(--text-inverse)] shadow-[0_0_20px_rgba(180,141,80,0.35)]">H</div>
            <div>
              <h1 className="text-base sm:text-lg font-black uppercase tracking-tighter leading-none font-[var(--font-heading)]">Hop <span className="text-[var(--accent-royal)]">Hub</span></h1>
              <div className="text-[9px] sm:text-[10px] font-bold text-[var(--text-muted)] tracking-[0.22em] sm:tracking-[0.3em] uppercase mt-1">Arcade Tactical Command</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 lg:gap-8">
            <div className="hidden sm:flex sm:items-center gap-3 sm:gap-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Capability Passives</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Run Override</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCapabilityPassivesEnabledChange(!capabilityPassivesEnabled)}
                    aria-pressed={capabilityPassivesEnabled}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors ${
                      capabilityPassivesEnabled
                        ? 'bg-[var(--accent-royal-soft)] border-[var(--accent-royal)] text-[var(--accent-royal)]'
                        : 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-panel-hover)]'
                    }`}
                  >
                    {capabilityPassivesEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Movement Runtime</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Capability Gate</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onMovementRuntimeEnabledChange(!movementRuntimeEnabled)}
                    aria-pressed={movementRuntimeEnabled}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors ${
                      movementRuntimeEnabled
                        ? 'bg-[var(--accent-brass-soft)] border-[var(--accent-brass)] text-[var(--text-primary)]'
                        : 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-panel-hover)]'
                    }`}
                  >
                    {movementRuntimeEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-2 sm:bg-transparent sm:border-0 sm:p-0">
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Current Loadout</div>
              <div className="text-sm font-bold text-[var(--accent-royal)] truncate">{gameState.selectedLoadoutId || 'Select Archetype'}</div>
            </div>
            {gameState.selectedLoadoutId && (
              <div className="hidden sm:grid sm:grid-cols-2 sm:gap-2 lg:flex lg:items-center lg:gap-3">
                <button
                  onClick={() => onStartRun('normal')}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-[var(--accent-brass)] hover:brightness-105 text-[var(--text-inverse)] rounded-xl font-black uppercase text-xs sm:text-sm tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_30px_rgba(180,141,80,0.25)] flex flex-col items-center justify-center leading-tight"
                >
                  <span>Start Run</span>
                  <span className="hidden sm:block text-[9px] opacity-70 tracking-[0.2em]">One More Run</span>
                </button>
                <button
                  onClick={() => onStartRun('daily')}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-[var(--accent-royal)] hover:brightness-105 text-[var(--text-inverse)] rounded-xl font-black uppercase text-xs sm:text-sm tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_30px_rgba(39,82,146,0.25)] flex flex-col items-center justify-center leading-tight"
                >
                  <span>Daily</span>
                  <span className="hidden sm:block text-[9px] opacity-70 tracking-[0.2em]">Seeded Challenge</span>
                </button>
              </div>
            )}
            <details className="sm:hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-2">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-black">Run Options</span>
                <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Advanced</span>
              </summary>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onCapabilityPassivesEnabledChange(!capabilityPassivesEnabled)}
                  aria-pressed={capabilityPassivesEnabled}
                  className={`w-full min-h-11 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors ${
                    capabilityPassivesEnabled
                      ? 'bg-[var(--accent-royal-soft)] border-[var(--accent-royal)] text-[var(--accent-royal)]'
                      : 'bg-[var(--surface-panel)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  Capability Passives: {capabilityPassivesEnabled ? 'On' : 'Off'}
                </button>
                <button
                  type="button"
                  onClick={() => onMovementRuntimeEnabledChange(!movementRuntimeEnabled)}
                  aria-pressed={movementRuntimeEnabled}
                  className={`w-full min-h-11 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors ${
                    movementRuntimeEnabled
                      ? 'bg-[var(--accent-brass-soft)] border-[var(--accent-brass)] text-[var(--text-primary)]'
                      : 'bg-[var(--surface-panel)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  Movement Runtime: {movementRuntimeEnabled ? 'On' : 'Off'}
                </button>
              </div>
            </details>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden pb-24 sm:pb-0">
        {/* Left Area: Archetype Selection */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 sm:mb-10 lg:mb-12">
              <button
                onClick={onOpenArcade}
                className="mb-4 sm:mb-5 w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl border border-[var(--accent-royal)] bg-[var(--accent-royal-soft)] hover:brightness-105 text-[var(--text-primary)] font-black uppercase tracking-widest text-xs sm:text-sm transition-all"
              >
                Arcade Mode
              </button>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-tighter mb-2 font-[var(--font-heading)]">Select Your <span className="text-[var(--accent-royal)]">Archetype</span></h2>
              <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-xl">Two taps: choose archetype, start run. Optional systems stay available without blocking run start.</p>
            </div>
            <ArchetypeSelector onSelect={onSelectLoadout} selectedLoadoutId={gameState.selectedLoadoutId} />
          </div>
        </main>

        {/* Mobile Secondary Panels */}
        <section className="lg:hidden border-t border-[var(--border-subtle)] bg-[color:var(--surface-panel)] backdrop-blur-sm p-4 sm:p-6 space-y-4">
          <details className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-3">
            <summary className="cursor-pointer list-none flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Historical Replay</span>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Optional</span>
            </summary>
            <div className="mt-3">
              <ReplayManager gameState={gameState} onStartReplay={onStartReplay} />
            </div>
          </details>

          <details className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-3">
            <summary className="cursor-pointer list-none flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Training Simulations</span>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Optional</span>
            </summary>
            <div className="mt-3">
              <TutorialManager onLoadScenario={onLoadScenario} />
            </div>
          </details>
        </section>

        {/* Right Sidebar: Intel & Simulations (desktop) */}
        <aside className="hidden lg:flex w-[450px] border-l border-[var(--border-subtle)] bg-[color:var(--surface-panel)] backdrop-blur-md flex-col z-20">
          <div className="p-8 flex flex-col gap-12 h-full overflow-y-auto custom-scrollbar">

            <section>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Historical Replay</h3>
                <div className="w-2 h-2 rounded-full bg-[var(--accent-danger)] animate-pulse" />
              </div>
              <div className="bg-[var(--surface-panel-muted)] border border-[var(--border-subtle)] rounded-2xl p-4 overflow-hidden">
                <ReplayManager gameState={gameState} onStartReplay={onStartReplay} />
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Training Simulations</h3>
                <div className="w-2 h-2 rounded-full bg-[var(--accent-royal)] animate-pulse" />
              </div>
              <div className="bg-[var(--surface-panel-muted)] border border-[var(--border-subtle)] rounded-2xl p-4 overflow-hidden">
                <TutorialManager onLoadScenario={onLoadScenario} />
              </div>
            </section>

            <div className="mt-auto pt-8 border-t border-[var(--border-subtle)] opacity-20 hover:opacity-100 transition-opacity">
              <div className="text-[10px] font-bold uppercase tracking-[0.4em] mb-2 text-center text-[var(--text-muted)]">Engine Status: Online</div>
            </div>
          </div>
        </aside>
      </div>

      {gameState.selectedLoadoutId && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border-subtle)] bg-[color:var(--surface-panel)] px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-black mb-2">
            Ready: {gameState.selectedLoadoutId}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onStartRun('normal')}
              className="min-h-12 px-4 py-2 rounded-xl bg-[var(--accent-brass)] text-[var(--text-inverse)] font-black uppercase tracking-widest text-xs"
            >
              Start Run
            </button>
            <button
              onClick={() => onStartRun('daily')}
              className="min-h-12 px-4 py-2 rounded-xl bg-[var(--accent-royal)] text-[var(--text-inverse)] font-black uppercase tracking-widest text-xs"
            >
              Daily
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

