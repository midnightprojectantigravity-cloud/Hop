# Synapse Infolayer v1 (Full Spec)

## Summary
- Implement a full Synapse mode for combat runs that overlays a deterministic threat heatmap, shows enemy threat badges, supports inspect-only taps, and renders a fixed bottom data tray with tile/entity details.
- Replace subtype-based Danger Level with a unified, deterministic `UnitScore` formula that combines core stats, skills, and runtime state.
- Express enemy danger relative to the player as standard deviations (`z-score`), then use that value for both per-enemy UI and heatmap emission.
- Keep gameplay uncluttered by showing all Synapse visuals only while Synapse mode is active.

## Public API / Interface Changes
1. Engine `IntentPreview` contract (public type) will be extended with optional `synapse` data.
2. New engine types will be added and exported from `packages/engine/src/types.ts`:
- `SynapseThreatBand` (`safe | contested_low | contested_high | deadly`)
- `SynapseThreatTile`
- `SynapseThreatSource`
- `SynapseThreatPreview`
- `UnitThreatScoreBreakdown`
- `RelativeThreatScore`
3. `GameState.intentPreview` remains backward-compatible (`IntentPreview | undefined`) and now may include `intentPreview.synapse`.
4. Web internal component props will expand:
- `GameBoard` / `GameBoardSceneSvg` / `EntityLayer` / `Entity` gain Synapse props (`synapseMode`, selection handlers, threat lookup data).
- No server API changes.

## Core Scoring Model

## 1) Unit score (single formula)
Use one deterministic weighted formula for every actor (player, enemies, companions if needed):

`UnitScore = 0.45 * StatScore + 0.40 * SkillScore + 0.15 * StateScore`

### StatScore
`StatScore = 6*body + 6*mind + 5*instinct + 2*speed + 0.8*maxHp`

- `body/mind/instinct` from trinity component.
- `speed/maxHp` from actor.

### SkillScore
For each active non-passive skill:
- `BaseSkill = computeSkillNumericGrade(intentProfile).numericGrade`
- `Availability = 1 / (1 + currentCooldown)`
- `SkillContribution = BaseSkill * Availability * 0.20`

Then:
- `SkillScore = sum(top 3 SkillContribution values)`

### StateScore
`StateScore = 40*hpRatio + 3*temporaryArmor - 15*stunned - 10*blinded`

- `hpRatio = hp / maxHp` (clamped 0..1).
- status booleans are 1/0.

All scoring is pure and deterministic (no RNG).

## 2) Relative threat in standard deviations
For current board state:
- Compute `playerScore`.
- Compute `enemyScores` for all alive hostile enemies.
- `sigmaRef = max(stddev([playerScore, ...enemyScores]), 6)`.
- For each enemy: `z = (enemyScore - playerScore) / sigmaRef`.

Expose:
- `relativeSigma` (for example `+1.3`).
- `sigmaBand`:
  - `z <= -1.0`: `much_lower`
  - `-1.0 < z <= -0.25`: `lower`
  - `-0.25 < z < 0.25`: `parity`
  - `0.25 <= z < 1.25`: `higher`
  - `z >= 1.25`: `extreme`

This is the replacement for fixed Danger Level.

## 3) Heatmap emission from relative threat
Per enemy emitter weight:
- `EmitterWeight = clamp(z + 1, 0, 4)`

Per tile heat sum:
- `H_t = sum(EmitterWeight of all enemies covering tile t)`

Coverage uses existing action reach heuristic:
- `ActionReach = moveReach + maxSkillRange`
- `moveReach = max(1, actor.speed || 1)`
- `maxSkillRange` from active skills (excluding passive/no-op movement entries).

Band thresholds:
- `safe`: `H_t = 0`
- `contested_low`: `0 < H_t < 1.5`
- `contested_high`: `1.5 <= H_t < 3.0`
- `deadly`: `H_t >= 3.0`

## Implementation Plan

## 1) Engine: deterministic Synapse threat data generation
1. Add new module `packages/engine/src/systems/threat-scoring.ts`:
- `computeUnitThreatScore(actor)` returns score + breakdown.
- `computeRelativeThreatScores(state)` returns per-enemy `z` vs player and `sigmaRef`.
2. Add/adjust `packages/engine/src/systems/synapse-threat.ts`:
- `getActionReachForEnemy(actor)`.
- `buildSynapseThreatPreview(state)` that:
  - computes relative threat scores first,
  - emits tile heat from `EmitterWeight = clamp(z + 1, 0, 4)`,
  - stores per-tile `threatSum`, sorted `sourceActorIds`, and band,
  - stores per-source score breakdown and `relativeSigma`.
3. Extend `buildIntentPreview` in `packages/engine/src/systems/telegraph-projection.ts` to include:
- existing `dangerTiles` and `projections` unchanged,
- new `synapse` field from `buildSynapseThreatPreview`.
4. Ensure initial combat states also have Synapse data:
- in `generateInitialState` (`packages/engine/src/logic.ts`), compute and attach `intentPreview` once after queue/mask setup.
- in `hydrateLoadedState` (`packages/engine/src/logic-rules.ts`), regenerate missing `intentPreview.synapse` for older saves.
5. Keep determinism guarantees:
- no RNG consumption,
- stable sorting everywhere,
- no mutation side effects.

