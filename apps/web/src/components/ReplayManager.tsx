import React, { useState } from 'react';
import type { Action, GameState } from '@hop/engine/types';
import { generateInitialState, gameReducer } from '@hop/engine/logic';
import { createRng } from '@hop/engine/rng';
import { safeStringify, safeParse } from '@hop/engine';
import Modal from './Modal';

export interface ReplayRecord {
  id: string;
  seed?: string;
  actions: Action[];
  score: number;
  floor: number;
  date: string;
}

const STORAGE_KEY = 'hop_replays_v1';
const LEADERBOARD_KEY = 'hop_leaderboard_v1';

const loadAll = (): ReplayRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ReplayRecord[];
  } catch (e) {
    console.error('Failed to load replays', e);
    return [];
  }
};

const saveAll = (list: ReplayRecord[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save replays', e);
  }
};

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  floor: number;
  date: string;
  seed?: string;
}

const loadLeaderboard = (): LeaderboardEntry[] => {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [] as LeaderboardEntry[];
    return JSON.parse(raw) as LeaderboardEntry[];
  } catch (e) {
    console.error('Failed to load leaderboard', e);
    return [] as LeaderboardEntry[];
  }
};

const saveLeaderboard = (list: LeaderboardEntry[]) => {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save leaderboard', e);
  }
};

