/**
 * MAIN COMPOSITION ROOT (View Layer)
 * Manages UI state, React side-effects, and orchestrates the game loop via dispatch.
 * TODO: Implement "Infinite Undo" button in the UI using gameState.undoStack.
 */
import { useReducer, useRef, useState, useEffect } from 'react';
import { GameBoard } from './components/GameBoard';
import { UI } from './components/UI';
import { UpgradeOverlay } from './components/UpgradeOverlay';
import { SkillTray } from './components/SkillTray';
import { TutorialManager } from './components/TutorialManager';
import ReplayManager from './components/ReplayManager';
import { gameReducer, generateInitialState } from './game/logic';
import type { Point, Action, GameState } from './game/types';
import type { ReplayRecord } from './components/ReplayManager';
import { hexEquals } from './game/hex';
import { GRID_WIDTH, GRID_HEIGHT } from './game/constants';

function App() {
  const [gameState, dispatch] = useReducer(gameReducer, generateInitialState(), (initial) => {
    const saved = localStorage.getItem('hop_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Integrity Check: Discard save if grid dimensions changed in constants.ts
        const isCompatible = parsed.gridWidth === GRID_WIDTH && parsed.gridHeight === GRID_HEIGHT;

        if (isCompatible && (parsed.gameStatus === 'playing' || parsed.gameStatus === 'choosing_upgrade')) {
          // Migration: ensure message is an array
          if (!Array.isArray(parsed.message)) {
            parsed.message = [];
          }
          return parsed;
        }
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
  const [tutorialInstructions, setTutorialInstructions] = useState<string | null>(null);

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

  const handleLoadScenario = (state: GameState, instructions: string) => {
    dispatch({ type: 'LOAD_STATE', payload: state });
    setTutorialInstructions(instructions);
    setSelectedSkillId(null);
  };

  return (
    <div className="flex w-screen h-screen bg-[#030712] overflow-hidden text-white font-['Inter',_sans-serif]">
      {/* Left Sidebar: HUD & Tactical Log */}
      <aside className="w-80 border-r border-white/5 bg-[#030712] flex flex-col z-20 overflow-y-auto">
        <UI gameState={gameState} onReset={handleReset} onWait={handleWait} />
      </aside>

      {/* Center: The Map (Full Height) */}
      <main className="flex-1 relative flex items-center justify-center bg-[#020617] overflow-hidden">
        <div className="w-full h-full p-8 flex items-center justify-center">
          <div className={`w-full h-full relative border border-white/5 bg-[#030712]/50 rounded-[40px] shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden ${gameState.isShaking ? 'animate-shake' : ''}`}>
            <GameBoard
              gameState={gameState}
              onMove={handleTileClick}
              selectedSkillId={selectedSkillId}
              showMovementRange={showMovementRange}
            />
          </div>
        </div>
      </main>

      {/* Right Sidebar: Skills & Replays */}
      <aside className="w-80 border-l border-white/5 bg-[#030712] flex flex-col z-20 overflow-y-auto">
        <div className="p-6 flex flex-col gap-8 h-full">
          <div className="flex-1">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-6">Tactical Skills</h3>
            <SkillTray
              skills={gameState.player.activeSkills || []}
              selectedSkillId={selectedSkillId}
              onSelectSkill={setSelectedSkillId}
              hasSpear={gameState.hasSpear}
            />
          </div>

          <div className="pt-8 border-t border-white/5">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-4">Historical Replay</h3>
            <ReplayManager
              gameState={gameState}
              onStartReplay={startReplay}
              onStopReplay={stopReplay}
              onStepReplay={stepReplay}
            />
          </div>

          <div className="pt-8 border-t border-white/5">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-4">Training Simulations</h3>
            <TutorialManager onLoadScenario={handleLoadScenario} />
          </div>
        </div>
      </aside>

      {/* Tutorial Instructions Overlay */}
      {tutorialInstructions && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-blue-900/90 border border-blue-500/30 p-4 rounded-xl backdrop-blur-md shadow-xl z-30 max-w-lg text-center animate-in fade-in slide-in-from-top-4">
          <h4 className="text-blue-200 font-bold uppercase text-xs tracking-widest mb-1">Simulation Objective</h4>
          <p className="text-white text-sm">{tutorialInstructions}</p>
          <button
            onClick={() => setTutorialInstructions(null)}
            className="absolute -top-2 -right-2 w-6 h-6 bg-blue-950 rounded-full border border-blue-500/50 flex items-center justify-center text-xs hover:bg-blue-800 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Overlays */}
      {gameState.gameStatus === 'choosing_upgrade' && (
        <UpgradeOverlay onSelect={handleSelectUpgrade} gameState={gameState} />
      )}
    </div>
  );
}

export default App;
