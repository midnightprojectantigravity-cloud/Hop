# Capability Rollout Notes

This project ships capability rollout in compatibility-first mode.

## Completion Snapshot (March 2, 2026)

- Phase completion (engine + web bridge + movement passive content): `a4e47b4`
- Non-prod default posture commit (development on, production off): `0083563`
- Validation passed at completion:
  - `npx vitest run packages/engine/src/__tests__`
  - `npx vitest run apps/web/src`
  - `npx tsc -p packages/engine/tsconfig.json --noEmit`
  - `npx tsc -p apps/web/tsconfig.json --noEmit`
- Parity/fallback gates passed with production-safe defaults off.

## Default Posture

- `loadoutPassivesEnabled = false`
- `movementRuntimeEnabled = false`
- UI intel mode default remains `force_reveal`

With defaults off, baseline behavior should match pre-capability rollout parity.

## How To Enable Capability Rollout

### 1) Hub Toggles (Web)

From the Hub screen:

- `Capability Passives` toggle controls `ruleset.capabilities.loadoutPassivesEnabled`
- `Movement Runtime` toggle controls `ruleset.capabilities.movementRuntimeEnabled`

These values are bridged into `START_RUN.rulesetOverrides`.

### 2) URL Query Overrides (Web)

Supported URL params:

- `cap_passives`
- `movement_runtime`

Accepted values:

- truthy: `on`, `1`, `true`, `enabled`
- falsy: `off`, `0`, `false`, `disabled`

Example:

```text
?cap_passives=on&movement_runtime=on
```

### 3) Web Environment Defaults

- `VITE_CAPABILITY_PASSIVES_DEFAULT`
- `VITE_MOVEMENT_RUNTIME_DEFAULT`

Same accepted values as URL params.
URL overrides env when both are present.

Current repo defaults by mode:

- `apps/web/.env.development`: capability passives `on`, movement runtime `on` (non-prod canary posture)
- `apps/web/.env.production`: capability passives `off`, movement runtime `off` (production safety posture)

### 4) Engine Runtime Environment Defaults

- `HOP_CAP_LOADOUT_PASSIVES=1`
- `HOP_CAP_MOVEMENT_RUNTIME=1`

These are fallback defaults. Explicit run overrides win.

### 5) Deterministic Run Overrides (Engine)

`START_RUN` accepts:

```ts
rulesetOverrides: {
  capabilities: {
    loadoutPassivesEnabled: boolean,
    movementRuntimeEnabled: boolean
  }
}
```

## Parity Expectations

- With both toggles off, deterministic traces and AI parity corpus should remain stable.
- With capability toggles on, behavior changes are expected only where capability providers are present.
- Movement capability runtime only affects self-mobility skill policy paths; forced displacement systems are out of scope.

## Backlog Tracking

Future promotion items are tracked in `docs/NEXT_LEVEL.md` under deferred backlog item `D4: Capability Rollout Promotion (Engine + Web)`.
