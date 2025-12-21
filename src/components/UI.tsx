import React from 'react';
import type { GameState } from '../game/types';

interface UIProps {
    gameState: GameState;
    onReset: () => void;
    onWait: () => void;
}

export const UI: React.FC<UIProps> = ({ gameState, onReset, onWait }) => {
    return (
        <div className="absolute top-4 left-4 z-10 text-white flex flex-col gap-4">
            <div className="bg-gray-800 p-4 rounded-lg shadow-xl border border-gray-700">
                <h1 className="text-xl font-bold mb-2">Hoplite Web</h1>
                <div className="space-y-1 text-sm font-medium">
                    <p>Floor: {gameState.floor} | Turn: {gameState.turn}</p>
                    <p className="text-red-400">HP: {gameState.player.hp} / {gameState.player.maxHp}</p>
                    <p className={gameState.hasSpear ? "text-yellow-400" : "text-gray-500"}>
                        Spear: {gameState.hasSpear ? "Available 🔱" : "Thrown!"}
                    </p>
                    <p className="text-indigo-400">
                        Upgrades: {gameState.upgrades.join(', ') || 'None'}
                    </p>
                </div>
            </div>

            {gameState.message && (
                <div className="bg-black bg-opacity-80 p-3 rounded border border-gray-700 max-w-xs animate-pulse-once">
                    {gameState.message}
                </div>
            )}

            <div className="flex gap-2">
                <button
                    onClick={onReset}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold transition-colors shadow-lg"
                >
                    Reset Level
                </button>
                <button
                    onClick={onWait}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded font-bold transition-colors shadow-lg"
                >
                    Wait 🛡️
                </button>
            </div>
        </div>
    );
};
