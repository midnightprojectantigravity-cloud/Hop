# Contributing to Hop

Thanks for wanting to contribute! This document explains the repository layout, how to run and test locally, and important notes about determinism and the server verifier.

## Quickstart (Dev)

1. **Install dependencies**
   ```powershell
   npm install
   ```

2. **Run dev server (Web Arcade)**
   ```powershell
   npm run dev
   ```

3. **Run tests**
   ```powershell
   npm test
   ```

## Repository Structure (Monorepo)

- **`packages/engine`** — The "Refree". Pure, headless TypeScript game logic.
- **`packages/shared`** — Common type definitions and constants.
- **`apps/web-arcade`** — The "Juice". React/PixiJS frontend client.
- **`apps/server`** — Node.js back-end for session validation and leaderboards.

## Code Style and Tests

- **Determinism is Priority #1**: Any changes to `packages/engine` must maintain bit-for-bit parity across environments (Browser vs Node).
- **Scenario-Driven Testing**: Add new mechanic tests to `packages/engine/src/scenarios/`.
- **Linting**: Follow existing ESLint rules. Run `npm run lint` before opening PRs.

## Determinism and Validation

- This project relies on deterministic RNG (Mulberry32) and deterministic AI.
- If you change engine logic, ensure the `ActionLog` replay still produces identical results.
- Use the `validateReplay` script in `packages/engine/scripts/` to verify determinism in Node.

## Submitting Changes

- Open a branch for focused changes.
- Include a scenario test for any new feature or bug fix.
- Verify that `npm test` passes in the root directory.

## The Golden Rules of the Grid

To prevent "Split-Brain" state bugs, all contributors must follow these rules:

1. **Single Source of Truth**: The `state.tiles` Map is the ONLY source of truth for the world. 
   - ❌ NEVER create standalone arrays like `lavaPositions` or `wallPositions`.
   - ✅ ALWAYS use `setTile()` to modify the world and `state.tiles.get(key)` to read it.
2. **Unified Keying**: NEVER manually stringify coordinates.
   - ❌ `const key = "${q},${r}"` 
   - ✅ `const key = HexCoord.toKey(q, r)`
3. **The Movement Hook**: Any logic that moves an entity (Skills, Pushes, etc.) MUST call `resolveEnvironment(entity)`. 
   - If you skip this, environmental effects like "Lava Sinking" will fail to trigger.