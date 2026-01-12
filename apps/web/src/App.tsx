import { useReducer, useRef, useState, useEffect } from 'react';
import { GameBoard } from './components/GameBoard';
import { UI } from './components/UI';
import { UpgradeOverlay } from './components/UpgradeOverlay';
import { SkillTray } from './components/SkillTray';
import { TutorialManager } from './components/TutorialManager';
import ReplayManager from './components/ReplayManager';
import { gameReducer, generateInitialState, generateHubState } from '@hop/engine/logic';
import type { Point, Action, GameState } from '@hop/engine/types';
import type { ReplayRecord } from './components/ReplayManager';
import { hexEquals } from '@hop/engine/hex';
import { GRID_WIDTH, GRID_HEIGHT } from '@hop/engine/constants';
import { isPlayerTurn } from '@hop/engine/initiative';
import { ArchetypeSelector } from './components/ArchetypeSelector';
import type { Loadout } from '@hop/engine/loadout';

function App() {
  const [gameState, dispatch] = useReducer(gameReducer, null, () => {
    const saved = localStorage.getItem('hop_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrate occupancyMask entries (BigInt) which were serialized to strings
        if (parsed && Array.isArray(parsed.occupancyMask)) {
          parsed.occupancyMask = parsed.occupancyMask.map((v: any) => typeof v === 'string' ? BigInt(v) : v);
        }
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
    return generateHubState();
  });

  useEffect(() => {
    console.log('Game Status Changed:', gameState.gameStatus);
    if (gameState.gameStatus === 'playing' || gameState.gameStatus === 'choosing_upgrade') {
      // JSON.stringify cannot serialize BigInt; convert BigInt values to strings during save.
      const safeStringify = (obj: any) => JSON.stringify(obj, (_k, v) => typeof v === 'bigint' ? v.toString() : v);
      localStorage.setItem('hop_save', safeStringify(gameState));
    } else {
      localStorage.removeItem('hop_save');
    }
  }, [gameState]);

  // Handle Enemy Turns with a delay
  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;

    const playerTurn = isPlayerTurn(gameState);

    // If it's not the player's turn, trigger an advance after a delay
    if (!playerTurn) {
      // console.log(`[Turn Management] Processing Turn for actor index: ${gameState.initiativeQueue?.currentIndex}`);
      const timer = setTimeout(() => {
        dispatch({ type: 'ADVANCE_TURN' });
      }, 100); // Reduced delay for faster turns
      return () => clearTimeout(timer);
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

  const handleSelectLoadout = (loadout: Loadout) => {
    console.log('App: Handling Loadout Select:', loadout.id);
    dispatch({ type: 'START_RUN', payload: { loadoutId: loadout.id } });
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
          {gameState.gameStatus === 'hub' ? (
            <ArchetypeSelector onSelect={handleSelectLoadout} />
          ) : (
            <div className={`w-full h-full relative border border-white/5 bg-[#030712]/50 rounded-[40px] shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden ${gameState.isShaking ? 'animate-shake' : ''}`}>
              <GameBoard
                gameState={gameState}
                onMove={handleTileClick}
                selectedSkillId={selectedSkillId}
                showMovementRange={showMovementRange}
              />
            </div>
          )}
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
