import React from 'react';
import type { GameState } from '@hop/engine';
import { computeScore } from '@hop/engine';
import { InitiativeDisplay } from '../InitiativeQueue';

interface UiStatusPanelProps {
  gameState: GameState;
  onReset: () => void;
  onWait: () => void;
  onExitToHub: () => void;
  inputLocked?: boolean;
  compact?: boolean;
  hideInitiativeQueue?: boolean;
}

export const UiStatusPanel: React.FC<UiStatusPanelProps> = ({
  gameState,
  onReset,
  onWait,
  onExitToHub,
  inputLocked = false,
  compact = false,
  hideInitiativeQueue = false
}) => {
  const score = computeScore(gameState);

  return (
    <div className={`flex flex-col overflow-y-auto flex-1 min-h-0 ${compact ? 'gap-4 p-4' : 'gap-8 p-8'}`}>
      <div className="flex justify-between items-start">
        <div>
          <h1 className={`${compact ? 'text-base' : 'text-xl'} font-black uppercase tracking-widest text-white/90 mb-1`}>Hoplite</h1>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Tactical Arena</p>
        </div>
        <div className={`px-2 py-1 bg-white/10 rounded border border-white/20 text-[10px] font-black text-white/60 ${compact ? 'hidden sm:block' : ''}`}>
          V2.1.0
        </div>
      </div>

      {!hideInitiativeQueue && <InitiativeDisplay gameState={gameState} />}

      <div className={compact ? 'space-y-4' : 'space-y-6'}>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Vitality</span>
          <div className="flex items-end gap-2">
            <span className={`${compact ? 'text-3xl' : 'text-4xl'} font-black text-red-500 leading-none`}>{gameState.player.hp}</span>
            <span className="text-xl text-white/20 font-bold leading-none mb-1">/</span>
            <span className="text-xl text-gray-500 font-bold leading-none mb-1">{gameState.player.maxHp}</span>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Guardian Plating</span>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-sm ${gameState.player.temporaryArmor ? 'bg-blue-400 rotate-45' : 'bg-white/5 border border-white/10'}`} />
            <span className="text-2xl font-black text-blue-400 leading-none">{gameState.player.temporaryArmor || 0}</span>
          </div>
        </div>

        {gameState.enemies.filter(e => e.subtype === 'sentinel').map(boss => (
          <div key={boss.id} className="pt-4 animate-in slide-in-from-right-8 duration-500">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-black text-red-500 uppercase tracking-tighter italic">Sentinel Directive</span>
              <span className="text-lg font-black">{boss.hp} <span className="text-white/20 text-xs">/ {boss.maxHp}</span></span>
            </div>
            <div className="h-4 w-full bg-red-950/30 rounded-md border border-red-500/20 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all duration-300"
                style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className={`${compact ? 'py-4 space-y-4' : 'py-8 space-y-6'} border-y border-white/5`}>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Arcade Progress</span>
            <span className="text-xl font-black">{gameState.floor} <span className="text-white/20 text-sm">/ 10</span></span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all duration-1000 ease-out"
              style={{ width: `${(gameState.floor / 10) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Current Score</span>
          <span className="text-xl font-black text-white">{score.toLocaleString()}</span>
        </div>
      </div>

      <div className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
        <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Directives</span>
        <button
          disabled={inputLocked}
          onClick={onWait}
          className={`w-full flex justify-between items-center ${compact ? 'px-3 py-2.5' : 'px-4 py-3'} border rounded-xl transition-all group ${inputLocked
            ? 'bg-white/[0.03] border-white/5 text-white/30 cursor-not-allowed opacity-50'
            : 'bg-white/5 hover:bg-white/10 border-white/10'
          }`}
        >
          <span className="text-sm font-bold text-white/70">Secure & Wait</span>
          <span className="text-lg grayscale group-hover:grayscale-0 transition-all">S</span>
        </button>
        <button
          onClick={onReset}
          className={`w-full flex justify-between items-center ${compact ? 'px-3 py-2.5' : 'px-4 py-3'} bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all group`}
        >
          <span className="text-sm font-bold text-red-400/80">Reset Chronology</span>
          <span className="text-lg grayscale group-hover:grayscale-0 transition-all">R</span>
        </button>
        <button
          onClick={onExitToHub}
          className={`w-full flex justify-between items-center ${compact ? 'px-3 py-2.5' : 'px-4 py-3'} bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group`}
        >
          <span className="text-sm font-bold text-white/70">Return to Hub</span>
          <span className="text-lg grayscale group-hover:grayscale-0 transition-all">H</span>
        </button>
      </div>
    </div>
  );
};

