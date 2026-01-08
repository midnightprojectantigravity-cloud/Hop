# Hop — deterministic arcade roguelike (React + TypeScript + Vite)

This repository contains Hop, a small deterministic, replayable arcade-style game built with React + TypeScript and Vite.

Key features
- Deterministic pseudo-random number generator (seeded) so runs can be replayed exactly.
- Action-log based replays: each run stores the initial seed and the sequence of player actions.
- Local replay manager: save / load / export / import replays, play/pause/step replays.
- Leaderboard support with client-side verification and optional remote submission; the server replays actions to verify submissions.

Contents
- `src/`: React app and game logic (deterministic RNG, AI, combat, replay manager).
- `server/`: Minimal Node server providing a leaderboard receiver and a small verifier.

Getting started (dev)

Open a terminal (PowerShell on Windows) in the repository root and run:

```powershell
npm install
npm run dev
```

This starts the Vite dev server. Visit http://localhost:5173 (or the URL shown in the terminal).

Build (production)

```powershell
npm run build
npm run preview
```

Run tests and lint

```powershell
npm run lint
npm test
```

Replay & determinism notes
- `GameState` stores `rngSeed`, `initialSeed`, and `rngCounter`. All randomness used for game decisions and id generation is derived from these values.
- To reproduce a run exactly: call `generateInitialState(seed)` then sequentially dispatch the saved `actionLog`. The client and server use identical deterministic rules for RNG and AI tie-breaks.
- The Replay Manager (top-right in the UI) lets you Save runs to localStorage, Export/Import replay files (.json), and Play/Step recorded runs.

Leaderboard & server
- The app can submit verified runs to a remote server. By default this app includes a minimal Node receiver in `server/index.js`.
- Start the server (in a separate terminal):

```powershell
npm run start-server
# server listens on http://localhost:4000 by default
```

- Endpoints:
  - `POST /submit` — accepts `{ seed, actions, score, floor, fingerprint }` and verifies the replay server-side before adding to the server leaderboard.
  - `GET /leaderboard` — returns the list of accepted submissions.

Server-side verification
- The server runs a minimal verifier (`server/verifier.js`) that replays the submitted actions with the same deterministic RNG and AI logic used in the client and computes a fingerprint. Submissions are accepted only when the server reproduces the final fingerprint (or when a simple score/floor sanity check passes if no fingerprint was provided).

Contributing / notes for maintainers
- If you change game rules (AI, combat, RNG consumption), update `server/verifier.js` to keep server verification in sync, or move shared verification logic into a common module consumed by both client and server.
- Important files for determinism:
  - `src/game/rng.ts` — deterministic RNG helpers (`createRng`, `consumeRandom`, `nextIdFromState`)
  - `src/game/logic.ts` — state generation and reducer
  - `src/game/enemyAI.ts` — enemy deterministic AI
  - `src/components/ReplayManager.tsx` — UI for saving/loading and submitting replays

If you want me to generate a short development README for the server or add CI config for lint/tests, say which you'd prefer and I'll add it.
## Architectural "Gold Standard" Tech Stack
This project is built using a world-class architecture designed for scale and performance:

- **Logic: Immutable State + Command Pattern**
  - All actions generate a `Command` and `StateDelta`.
  - Enables **Infinite Undo** and microscopic replay files.
- **Validation: TDD for Scenarios + Fuzzing**
  - Integrated tactical scenarios verify skill logic automatically.
  - Behavioral fuzzing script finds edge cases by simulating thousands of random turns.
- **Performance: Spatial Hashing / Bitmasks**
  - BigInt bitmasks provide constant-time occupancy checks for AI simulations.
- **Meta: Strategic Hub & Serialized Loadouts**
  - Character configurations are fully serializable JSON objects.

For a deep dive into the technical details, see [ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

## Detailed Documentation
- [Status Document](./docs/STATUS.md) — Current feature completion and roadmap.
- [Architecture Guide](./docs/ARCHITECTURE.md) — Technical deep-dive into the engine design.
- [Game Mechanics](./docs/GAME_MECHANICS.md) — Rules, skills, and unit archetypes.

## Contributing / notes for maintainers
- **Strict Immutability:** Never mutate `GameState` fields directly.
- **Skill Migration:** All new skills should be implemented in `src/game/skills/` using the `SkillDefinition` interface.
- **Testing:** Always run `npm test` and `src/scripts/fuzzTest.ts` after major architectural changes.

