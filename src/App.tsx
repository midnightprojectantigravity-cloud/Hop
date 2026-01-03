import { useReducer, useRef, useState, useEffect } from 'react';
import { GameBoard } from './components/GameBoard';
import { UI } from './components/UI';
import { UpgradeOverlay } from './components/UpgradeOverlay';
import { SkillTray } from './components/SkillTray';
import ReplayManager from './components/ReplayManager';
import { gameReducer, generateInitialState } from './game/logic';
import type { Point, Action } from './game/types';
import type { ReplayRecord } from './components/ReplayManager';
import { hexEquals } from './game/hex';

function App() {
  const [gameState, dispatch] = useReducer(gameReducer, generateInitialState(), (initial) => {
    const saved = localStorage.getItem('hop_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.gameStatus === 'playing' || parsed.gameStatus === 'choosing_upgrade') return parsed;
      } catch (e) { console.error("Failed to load save", e); }
    }
    return initial;
  });

  useEffect(() => {
    if (gameState.gameStatus === 'playing' || gameState.gameStatus === 'choosing_upgrade') {
      localStorage.setItem('hop_save', JSON.stringify(gameState));
    } else {
      localStorage.removeItem('hop_save');
    }
  }, [gameState]);

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [showMovementRange, setShowMovementRange] = useState(false);

  const replayIndexRef = useRef(0);
  const replayTimerRef = useRef<number | null>(null);

  const handleTileClick = (target: Point) => {
    // 1. If a skill is selected, use it
    if (selectedSkillId) {
      dispatch({
        type: 'USE_SKILL',
        payload: { skillId: selectedSkillId, target }
      });
      setSelectedSkillId(null);
      return;
    }

    // 2. If clicking the player, toggle movement range overlay
    if (hexEquals(target, gameState.player.position)) {
      setShowMovementRange(!showMovementRange);
      return;
    }

    // 3. Otherwise, try to move
    dispatch({ type: 'MOVE', payload: target });
    setShowMovementRange(false); // Hide range after moving
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
    <div className="w-screen h-screen bg-[#030712] flex justify-center items-center overflow-hidden relative">
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
        selectedSkillId={selectedSkillId}
        showMovementRange={showMovementRange}
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