export const ReplayManager: React.FC<{
  gameState: GameState;
  onStartReplay: (r: ReplayRecord) => void;
  onStopReplay?: () => void;
  onStepReplay?: (r: ReplayRecord) => void;
}> = ({ gameState, onStartReplay, onStopReplay, onStepReplay }) => {
  const [list, setList] = useState<ReplayRecord[]>(() => loadAll());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => loadLeaderboard());
  const [open, setOpen] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(() => localStorage.getItem('hop_leaderboard_endpoint'));
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('Player');
  const [showEndpointModal, setShowEndpointModal] = useState(false);
  const [endpointInput, setEndpointInput] = useState(endpoint ?? '');
  const [pendingSubmission, setPendingSubmission] = useState<GameState['completedRun'] | null>(null);
  const [remoteList, setRemoteList] = useState<LeaderboardEntry[] | null>(null);

  const saveCurrent = () => {
  // Prefer existing run seeds; fall back to a deterministic '0' seed to avoid wall-clock randomness
  const seed = gameState.initialSeed ?? gameState.rngSeed ?? '0';
  const rng = createRng(`${seed}:${gameState.actionLog?.length ?? 0}`);
  const id = rng.id(9);
  const score = (gameState.player.hp || 0) + (gameState.floor || 0) * 100;
    const rec: ReplayRecord = {
      id,
      seed: gameState.initialSeed ?? gameState.rngSeed,
      actions: gameState.actionLog || [],
      score,
      floor: gameState.floor,
      date: new Date().toISOString(),
    };
    const next = [rec, ...list].slice(0, 100);
    setList(next);
    saveAll(next);
    setOpen(true);
  };

  const submitToLeaderboard = () => {
    const completed = gameState.completedRun;
    if (!completed || !completed.actionLog) return;

    // Verify replay locally by replaying actions from seed
    try {
      const seed = completed.seed ?? '';
      const init = generateInitialState(1, seed, seed);
      let s = init;
      for (const a of completed.actionLog) {
        s = gameReducer(s, a as Action);
      }
      // Use fingerprint equality for stricter verification
      const fingerprint = (st: GameState) => {
        const p = st.player;
        const enemies = st.enemies.map(e => ({ id: e.id, subtype: e.subtype, hp: e.hp, position: e.position }));
        const obj = { player: { id: p.id, subtype: p.subtype, hp: p.hp, maxHp: p.maxHp, position: p.position }, enemies, floor: st.floor, turn: st.turn, upgrades: st.upgrades };
        return JSON.stringify(obj);
      };

      const fpReplay = fingerprint(s);
      const fpCurrent = fingerprint(gameState);

      if (fpReplay === fpCurrent) {
        // store pending submission and open modal to ask for a name
        setPendingSubmission(completed);
        setNameInput('Player');
        setShowNameModal(true);
      } else {
        // show failure via modal
        setPendingSubmission(null);
        setNameInput('');
        setShowNameModal(true);
      }
    } catch (e) {
      console.error('Verification error', e);
      alert('Verification failed due to an error. See console.');
    }
  };

  const setRemoteEndpoint = () => {
    setEndpointInput(endpoint ?? '');
    setShowEndpointModal(true);
  };

  const submitToRemote = async () => {
    if (!endpoint) return alert('No remote endpoint configured.');
    const completed = gameState.completedRun;
    if (!completed) return alert('No completed run to submit.');
    try {
      // compute fingerprint the same way local verification does
      const fingerprint = (() => {
        const p = gameState.player;
        const enemies = gameState.enemies.map(e => ({ id: e.id, subtype: e.subtype, hp: e.hp, position: e.position }));
        const obj = { player: { id: p.id, subtype: p.subtype, hp: p.hp, maxHp: p.maxHp, position: p.position }, enemies, floor: gameState.floor, turn: gameState.turn, upgrades: gameState.upgrades };
        return JSON.stringify(obj);
      })();
      const payload = { seed: completed.seed, actions: completed.actionLog, score: completed.score, floor: completed.floor, fingerprint };
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        alert('Submitted to remote leaderboard successfully.');
      } else {
        alert(`Remote submit failed: ${res.status} ${res.statusText}`);
      }
    } catch (e) {
      console.error('Remote submit error', e);
      alert('Failed to submit to remote endpoint. See console.');
    }
  };

  const exportReplay = (r: ReplayRecord) => {
    const content = safeStringify(r);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replay-${r.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importReplayFile = async (file: File | null) => {
    if (!file) return;
    try {
      const txt = await file.text();
      let parsed: ReplayRecord;
      try {
        parsed = safeParse(txt) as ReplayRecord;
      } catch (e) {
        parsed = JSON.parse(txt) as ReplayRecord;
      }
      const next = [parsed, ...list].slice(0, 100);
      setList(next);
      saveAll(next);
    } catch (e) {
      console.error('Failed to import replay', e);
    }
  };

  const handleNameSubmit = (name: string) => {
    if (!pendingSubmission) {
      alert('No verified run to submit.');
      setShowNameModal(false);
      return;
    }
  const rng = createRng(`${pendingSubmission.seed}:${pendingSubmission.actionLog?.length ?? 0}`);
  const entry: LeaderboardEntry = { id: rng.id(9), name: name.slice(0, 20), score: pendingSubmission.score ?? 0, floor: pendingSubmission.floor ?? 0, date: new Date().toISOString(), seed: pendingSubmission.seed };
    const next = [entry, ...leaderboard].slice(0, 100) as LeaderboardEntry[];
    setLeaderboard(next);
    saveLeaderboard(next);
    setPendingSubmission(null);
    setShowNameModal(false);
    alert('Run submitted to local leaderboard');
  };

  const handleEndpointSubmit = (url: string) => {
    const u = url.trim();
    if (u) {
      localStorage.setItem('hop_leaderboard_endpoint', u);
      setEndpoint(u);
      setEndpointInput(u);
      setShowEndpointModal(false);
      alert('Endpoint saved.');
    } else {
      localStorage.removeItem('hop_leaderboard_endpoint');
      setEndpoint(null);
      setEndpointInput('');
      setShowEndpointModal(false);
      alert('Endpoint cleared.');
    }
  };

  const fetchRemoteLeaderboard = async () => {
    if (!endpoint) return alert('No remote endpoint configured.');
    try {
      const res = await fetch(`${endpoint.replace(/\/$/, '')}/leaderboard`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRemoteList(data.slice(0, 100));
      alert('Fetched remote leaderboard.');
    } catch (e) {
      console.error('Fetch remote leaderboard error', e);
      alert('Failed to fetch remote leaderboard. See console.');
    }
  };

  const remove = (id: string) => {
    const next = list.filter(l => l.id !== id);
    setList(next);
    saveAll(next);
  };

  // File import input ref handler
  const onFileSelected = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files && ev.target.files[0];
    importReplayFile(f ?? null);
    // reset input
    ev.currentTarget.value = '';
  };

  return (
    <div className="absolute top-4 right-4 z-20 text-white">
      <div className="flex gap-2">
        <button
          onClick={saveCurrent}
          className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded font-bold"
        >
          Save Run
        </button>
        <button
          onClick={() => setOpen(v => !v)}
          className="bg-gray-600 hover:bg-gray-700 px-3 py-2 rounded font-bold"
        >
          Replays ({list.length})
        </button>
      </div>

      {open && (
        <div className="mt-2 bg-black bg-opacity-80 p-3 rounded border border-gray-700 max-w-xs">
          {list.length === 0 && <div className="text-sm text-gray-400">No replays saved.</div>}
          <ul className="space-y-2 mt-2">
            {list.map(r => (
              <li key={r.id} className="flex items-center justify-between bg-gray-900 p-2 rounded">
                <div className="text-sm">
                  <div className="font-semibold">Score: {r.score} · Floor {r.floor}</div>
                  <div className="text-xs text-gray-400">{new Date(r.date).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <button className="bg-blue-600 px-2 py-1 rounded" onClick={() => onStartReplay(r)}>Play</button>
                  <button className="bg-yellow-600 px-2 py-1 rounded" onClick={() => onStepReplay?.(r)}>Step</button>
                  <button className="bg-gray-600 px-2 py-1 rounded" onClick={() => onStopReplay?.()}>Pause</button>
                  <button className="bg-indigo-600 px-2 py-1 rounded" onClick={() => exportReplay(r)}>Export</button>
                  <button className="bg-red-600 px-2 py-1 rounded" onClick={() => remove(r.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <label className="bg-gray-700 px-2 py-1 rounded cursor-pointer">
              Import
              <input type="file" accept="application/json" onChange={onFileSelected} className="hidden" />
            </label>
            <button className="bg-indigo-700 px-2 py-1 rounded" onClick={() => {
              // export all as single JSON
              const blob = new Blob([safeStringify(list)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `replays-all.json`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            }}>Export All</button>
            <button className="bg-yellow-700 px-2 py-1 rounded" onClick={() => submitToLeaderboard()}>Submit Run to Leaderboard</button>
            <button className="bg-blue-700 px-2 py-1 rounded" onClick={() => setRemoteEndpoint()}>Set Remote Endpoint</button>
            <button className="bg-emerald-700 px-2 py-1 rounded" onClick={() => submitToRemote()}>Submit Remote</button>
          </div>
        </div>
      )}
      {showNameModal && (
        <Modal title={pendingSubmission ? 'Submit verified run' : 'Verification'} onClose={() => { setShowNameModal(false); setPendingSubmission(null); }}>
          {pendingSubmission ? (
            <div>
              <div className="mb-2">Enter a name to show on the leaderboard (max 20 chars):</div>
              <input className="w-full p-2 mb-2 bg-gray-800 border border-gray-700 rounded" value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
              <div className="flex justify-end gap-2">
                <button className="bg-gray-700 px-3 py-1 rounded" onClick={() => { setShowNameModal(false); setPendingSubmission(null); }}>Cancel</button>
                <button className="bg-green-600 px-3 py-1 rounded" onClick={() => handleNameSubmit(nameInput)}>Submit</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-2">Replay verification failed. The run cannot be submitted.</div>
              <div className="text-right"><button className="bg-gray-700 px-3 py-1 rounded" onClick={() => setShowNameModal(false)}>Close</button></div>
            </div>
          )}
        </Modal>
      )}

      {showEndpointModal && (
        <Modal title="Remote leaderboard endpoint" onClose={() => setShowEndpointModal(false)}>
          <div>
            <div className="mb-2">Enter remote endpoint base URL (e.g. https://example.com)</div>
            <input className="w-full p-2 mb-2 bg-gray-800 border border-gray-700 rounded" value={endpointInput} onChange={(e) => setEndpointInput(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button className="bg-gray-700 px-3 py-1 rounded" onClick={() => setShowEndpointModal(false)}>Cancel</button>
              <button className="bg-green-600 px-3 py-1 rounded" onClick={() => handleEndpointSubmit(endpointInput)}>Save</button>
            </div>
          </div>
        </Modal>
      )}
      {/* Leaderboard panel */}
      <div className="absolute bottom-4 right-4 z-20 text-white max-w-xs">
        <div className="bg-black bg-opacity-80 p-3 rounded border border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <div className="font-bold">Leaderboard</div>
            <div className="text-sm text-gray-400">Top {leaderboard.length}</div>
          </div>
          {leaderboard.length === 0 && <div className="text-sm text-gray-400">No entries yet.</div>}
          <ol className="list-decimal pl-5 space-y-1">
            {leaderboard.slice(0, 20).map(e => (
              <li key={e.id} className="text-sm">
                <div className="font-semibold">{e.name} — {e.score} (F{e.floor})</div>
                <div className="text-xs text-gray-400">{new Date(e.date).toLocaleString()}</div>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex gap-2">
            <button className="bg-indigo-700 px-2 py-1 rounded" onClick={() => { navigator.clipboard?.writeText(JSON.stringify(leaderboard)); alert('Leaderboard copied to clipboard'); }}>Copy</button>
            <button className="bg-red-700 px-2 py-1 rounded" onClick={() => { if (confirm('Clear leaderboard?')) { setLeaderboard([]); saveLeaderboard([]); } }}>Clear</button>
            <button className="bg-blue-600 px-2 py-1 rounded" onClick={() => fetchRemoteLeaderboard()}>Fetch Remote</button>
          </div>
          {remoteList && (
            <div className="mt-2 bg-gray-800 p-2 rounded text-sm">
              <div className="font-semibold mb-1">Remote leaderboard</div>
              <ol className="list-decimal pl-5 space-y-1">
                {remoteList.slice(0, 10).map(e => (
                  <li key={e.id} className="text-sm">
                    <div className="font-semibold">{e.name} — {e.score} (F{e.floor})</div>
                    <div className="text-xs text-gray-400">{new Date(e.date).toLocaleString()}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReplayManager;
