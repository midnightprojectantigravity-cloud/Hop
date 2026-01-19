import { useReducer, useRef, useState, useEffect } from 'react';
import { GameBoard } from './components/GameBoard';
import { UI } from './components/UI';
import { UpgradeOverlay } from './components/UpgradeOverlay';
import { SkillTray } from './components/SkillTray';
import { gameReducer, generateInitialState, generateHubState, hexEquals } from '@hop/engine';
import type { Point, Action, GameState, Loadout } from '@hop/engine';
import type { ReplayRecord } from './components/ReplayManager';
import { GRID_WIDTH, GRID_HEIGHT } from '@hop/engine';
import { isPlayerTurn } from '@hop/engine';
import { Hub } from './components/Hub';

function App() {
  const [gameState, dispatch] = useReducer(gameReducer, null, () => {
    const saved = localStorage.getItem('hop_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.occupancyMask)) {
          parsed.occupancyMask = parsed.occupancyMask.map((v: any) => typeof v === 'string' ? BigInt(v) : v);
        }
        const isCompatible = parsed.gridWidth === GRID_WIDTH && parsed.gridHeight === GRID_HEIGHT;

        if (isCompatible && (parsed.gameStatus === 'playing' || parsed.gameStatus === 'choosing_upgrade')) {
          if (!Array.isArray(parsed.message)) parsed.message = [];
          return parsed;
        }
      } catch (e) { console.error('Failed to load save', e); }
    }
    return generateHubState();
  });

  useEffect(() => {
    if (gameState.gameStatus === 'playing' || gameState.gameStatus === 'choosing_upgrade') {
      const safeStringify = (obj: any) => JSON.stringify(obj, (_k, v) => typeof v === 'bigint' ? v.toString() : v);
      localStorage.setItem('hop_save', safeStringify(gameState));
    } else {
      localStorage.removeItem('hop_save');
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;
    const playerTurn = isPlayerTurn(gameState);
    if (!playerTurn) {
      const timer = setTimeout(() => dispatch({ type: 'ADVANCE_TURN' }), 400);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [showMovementRange, setShowMovementRange] = useState(false);
  const [tutorialInstructions, setTutorialInstructions] = useState<string | null>(null);
  const [floorIntro, setFloorIntro] = useState<{ floor: number; theme: string } | null>(null);

  // Trigger floor intro on floor change
  const lastFloorRef = useRef(gameState.floor);
  useEffect(() => {
    if (gameState.gameStatus === 'playing' && gameState.floor !== lastFloorRef.current) {
      setFloorIntro({ floor: gameState.floor, theme: gameState.theme || 'Catacombs' });
      lastFloorRef.current = gameState.floor;
      const timer = setTimeout(() => setFloorIntro(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState.floor, gameState.gameStatus, gameState.theme]);

  // Also trigger intro on initial start
  useEffect(() => {
    if (gameState.gameStatus === 'playing' && gameState.floor === 1 && !lastFloorRef.current) {
      setFloorIntro({ floor: 1, theme: gameState.theme || 'Catacombs' });
      lastFloorRef.current = 1;
      const timer = setTimeout(() => setFloorIntro(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState.gameStatus]);

  const replayIndexRef = useRef(0);
  const replayTimerRef = useRef<number | null>(null);

  const handleTileClick = (target: Point) => {
    if (selectedSkillId) {
      dispatch({ type: 'USE_SKILL', payload: { skillId: selectedSkillId, target } });
      setSelectedSkillId(null);
      return;
    }
    if (hexEquals(target, gameState.player.position)) {
      setShowMovementRange(!showMovementRange);
      return;
    }
    dispatch({ type: 'MOVE', payload: target });
    setShowMovementRange(false);
  };

  const handleSelectUpgrade = (upgrade: string) => dispatch({ type: 'SELECT_UPGRADE', payload: upgrade });
  const handleReset = () => { dispatch({ type: 'RESET' }); setSelectedSkillId(null); };
  const handleWait = () => { dispatch({ type: 'WAIT' }); setSelectedSkillId(null); };

  const startReplay = (r: ReplayRecord) => {
    if (!r) return;
    const seed = r.seed || r.id || String(Date.now());
    const init = generateInitialState(1, seed);
    dispatch({ type: 'LOAD_STATE', payload: init } as Action);
    if (replayTimerRef.current) window.clearInterval(replayTimerRef.current);
    replayIndexRef.current = 0;
    replayTimerRef.current = window.setInterval(() => {
      const idx = replayIndexRef.current;
      if (idx >= r.actions.length) { if (replayTimerRef.current) window.clearInterval(replayTimerRef.current); return; }
      const a = r.actions[idx];
      dispatch(a as Action);
      replayIndexRef.current = idx + 1;
    }, 300);
  };

  const handleLoadScenario = (state: GameState, instructions: string) => { dispatch({ type: 'LOAD_STATE', payload: state }); setTutorialInstructions(instructions); setSelectedSkillId(null); };

  const handleSelectLoadout = (loadout: Loadout) => { dispatch({ type: 'APPLY_LOADOUT', payload: loadout }); };

  const handleExitToHub = () => { dispatch({ type: 'EXIT_TO_HUB' }); setSelectedSkillId(null); };

  const handleStartRun = () => {
    const id = gameState.selectedLoadoutId;
    if (!id) { console.warn('Start Run called without a selected loadout.'); return; }
    dispatch({ type: 'START_RUN', payload: { loadoutId: id } });
  };

  if (gameState.gameStatus === 'hub') {
    return (
      <div className="w-screen h-screen bg-[#030712] overflow-hidden text-white font-['Inter',_sans-serif]">
        <Hub
          gameState={gameState}
          onSelectLoadout={(l) => handleSelectLoadout(l)}
          onStartRun={handleStartRun}
          onLoadScenario={handleLoadScenario}
          onStartReplay={startReplay}
        />
        {/* Hub instructions overlay */}
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
      </div>
    );
  }

  return (
    <div className="flex w-screen h-screen bg-[#030712] overflow-hidden text-white font-['Inter',_sans-serif]">
      {/* Left Sidebar: HUD & Tactical Log */}
      <aside className="w-80 border-r border-white/5 bg-[#030712] flex flex-col z-20 overflow-y-auto">
        <UI gameState={gameState} onReset={handleReset} onWait={handleWait} onExitToHub={handleExitToHub} />
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

      {/* Right Sidebar: Skills */}
      <aside className="w-80 border-l border-white/5 bg-[#030712] flex flex-col z-20 overflow-y-auto">
        <div className="p-6 flex flex-col gap-8 h-full">
          <div className="flex-1">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-6">Tactical Skills</h3>
            <SkillTray
              skills={gameState.player.activeSkills || []}
              selectedSkillId={selectedSkillId}
              onSelectSkill={setSelectedSkillId}
              hasSpear={gameState.hasSpear}
              gameState={gameState}
            />
          </div>

          <div className="pt-8 border-t border-white/5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/20">
              Hop Engine v5.0
            </div>
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
      {gameState.gameStatus === 'lost' && (
        <div className="fixed inset-0 bg-red-950/90 backdrop-blur-xl flex flex-col items-center justify-center z-[200] transition-opacity duration-500">
          <div className="text-8xl mb-8 animate-bounce">💀</div>
          <h2 className="text-6xl font-black text-white mb-2 tracking-tighter italic uppercase">Identity Deleted</h2>
          <p className="text-red-200/60 mb-12 text-xl font-medium tracking-widest uppercase">Simulation Terminated</p>
          <button
            onClick={handleReset}
            className="px-12 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.3)]"
          >
            Reinitialize Simulation
          </button>
        </div>
      )}
      {gameState.gameStatus === 'won' && (
        <div className="fixed inset-0 bg-indigo-950/90 backdrop-blur-xl flex flex-col items-center justify-center z-[200] transition-opacity duration-500">
          <div className="text-8xl mb-8 animate-bounce">🏆</div>
          <h2 className="text-6xl font-black text-white mb-2 tracking-tighter italic uppercase">Arcade Mode Cleared</h2>
          <p className="text-indigo-200/60 mb-2 text-xl font-medium tracking-widest uppercase">The Sentinel has fallen</p>
          <p className="text-white/20 mb-12 text-sm font-bold uppercase tracking-[0.3em]">Score: {gameState.completedRun?.score || 0}</p>
          <button
            onClick={handleExitToHub}
            className="px-12 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.3)]"
          >
            Return to Command Center
          </button>
        </div>
      )}

      {/* Floor Intro Overlay */}
      {floorIntro && (
        <div className="fixed inset-0 flex items-center justify-center z-[150] pointer-events-none animate-in fade-in duration-700">
          <div className="text-center">
            <div className="text-indigo-500 font-black text-2xl uppercase tracking-[0.5em] mb-4 animate-in slide-in-from-bottom-8 duration-1000">Floor {floorIntro.floor}</div>
            <h2 className="text-8xl font-black text-white uppercase tracking-tighter italic animate-in slide-in-from-top-12 duration-1000">{floorIntro.theme}</h2>
            <div className="h-1 w-64 bg-white/20 mx-auto mt-8 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 animate-[progress_3s_linear]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
