# Inferno World Compiler Wrap-Up - March 12, 2026

Historical note:
- This is a milestone wrap-up, not current operational guidance.
- Current release-gate and Trinity/IRES runtime guidance lives in `docs/STATUS.md`, `docs/UPA_GUIDE.md`, and `docs/archive/TRINITY_V2_INTEGRATION_SIGNOFF.md`.

## Summary

The inferno-only world compiler vertical slice is now implemented and hardened across engine and web:

1. Deterministic compiler pipeline under `packages/engine/src/generation/`
2. Artifact-only worker transport for web worldgen
3. Authored inferno floor families for special floors
4. Replay-safe `recentOutcomeQueue` and stateless `directorEntropyKey`
5. Tactical + visual path networks generated as part of world compilation
6. Dev-only worldgen inspection overlays and golden-seed regression coverage

Current default ownership note:
- the compiler now resolves its shipped default through a neutral `DEFAULT_WORLDGEN_SPEC` surface rather than importing inferno content directly at every callsite
- current content scope is still inferno-first, so the default spec presently resolves to inferno-authored families and inferno procedural fill

## Delivered Outcomes

### Engine

1. `CompiledFloorArtifact` is the worldgen transport contract; full `GameState` no longer crosses the worker boundary.
2. `WorldCompilerSession` executes real staged passes with parity-safe, integer-only worldgen logic.
3. Inferno module registry and authored families are active for floors `5`, `8`, and `10`.
4. `GeneratedPathNetwork` is now part of compiled output:
   - `tacticalPath`: walkable network connecting start, exit, and reachable landmarks
   - `visualPath`: player-facing main-route subset
5. Landmark classification now supports `onPath` ownership for:
   - entry
   - exit
   - shrine
   - module slots
   - logic/narrative anchors
6. Path verification is fail-gated:
   - start/exit must connect
   - main-route landmarks must be on the visual route
   - off-path landmarks must still be reachable
   - route tiles must remain statically walkable

### Web

1. Web start-run and stairs transitions are worker-canonical.
2. Worker requests are built from sanitized compile contexts only.
3. `RoutePathLayer` renders the player-facing visual route with programmatic SVG only.
4. Debug overlays expose:
   - module footprints
   - claims
   - path segments
   - main vs hidden landmarks
   - verification conflicts

## Pathing Model

### Tactical path

- Built after final tile realization and gasket closure
- Uses final static walkability only
- Connects:
  - start
  - exit
  - all `onPath` landmarks on the main route
  - all off-path landmarks through deterministic spurs

### Visual path

- Strict player-facing subset of the tactical network
- Shows only the main route
- Hidden/off-path spurs remain absent from the normal board layer
- Fog-aware rendering:
  - unexplored: hidden
  - explored: dim
  - visible: bright

## Validation Commands

Engine:

```bash
npm --workspace @hop/engine run build
npm --workspace @hop/engine run test:worldgen
npx vitest run packages/engine/src/__tests__/upa.test.ts
```

Web:

```bash
npm --workspace @hop/web run build
npx vitest run \
  apps/web/src/__tests__/route_path_layer.test.tsx \
  apps/web/src/__tests__/worldgen_worker_transport.test.ts \
  apps/web/src/__tests__/worldgen_worker_parity.test.ts \
  apps/web/src/__tests__/worldgen_persistence.test.ts
```

## Current Wrap-Up State

The inferno worldgen refactor is in a valid wrap-up state.
Additional close-out validation completed after the main wrap-up pass:

1. `packages/engine/src/__tests__/scenarios_runner.test.ts` is green again after restoring scenario visibility refresh and awareness-dependent enemy fixtures.
2. `npm run mvp:replay:gate` passes with matching fingerprints.
3. `artifacts/upa/UPA_SKILL_HEALTH.json` regenerated cleanly under the historical health gate of the time; current equivalent release check is `npm run upa:health:release`.

Remaining work is optional follow-on work, not completion-critical:

1. Add a second biome only after inferno content density is high enough.
2. Expand authored floor families beyond the special-floor slice.
3. Promote path visuals from programmatic overlays to bespoke authored art only if needed.
4. Run heavier UPA report scripts only when balance/content changes justify regenerating those artifacts.

