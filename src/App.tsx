import { useReducer, useRef, useState } from 'react';
import { GameBoard } from './components/GameBoard';
import { UI } from './components/UI';
import { UpgradeOverlay } from './components/UpgradeOverlay';
import { SkillTray } from './components/SkillTray';
import ReplayManager from './components/ReplayManager';
import { gameReducer, generateInitialState } from './game/logic';
import type { Point, Action } from './game/types';
import type { ReplayRecord } from './components/ReplayManager';

function App() {
  const [gameState, dispatch] = useReducer(gameReducer, generateInitialState());
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const replayIndexRef = useRef(0);
  const replayTimerRef = useRef<number | null>(null);

  const handleTileClick = (target: Point) => {
    if (selectedSkillId) {
      // Use selected skill
      dispatch({
        type: 'USE_SKILL',
        payload: { skillId: selectedSkillId, target }
      });
      setSelectedSkillId(null);
    } else {
      // Default move
      dispatch({ type: 'MOVE', payload: target });
    }
  };

  const handleThrowSpear = (target: Point) => {
    dispatch({ type: 'THROW_SPEAR', payload: target });
  };

  const handleLeap = (target: Point) => {
    dispatch({ type: 'LEAP', payload: target });
  };

  const handleSelectUpgrade = (upgrade: string) => {
    dispatch({ type: 'SELECT_UPGRADE', payload: upgrade });
  };

  const handleReset = () => {
    dispatch({ type: 'RESET' });
    setSelectedSkillId(null);
  };

  const handleWait = () => {
    dispatch({ type: 'WAIT' });
    setSelectedSkillId(null);
  };

  // Replay control
  const startReplay = (r: ReplayRecord) => {
    if (!r) return;
    const seed = r.seed || r.id || String(Date.now());
    const init = generateInitialState(1, seed);
    dispatch({ type: 'LOAD_STATE', payload: init } as Action);

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
    <div className="w-screen h-screen bg-[#0f172a] flex justify-center items-center overflow-hidden relative">
      <UI gameState={gameState} onReset={handleReset} onWait={handleWait} />

      <ReplayManager
        gameState={gameState}
        onStartReplay={startReplay}
        onStopReplay={stopReplay}
        onStepReplay={stepReplay}
      />

      <GameBoard
        gameState={gameState}
        onMove={handleTileClick}
        onThrowSpear={handleThrowSpear}
        onLeap={handleLeap}
      />

      <SkillTray
        skills={gameState.player.activeSkills || []}
        selectedSkillId={selectedSkillId}
        onSelectSkill={setSelectedSkillId}
        hasSpear={gameState.hasSpear}
      />

      {gameState.gameStatus === 'choosing_upgrade' && (
        <UpgradeOverlay onSelect={handleSelectUpgrade} gameState={gameState} />
      )}
    </div>
  );
}

export default App;
