Hop server
============

This folder contains a minimal Node.js server used to receive leaderboard submissions for Hop.

Overview
--------
- `index.js`: HTTP server that accepts POST /submit and GET /leaderboard.
- `replay-validator.js`: Pure replay validation + deterministic verification module used by the HTTP layer.
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
  - Accepts JSON payload: `{ replay: ReplayEnvelopeV3, client? }`.
  - Replay envelope version must be `3`.
  - The server replays actions with the shared engine and requires a strict fingerprint match against `replay.meta.final.fingerprint`.
  - Stored score/floor/fingerprint values are always server-computed.
- `GET /leaderboard`
  - Returns the list of accepted leaderboard entries.

Security & notes
----------------
- This is intentionally minimal. For production use you should add rate limiting, authentication, validation, and storage hardening.
- Keep `server/replay-validator.js` in sync with client-side game logic if you make changes to AI, RNG consumption, or combat rules.

*** End server README ***
