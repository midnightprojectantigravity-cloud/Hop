# Codebase Status

As of March 27, 2026

## Current Law

Hop now runs on a live-only runtime posture.

- ACAE is part of the shipped runtime and no longer gated by runtime flags.
- Shared-vector carry is the only live attachment movement behavior.
- Loadout passive capability content is always applied when the loadout defines it.
- Movement runtime capability policy is always authoritative.
- Rollout query params, env defaults, and retired ruleset override branches for those systems are no longer part of the supported runtime contract.

The canonical engine ruleset surface is limited to:

- `ruleset.combat`
- `ruleset.ires`

Legacy saved payloads or replay/bootstrap inputs may still contain retired rollout-era ruleset branches. Hydration tolerates those keys and normalizes them away before live state continues.

## Runtime Architecture

### Engine

- `packages/engine` remains the deterministic source of truth.
- Intent is validated before execution.
- Execution emits `AtomicEffect[]` only.
- Movement resolves through tile hooks and the tile runtime.
- `state.tiles` plus `UnifiedTileService` remain the tile source of truth.

### Combat and IRES

- Combat runs only on `trinity_ratio_v2`.
- Trinity content ships as `core-v2-live`.
- IRES is fully integrated and drives live Spark, Mana, and exhaustion behavior.

### AI

The shared AI stack is now built around two live doctrines:

- universal behavior overlays
  - one aggressive default actor model
  - tactical identity derived from loadout, skills, ready skills, and temporary overlays
- shared Spark doctrine
  - rested-aware, weighted action taxes and bonuses
  - shared across players, enemies, companions, and summons
  - intended to pace around rested/stable bands instead of crash-then-stall behavior

Runtime and evaluation both use the same shared generic AI core.

## Web Status

- `apps/web` is presentation and orchestration only.
- Hub start flow keeps map size and map shape controls.
- Retired rollout controls for capability passives and movement runtime have been removed.
- The ruleset status surface no longer exposes rollout-era always-on rows.

## Validation Commands

Core closeout commands:

```powershell
npm run build
npm --workspace @hop/engine run test:full
npm --workspace @hop/web run test:run
npm run engine:fast
npm run upa:quick:ai
```

Additional engine gates used during deeper validation:

```powershell
npm --workspace @hop/engine run test:ai-acceptance:strict
npm --workspace @hop/engine run test:acae:strict
npm --workspace @hop/engine run check-script-imports
```

Evaluation and review commands:

```powershell
npm run upa:quick:ai
npx tsx packages/engine/scripts/runUpaOutlierAnalysis.ts
npx tsx packages/engine/scripts/runUpaCalibration.ts 300 80 heuristic artifacts/upa/UPA_CALIBRATION_BASELINE.json
```

## Current Risk Posture

- The rollout-era flag surface is retired; the repo should now be maintained against one live runtime path.
- Legacy payload compatibility is load-time only; new runtime state and generated payloads must not re-emit retired branches.
- The shared AI architecture is live, but tuning remains active, especially around Spark pacing and visible-hostile pressure.
- `docs/archive/` remains historical reference only. Current runtime law belongs here and in the code.

## Documentation Topology

- Current runtime reference: `docs/STATUS.md`
- Architecture overview: `docs/MASTER_TECH_STACK.md`
- Guardrails and merge law: `docs/GOLD_STANDARD_MANIFESTO.md`
- Historical tracker snapshot: `docs/NEXT_LEVEL.md`
- Historical milestone material: `docs/archive/`
