Hop server
============

This folder contains a minimal Node.js server used to receive leaderboard submissions for Hop.

Overview
--------
- `index.js`: HTTP server that accepts POST /submit and GET /leaderboard.
- `verifier.js`: A small, independent replay verifier that replays actions deterministically and computes a fingerprint.
- `leaderboard.json`: persisted list of accepted entries (created automatically).

Running the server
------------------
From the repository root run:

```powershell
npm run start-server
```

The server listens on `http://localhost:4000` by default (see `server/index.js`).

Endpoints
---------
- `POST /submit`
  - Accepts JSON payload: `{ seed, actions, score, floor, fingerprint?, client? }`.
  - The server replays the actions using `verifier.js` and compares the computed fingerprint to the provided `fingerprint`. If they match the submission is accepted and stored in `leaderboard.json`.
  - If no `fingerprint` is provided, the server falls back to a simple sanity check (score/floor match).
- `GET /leaderboard`
  - Returns the list of accepted leaderboard entries.

Security & notes
----------------
- This is intentionally minimal. For production use you should add rate limiting, authentication, validation, and storage hardening.
- Keep `server/verifier.js` in sync with client-side game logic if you make changes to AI, RNG consumption, or combat rules.

*** End server README ***
