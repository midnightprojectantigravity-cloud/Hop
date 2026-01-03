import React from 'react';
import type { GameState } from '../game/types';

interface UIProps {
    gameState: GameState;
    onReset: () => void;
    onWait: () => void;
}

// Calculate score based on design doc formula
const calculateScore = (state: GameState): number => {
    const killScore = (state.kills || 0) * 10;
    const envKillScore = (state.environmentalKills || 0) * 25;
    const floorScore = state.floor * 100;
    return killScore + envKillScore + floorScore;
};

export const UI: React.FC<UIProps> = ({ gameState, onReset, onWait }) => {
    const score = calculateScore(gameState);

    return (
        <div className="absolute top-0 left-0 w-full z-10 p-4 pointer-events-none">
            <div className="max-w-md mx-auto flex justify-between items-center bg-gray-900/90 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/10 shadow-2xl pointer-events-auto">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Health</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-red-500">{gameState.player.hp}</span>
                        <span className="text-white/20">/</span>
                        <span className="text-gray-400 font-bold">{gameState.player.maxHp}</span>
                    </div>
                </div>

                <div className="flex flex-col items-center flex-1 mx-4">
                    <div className="flex items-center gap-4 mb-1">
                        <button onClick={onWait} className="p-1 hover:bg-white/10 rounded-full transition-colors" title="Wait (🛡️)">
                            <span className="text-blue-400">🛡️</span>
                        </button>
                        <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Floor {gameState.floor}</span>
                        <button onClick={onReset} className="p-1 hover:bg-white/10 rounded-full transition-colors" title="Reset Level (🔄)">
                            <span className="text-red-400">🔄</span>
                        </button>
                    </div>
                    <span className="text-lg font-black text-white tracking-widest">{score.toLocaleString()}</span>
                </div>


                <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Armor</span>
                    <span className="text-xl font-black text-blue-400">{gameState.player.temporaryArmor || 0}</span>
                </div>
            </div>

            {gameState.message && (
                <div className="mt-4 max-w-xs mx-auto text-center">
                    <div className="inline-block bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 text-xs text-white/80 font-medium animate-pulse-once">
                        {gameState.message}
                    </div>
                </div>
            )}
        </div>
    );
};

