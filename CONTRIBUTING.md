# Contributing to Hop

Thanks for wanting to contribute! This document explains the repository layout, how to run and test locally, and important notes about determinism and the server verifier.

Quickstart (dev)

1. Install dependencies

```powershell
npm install
```

2. Run dev server

```powershell
npm run dev
```

3. Run tests and lint

```powershell
npm run lint
npm test
```

Repository structure
- `src/` — TypeScript React app and game logic.
- `server/` — Minimal Node server and verifier for leaderboard submissions.
- `examples/` — Example replays and helper artifacts.

Code style and tests
- Follow existing TypeScript and ESLint rules. Run `npm run lint` before opening PRs.
- Tests use Vitest — add tests under `src/__tests__`.

Determinism and verifier notes
- This project relies on deterministic RNG and deterministic AI tie-breakers. If you change any logic that affects determinism (RNG consumption, AI tie-breakers, combat rules), you must update `server/verifier.js` accordingly so server-side verification remains correct.
- Important files to keep in sync:
  - `src/game/rng.ts`
  - `src/game/enemyAI.ts`
  - `src/game/logic.ts`
  - `server/verifier.js`

Submitting changes
- Open a branch, make small focused commits, include tests for new behavior, run lint/tests locally.
- Include a short description and the reasoning for any determinism-related changes (how RNG seeds / counters are affected).

Adding example replays
- Use the in-app Replay Manager to save a run, then export it. Place exported JSON into `examples/` for sharable samples.

Security and server
- `server/index.js` is intentionally minimal. For production use add rate-limiting, authentication, and persistent storage.

Thanks again! If you want help writing tests or preparing a PR, ping on the issue or open a draft PR.
