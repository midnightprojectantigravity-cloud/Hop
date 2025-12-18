import React from 'react';
import type { GameState } from '../game/types';

export const UI: React.FC<{ gameState: GameState, onReset: () => void }> = ({ gameState, onReset }) => {
    return (
        <div className="absolute top-0 left-0 p-4 bg-gray-900 bg-opacity-80 rounded text-white min-w-[200px]">
            <h1 className="text-xl font-bold mb-2">Hoplite Web</h1>
            <div className="mb-2">
                <p>Turn: {gameState.turn}</p>
                <p className="text-blue-400">Player HP: {gameState.player.hp} / {gameState.player.maxHp}</p>
                <p className="text-yellow-400">Energy: {gameState.player.energy}</p>
            </div>
            <div className="p-2 border border-gray-700 bg-black rounded mb-4">
                {gameState.message}
            </div>
            <button
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded"
                onClick={onReset}
            >
                Reset Level
            </button>
        </div>
    );
};
