import { useReducer } from 'react';
import { GameBoard } from './components/GameBoard';
import { UI } from './components/UI';
import { gameReducer, generateInitialState } from './game/logic'; // Fix import path if needed (logic vs reducer)
import type { Point } from './game/types';

function App() {
  const [gameState, dispatch] = useReducer(gameReducer, generateInitialState());

  const handleMove = (target: Point) => {
    dispatch({ type: 'MOVE', payload: target });
  };

  const handleReset = () => {
    dispatch({ type: 'RESET' });
  };

  return (
    <div className="w-screen h-screen bg-gray-900 flex justify-center items-center overflow-hidden relative">
      <UI gameState={gameState} onReset={handleReset} />
      <GameBoard gameState={gameState} onMove={handleMove} />
    </div>
  );
}

export default App;
