# Tactical Core Migration Notes (PR: Foundation Refactor)

## New Engine Data Contracts

- Unit schema: `packages/engine/src/data/schemas/base-unit.schema.json`
- Composite skill schema: `packages/engine/src/data/schemas/composite-skill.schema.json`
- Parser/validator: `packages/engine/src/data/contract-parser.ts`
- Types: `packages/engine/src/data/contracts.ts`

## New Runtime Systems

- Deterministic unit instantiation:
  - `packages/engine/src/systems/propensity-instantiation.ts`
- LIFO stack resolver:
  - `packages/engine/src/systems/resolution-stack.ts`
- Force physics (push/pull + collision/crush):
  - `packages/engine/src/systems/force.ts`
- Composite skill factory:
  - `packages/engine/src/systems/composite-skill-factory.ts`
- Legacy/data bridge registry:
  - `packages/engine/src/systems/composite-skill-bridge.ts`
- Action preview (dry run):
  - `packages/engine/src/systems/action-preview.ts`
- State mirror validation:
  - `packages/engine/src/systems/state-mirror.ts`
  - `packages/engine/scripts/validateStateMirror.ts`

## Event Sync

- Canonical simulation events now emitted by effect resolution:
  - `UnitMoved`
  - `DamageTaken`
  - `Healed`
  - `StatusApplied`
  - `MessageLogged`
- State field: `GameState.simulationEvents`.
- Web listener hook added in:
  - `apps/web/src/components/GameBoard.tsx` (`onSimulationEvents` prop).

## UI Preview Hook Point

- `PreviewOverlay` now accepts engine-provided ghost preview:
  - `enginePreviewGhost` prop.
- `GameBoard` forwards this via:
  - `enginePreviewGhost` prop.

## Backward Compatibility

- Legacy `SkillRegistry` path remains active.
- Data-driven skills can be registered at runtime through:
  - `registerCompositeSkillDefinition(...)`
- Unified lookup now resolves both legacy and registered data-driven skills.

## Validation Additions

New tests:
- `packages/engine/src/__tests__/data_contract_parser.test.ts`
- `packages/engine/src/__tests__/propensity_instantiation.test.ts`
- `packages/engine/src/__tests__/resolution_stack.test.ts`
- `packages/engine/src/__tests__/force.test.ts`
- `packages/engine/src/__tests__/composite_skill_factory.test.ts`
- `packages/engine/src/__tests__/composite_skill_bridge.test.ts`
- `packages/engine/src/__tests__/simulation_events.test.ts`
- `packages/engine/src/__tests__/action_preview.test.ts`
- `packages/engine/src/__tests__/state_mirror.test.ts`

