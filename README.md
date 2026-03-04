# Hop Monorepo

Deterministic tactical roguelike architecture split across engine, web client, and validation server.

## Workspace Layout
- `packages/engine`: deterministic headless referee/runtime
- `apps/web`: React client (rendering/input/orchestration)
- `apps/server`: leaderboard and replay validation service

## Quick Start
```powershell
npm install
npm run dev
```

## Core Commands
```powershell
# build all workspaces
npm run build

# run workspace tests
npm test

# run validator server
npm run validator
```

## Replay V3
- Canonical replay contract is `ReplayEnvelopeV3`.
- Web replay storage keys:
  - `hop_replays_v3`
  - `hop_leaderboard_v3`
- Server `/submit` accepts:
  - `{ replay: ReplayEnvelopeV3, client?: object }`
- Server verifies replay by deterministic re-simulation and requires strict fingerprint match.

## Web UI Productization (Great Refactor)
- Default visual system is parchment-first (`light`) with secondary medieval-apocalypse (`dark`) theme.
- UI preferences contract:
  - `UiPreferencesV1 = { colorMode, motionMode, hudDensity, mobileLayout }`
- Web UI storage keys:
  - `hop_ui_prefs_v1`
  - `hop_ui_theme_v1`
  - `hop_last_run_context_v1`
- Defeat loop primary actions:
  - `Quick Restart`
  - `View Replay`
- Reference:
  - `docs/UI_UX_GREAT_REFACTOR_WRAPUP_2026-03-03.md`

## Engine Quality Gates
```powershell
# scenario integration suite
npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts --silent

# replay + turn-stack guards
npx vitest run packages/engine/src/__tests__/replay_validation.test.ts packages/engine/src/__tests__/turn_stack_guards.test.ts packages/engine/src/__tests__/timeline_sequence.test.ts --silent

# runtime benchmark baseline and candidate gate
npm --workspace @hop/engine run bench:runtime:baseline
npm --workspace @hop/engine run bench:runtime:candidate
```

## Architecture References
- [Master Tech Stack](./docs/MASTER_TECH_STACK.md)
- [Gold Standard Manifesto](./docs/GOLD_STANDARD_MANIFESTO.md)
- [Status](./docs/STATUS.md)
- [Turn Stack Contract](./docs/TURN_STACK_CONTRACT.md)
- [UI/UX Great Refactor Wrap-Up](./docs/UI_UX_GREAT_REFACTOR_WRAPUP_2026-03-03.md)