## 2) Web: Synapse mode state and input flow
1. Add App-level Synapse state in `apps/web/src/App.tsx`:
- `isSynapseMode` boolean, default `false`.
- `synapseSelection` union: `empty | tile(point) | entity(actorId)`.
2. Update interaction behavior:
- if Synapse is active, tile taps are inspect-only (no move/skill dispatch).
- add enemy tap inspect callback path (board entity click) for Entity Mode.
- selecting any skill auto-exits Synapse mode immediately.
3. Add keyboard support:
- `KeyI` toggles Synapse.
- `Escape` exits Synapse if active.
4. Keep normal turn lock semantics:
- Synapse does not bypass existing post-commit/input-lock logic.

## 3) Web: board rendering layers and visuals
1. Add a new `SynapseHeatmapLayer` in `apps/web/src/components/game-board/`:
- rendered when `isSynapseMode=true`.
- applies map dimming plus per-hex band colors from `H_t`.
2. Add Synapse thread line overlay:
- draw a thin glowing line from selected tile/enemy hex to board-bottom anchor zone in SVG space.
3. Add enemy threat badges based on `relativeSigma`:
- `z < -0.25`: faint pulse.
- `-0.25 <= z < 0.75`: steady ring.
- `0.75 <= z < 1.25`: thick ring.
- `z >= 1.25`: jitter/heat-distortion class.
- render only in Synapse mode.

## 4) Web: fixed Bottom Data Anchor tray
1. Add a new tray component (board-bottom, mobile + desktop) rendered in gameplay viewport:
- `Empty`: "Select a tile or enemy for details."
- `Tile Mode`: `threatSum`, source count, source enemy list (tap source to switch to Entity Mode).
- `Entity Mode`: name/HP/intent, `unitScore`, and `relativeSigma`.
2. Apply intel policy (hybrid gating):
- heatmap and source counts always visible.
- entity detail fields (`name`, `hp`, `intent`) use existing `getUiActorInformation` reveal gating.
- `unitScore` and `relativeSigma` remain visible in Synapse.
3. Add a visible Synapse toggle button in mobile and desktop combat UI (plus hotkey).

## 5) Web: entity click plumbing
1. Make enemy nodes clickable only when Synapse mode is active:
- add optional click handlers through `EntityLayer -> Entity -> EntityRenderShell`.
- maintain `pointerEvents: none` outside Synapse to preserve current behavior.
2. Update entity memo comparator/types so Synapse props correctly trigger re-render when needed.

## Test Cases and Scenarios

## Engine tests
1. Add `packages/engine/src/__tests__/synapse_threat_preview.test.ts`:
- deterministic output for identical state.
- `UnitScore` coefficient math correctness.
- z-score correctness vs player (`relativeSigma`) with sigma floor behavior.
- tile heat aggregation correctness (`H_t`).
- stable sorted `tiles`, `sources`, and `sourceActorIds`.
2. Extend telegraph preview coverage (`telegraph_projection` scenario or adjacent unit test):
- assert `state.intentPreview.synapse` exists and is coherent after turn processing.
3. Add initial-state assertion:
- generated combat state has populated `intentPreview.synapse`.

## Web tests
1. Add Synapse view-model helper tests:
- tile selection resolves correct source list and sums.
- entity selection resolves intel-gated fields + visible `unitScore`/`relativeSigma`.
2. Add enemy badge render tests:
- z-score tier -> expected class/ring behavior.
3. Add mode interaction tests:
- Synapse on => tile tap does not dispatch move/skill.
- skill select while Synapse on => Synapse exits.
- keyboard `KeyI` and `Escape` handling.
4. Keep existing preview/overlay tests passing (no regression in non-Synapse mode).

## Acceptance Criteria
1. Player can toggle Synapse via UI and `I` key during combat runs.
2. Synapse displays heatmap from standardized relative threat (`H_t`) with deterministic bands.
3. Tile tap in Synapse opens Tile Mode tray with deterministic source list and summed heat.
4. Enemy tap in Synapse opens Entity Mode tray with gated intel fields and visible `unitScore` + `relativeSigma`.
5. No gameplay action executes while Synapse mode is active.
6. Selecting a skill auto-exits Synapse.
7. Synapse visuals (heatmap, badges, thread) are hidden when Synapse is off.
8. Engine outputs remain deterministic and tests pass.

## Assumptions and Defaults Chosen
- Scope: full v1 in one pass.
- Availability: all combat runs (`gameStatus === playing`), not Arcade-only.
- Threat model: unified `UnitScore` formula + z-score relative to player.
- Sigma floor: `sigmaRef >= 6` for stability.
- Heatmap band thresholds: `1.5` and `3.0` on `H_t`.
- Visuals: Synapse-only (not persistent outside mode).
- Tray placement: fixed board-bottom on both mobile and desktop.
- Intel policy: hybrid (map-level visibility always; entity detail fields gated).
- Skill interaction: selecting a skill auto-exits Synapse mode.
- Wall cells are not highlighted in heatmap to reduce clutter and focus on playable space.
