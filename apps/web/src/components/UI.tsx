import React from 'react';
import type { GameState } from '@hop/engine/types';
import { computeScore } from '@hop/engine';

interface UIProps {
    gameState: GameState;
    onReset: () => void;
    onWait: () => void;
    onExitToHub: () => void;
}

// Use canonical engine score

import { InitiativeDisplay } from './InitiativeQueue';

export const UI: React.FC<UIProps> = ({ gameState, onReset, onWait, onExitToHub }) => {
    const score = computeScore(gameState);

    const messages = Array.isArray(gameState.message) ? gameState.message : [];
    const logRef = React.useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of log
    React.useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="flex flex-col h-full max-h-screen">
            <div className="flex flex-col gap-8 p-8 overflow-y-auto flex-1 min-h-0">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-widest text-white/90 mb-1">Hoplite</h1>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Tactical Arena</p>
                    </div>
                    <div className="px-2 py-1 bg-white/10 rounded border border-white/20 text-[10px] font-black text-white/60">
                        V2.1.0
                    </div>
                </div>

                {/* Initiative Queue */}
                <InitiativeDisplay gameState={gameState} />

                {/* Health & Armor Section */}
                <div className="space-y-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Vitality</span>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-black text-red-500 leading-none">{gameState.player.hp}</span>
                            <span className="text-xl text-white/20 font-bold leading-none mb-1">/</span>
                            <span className="text-xl text-gray-500 font-bold leading-none mb-1">{gameState.player.maxHp}</span>
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Guardian Plating</span>
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-sm ${gameState.player.temporaryArmor ? 'bg-blue-400 rotate-45' : 'bg-white/5 border border-white/10'}`}></div>
                            <span className="text-2xl font-black text-blue-400 leading-none">{gameState.player.temporaryArmor || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Stats Section */}
                <div className="py-8 border-y border-white/5 space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Floor</span>
                        <span className="text-xl font-black">{gameState.floor}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Current Score</span>
                        <span className="text-xl font-black text-white">{score.toLocaleString()}</span>
                    </div>
                </div>

                {/* Actions Section */}
                <div className="flex flex-col gap-3">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Directives</span>
                    <button
                        onClick={onWait}
                        className="w-full flex justify-between items-center px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group"
                    >
                        <span className="text-sm font-bold text-white/70">Secure & Wait</span>
                        <span className="text-lg grayscale group-hover:grayscale-0 transition-all">🛡️</span>
                    </button>
                    <button
                        onClick={onReset}
                        className="w-full flex justify-between items-center px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all group"
                    >
                        <span className="text-sm font-bold text-red-400/80">Reset Chronology</span>
                        <span className="text-lg grayscale group-hover:grayscale-0 transition-all">🔄</span>
                    </button>
                    <button
                        onClick={onExitToHub}
                        className="w-full flex justify-between items-center px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group"
                    >
                        <span className="text-sm font-bold text-white/70">Return to Hub</span>
                        <span className="text-lg grayscale group-hover:grayscale-0 transition-all">🏠</span>
                    </button>
                </div>
            </div>

            {/* Message Feed - Fixed at bottom */}
            {messages.length > 0 && (
                <div className="p-8 border-t border-white/5 bg-[#030712]/80 backdrop-blur-sm">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-3 block">Tactical Log</span>
                    <div
                        ref={logRef}
                        className="flex flex-col gap-2 bg-white/[0.02] border border-white/5 p-4 rounded-2xl overflow-y-auto max-h-[140px]"
                    >
                        {messages.slice(-20).map((msg, i) => (
                            <div key={i} className="flex gap-2 items-start">
                                <span className="text-[10px] text-white/20 font-bold mt-1 leading-none shrink-0">
                                    [{messages.length - 20 + i < 0 ? i : messages.length - 20 + i}]
                                </span>
                                <p className="text-[11px] leading-tight text-white/70 font-medium whitespace-pre-wrap">
                                    {msg}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

