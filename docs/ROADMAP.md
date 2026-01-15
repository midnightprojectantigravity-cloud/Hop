# Prioritized Roadmap (10 concise steps)

1. Wire dedicated Hub screen into App.tsx (render Hub on hub state).
* Status: Done — `Hub.tsx` added and App renders hub state.
* Files: App.tsx, [apps/web/src/components/Hub.tsx].

2. Export engine scoring function; reconcile UI scoreboard to use it.
* Status: Done — `computeScore` implemented and UI switched to use engine canonical score.
* Files: logic.ts, UI.tsx, score.ts.

3. Add ActionLog JSON export/import and Export button in ReplayManager.
* Status: Done — safe serializer added and `ReplayManager` uses it for Export/Import.
* Files: ReplayManager.tsx, serialize.ts.

4. Capture and persist turnStart neighbor IDs in initiative queue to support AUTO_ATTACK.
* Status: Done — `turnStartNeighborIds` captured at turn start and auto-attack now consumes identity IDs.
* Files: initiative.ts, auto_attack.ts.

5. Add scenario tests for multi-system combos (grapple→lava, shield throw→push→lava).
* Status: Partially done — scenarios exist and an integration test was added; some scenario failures surfaced and are tracked separately.
* Files: packages/engine/src/skills/* (scenarios), src/__tests__/grapple_lava.test.ts.

6. Migrate remaining legacy skills into compositional skill definitions.
* Status: Deferred — skipping for now per direction. Target later in phase 2.
* Files: packages/engine/src/skills/*.ts

7. Fix Jump cooldown initialization and verify loadout skill cooldowns.
* Files: skills.ts, loadout.ts.

8. Implement Hub “Start Run” UX polish and selected-loadout highlight.
* Files: [apps/web/src/components/Hub.tsx], ArchetypeSelector.tsx.

9. Build server-side validator CLI to re-run ActionLog + seed in Node (no browser APIs).
* Status: Done — added `validateReplay` CLI and updated server to accept safe-serialized payloads.
* Files: packages/engine/scripts/validateReplay.ts, apps/server/index.js.

11. Add RNG parity & tooling
* Status: Done — parity checker CLI added to help verify PRNG across environments.
* Files: packages/engine/scripts/checkRngParity.js

10. Polish visual UX (movement bloom, threat ring, skill range overlays).
* Files: GameBoard.tsx, SkillTray.tsx.

# Quick Wins (single-PR, 30–120 minutes)

1. Hub wiring: render Hub on hub state (small App.tsx change).
* Files: App.tsx.
* Est: ~30–60 minutes.

2. Add Start Run button visibility & highlight selection (UI only).
* Files: ArchetypeSelector.tsx, App.tsx.
* Est: ~30–60 minutes.

3. Add JSON Export button to ReplayManager.
* Status: Done — now uses engine `safeStringify` to preserve BigInt and non-JSON types.
* Files: ReplayManager.tsx.

# Risky / Complex items (estimates)

1. Full migration to compositional skills (remove skills.ts legacy): touching many files and tests.
* Files: [packages/engine/src/skills.ts], [packages/engine/src/skillRegistry.ts], per-skill files.
* Est: 3–7 days.

2. Server-side validator + CI parity: BigInt/PRNG serialization and environment parity fixes.
* Status: In progress — server accepts safe-serialized payloads; parity tooling added.
* Files: packages/engine/scripts/checkRngParity.js, apps/server/index.js.
* Est: 2–5 days.

3. Multi-system integration coverage & fuzzing enlargement: design tests, fix failures, stabilize determinism.
* Files: new tests under [packages/engine/src/tests/], extend [packages/engine/scripts/fuzzTest.ts].
* Est: 2–4 days.

# Core Refactoring

1. Extract ECS core: create packages/engine/src/ecs/* (Entity, Component, System) and migrate actor data into components; update types.ts, actor.ts, initiative.ts, logic.ts.
* Files: types.ts, actor.ts, initiative.ts, logic.ts

2. Centralize geometry/math: move lowLevelLerp, roundToHex, path helpers into hex.ts and remove duplicates from skill files (e.g., grapple_hook.ts).
* Files: hex.ts, grapple_hook.ts

3. Finish compositional skills migration: convert legacy skills.ts behaviors into COMPOSITIONAL_SKILLS, add getValidTargets() to each SkillDefinition, then delete skills.ts.
* Files: skills.ts, skillRegistry.ts, packages/engine/src/skills/

4. Harden engine API & contracts: expose computeScore(state), exportActionLog(state), getValidTargets(skillId,state,actor) in [packages/engine/src/index.ts], and use these from UI/validator.
* Files: index.ts, UI.tsx

5. Optimize spatial & RNG subsystems: profile and refactor refreshOccupancyMask for minimal BigInt ops; centralize RNG serialization (rngCounter/seed) for Node validator parity.
* Files: spatial.ts, rng.ts

6. Add integration harness & CI gates: add deterministic integration tests (multi-system scenarios) and a Node CLI validator that replays ActionLog + initialSeed. Gate merges on determinism tests.
* Status: In progress — validator CLI and test harness exist; remaining work: stabilize failing scenarios and add CI jobs.
* Files: packages/engine/scripts, packages/engine/src/__tests__/

# Further Considerations

1. Expose small engine contracts: computeScore(state), getValidTargets(skillId, state, actor), and exportActionLog(state) in [packages/engine/src/index.ts] so UI and server share canonical logic.
2. Keep Hub decoupled (headless engine only used to generate state); UI should be a thin client that calls engine helpers.
3. Phase migration: implement compatibility adapters (small wrappers) so engine exposes stable interfaces while internals migrate; use feature flags per module.
4. TDD-first: write scenario tests for each changed behavior (e.g., AUTO_ATTACK identity capture, Grapple→Lava) before changing logic.
5. Performance verification: add microbenchmarks for occupancy updates and RNG consumption; measure before/after BigInt optimizations.

- invalid target should not consume a turn, just show a toast - DONE
- grapple hook and shield throw should have an axial range, no zig zag targeting - DONE
- valid targets should be highlighted in the preview overlay (red border)
- potential skill range for targets should be highlighted in the preview overlay (white border)
- targets that are blocked by LOS should not be valid targets