import { useReducer, useRef } from 'react';
import { GameBoard } from './components/GameBoard';
import { UI } from './components/UI';
import { UpgradeOverlay } from './components/UpgradeOverlay';
import ReplayManager from './components/ReplayManager';
import { gameReducer, generateInitialState } from './game/logic'; // Fix import path if needed (logic vs reducer)
import type { Point, Action } from './game/types';
import type { ReplayRecord } from './components/ReplayManager';

function App() {
  const [gameState, dispatch] = useReducer(gameReducer, generateInitialState());
  const replayIndexRef = useRef(0);
  const replayTimerRef = useRef<number | null>(null);

  const handleMove = (target: Point) => {
    dispatch({ type: 'MOVE', payload: target });
  };

  const handleLeap = (target: Point) => {
    dispatch({ type: 'LEAP', payload: target });
  };

  const handleThrowSpear = (target: Point) => {
    dispatch({ type: 'THROW_SPEAR', payload: target });
  };

  const handleSelectUpgrade = (upgrade: string) => {
    dispatch({ type: 'SELECT_UPGRADE', payload: upgrade });
  };

  const handleReset = () => {
    dispatch({ type: 'RESET' });
  };

  const handleWait = () => {
    dispatch({ type: 'WAIT' });
  };

  // Replay control: when a replay is started, initialize state and step through actions
  const startReplay = (r: ReplayRecord) => {
    if (!r) return;
  // Prefer a recorded seed; fall back to the replay id if present (deterministic), otherwise use wall-clock
  const seed = r.seed || r.id || String(Date.now());
    // initialize exact seeded state for floor 1 (or use recorded floor if needed)
  const init = generateInitialState(1, seed);
  // load initial state into reducer
    dispatch({ type: 'LOAD_STATE', payload: init } as Action);

    // clear any existing timer
    if (replayTimerRef.current) {
      window.clearInterval(replayTimerRef.current);
    }

    replayIndexRef.current = 0;
    replayTimerRef.current = window.setInterval(() => {
      const idx = replayIndexRef.current;
      if (idx >= r.actions.length) {
        if (replayTimerRef.current) window.clearInterval(replayTimerRef.current);
        return;
      }
  const a = r.actions[idx];
  // dispatch the recorded action
  dispatch(a as Action);
      replayIndexRef.current = idx + 1;
    }, 300);
  };

  const stopReplay = () => {
    if (replayTimerRef.current) {
      window.clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
  };

  const stepReplay = (r: ReplayRecord) => {
    const idx = replayIndexRef.current;
    if (idx >= r.actions.length) return;
    const a = r.actions[idx];
    dispatch(a as Action);
    replayIndexRef.current = idx + 1;
  };

  return (
    <div className="w-screen h-screen bg-gray-900 flex justify-center items-center overflow-hidden relative">
      <UI gameState={gameState} onReset={handleReset} onWait={handleWait} />
  <ReplayManager gameState={gameState} onStartReplay={startReplay} onStopReplay={stopReplay} onStepReplay={stepReplay} />
      <GameBoard
        gameState={gameState}
        onMove={handleMove}
        onThrowSpear={handleThrowSpear}
        onLeap={handleLeap}
      />
      {gameState.gameStatus === 'choosing_upgrade' && (
        <UpgradeOverlay onSelect={handleSelectUpgrade} />
      )}
    </div>
  );
}

export default App;
