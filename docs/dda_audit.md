# Data-Driven Architecture (DDA) Audit Report

> **Scope:** Full engine codebase (`packages/engine/src/`) and authoring tools (`apps/web/src/app/DungeonLabScreen.tsx`)
> **Date:** 2026-04-01

---

## Executive Summary

The Hop engine demonstrates **strong DDA foundations** — far beyond a typical game codebase. Core systems like the `TacticalDataPack` pipeline, `CompositeSkillDefinition` contracts, propensity-based stat generation, and the `GenericUnitAi` are genuinely data-driven. However, several legacy patterns create a **"hard-coded ceiling"** that prevents the engine from being a pure data interpreter. The most critical issue is the `Actor.type: 'player' | 'enemy'` discriminator, which creates structural asymmetry throughout the codebase.

**Overall DDA Maturity: 🟡 7/10** — Strong foundation, but needs targeted refactoring to reach the "gold standard."

---

## 1. The "Pure Data" Litmus Test

### ✅ Strengths

| System | Assessment |
|---|---|
| **`BaseUnitDefinition`** | Excellent. Defines units as pure data: propensities, derived stats, skill loadouts, physics, runtime defaults — all serializable. |
| **`CompositeSkillDefinition`** | Excellent. Skills are declarative data: targeting, effects, costs, reactions, upgrades — all in a JSON-friendly schema. |
| **`TacticalDataPack`** | Excellent. Units and skills bundled as versioned, portable data packs. |
| **Propensity System** | Excellent. Stat generation via `fixed`, `uniform_int`, `triangular_int`, `weighted_table` — pure data → stats pipeline. |
| **JSON Schemas** | [base-unit.schema.json](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/data/schemas/base-unit.schema.json) and [composite-skill.schema.json](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/data/schemas/composite-skill.schema.json) exist for validation. |
| **Serialization** | [serialization.ts](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/serialization.ts) handles BigInt, Map, Set, and Date round-tripping. |

### 🔴 Logic Leaks Found

#### 1.1 Magic Strings & Enums Triggering Unique Logic

| Location | Issue |
|---|---|
| [entity-factory.ts#L145-170](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/entities/entity-factory.ts#L145-L170) | `PASSIVE_SKILL_IDS` is a hard-coded `Set` of 24 skill IDs that determines `slot: 'passive'`. Should be derived from skill definitions. |
| [entity-factory.ts#L198-199](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/entities/entity-factory.ts#L198-L199) | `if (config.type === 'enemy')` forces `ENEMY_AWARENESS` skill onto every enemy. Should be a data-driven loadout rule. |
| [constants.ts#L47-90](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/constants.ts#L47-L90) | `INITIAL_PLAYER_STATS` and `DEFAULT_SKILLS` are hard-coded. The player is essentially an "authored" archetype rather than a data-loaded one. |
| [constants.ts#L117-128](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/constants.ts#L117-L128) | `FLOOR_THEMES` maps every floor to `'inferno'` — hard-coded rather than data-driven per content pack. |
| [generic-unit-ai.ts#L169](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/ai/generic-unit-ai.ts#L169) | `isProactiveTurnSkill` hard-codes `BASIC_ATTACK` as always proactive. Should be a skill metadata flag. |
| [actor.ts#L11](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/entities/actor.ts#L11) | `buildStatusOnTick` branches on `type === 'time_bomb'` and `type !== 'blinded'` — status tick behaviors should be data on the status definition. |
| [visual-registry.ts#L224-234](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/visual/visual-registry.ts#L224-L234) | Visual selection branches on `enemyType === 'ranged'` / `'boss'` — should be driven by a visual component on the actor's data. |
| [balance-budget-config.ts#L64](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/evaluation/balance-budget-config.ts#L64) | Budget modifiers branch on `enemyType === 'boss'` / `'ranged'`. |

#### 1.2 Archetype Safety

Archetypes **pass the test** — they are used as data lookups in [mvp-enemy-content.ts](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/data/packs/mvp-enemy-content.ts). Deleting an entry from `MVP_ENEMY_CONTENT` would not break engine code; `createEnemyFromBestiary` gracefully throws if the subtype is unknown. However, the **player archetype** (`'VANGUARD'` default) is hard-coded in [entity-factory.ts#L68](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/entities/entity-factory.ts#L68).

---

## 2. Systems over Authorship

### 🔴 The "Universal Actor" Model — CRITICAL FINDING

The `Actor` interface is shared between all entities, but the **`GameState` structure** creates a fundamental asymmetry:

```typescript
// types.ts L1103-1107
export interface GameState {
    player: Entity;          // ← Singular, special field
    enemies: Entity[];       // ← Array of "others"
    companions?: Entity[];   // ← Another separate array
}
```

This means **every system** must resolve actors through three different code paths. Example from [effect-engine.ts#L153-157](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/effect-engine.ts#L153-L157):

```typescript
const resolveActorById = (state, actorId) => {
    if (state.player.id === actorId) return state.player;
    return state.enemies.find(e => e.id === actorId)
        || state.companions?.find(e => e.id === actorId);
};
```

**This is the single biggest DDA violation.** A unified `actors: Actor[]` array with faction-based filtering would eliminate dozens of scattered `state.player` / `state.enemies` patterns.

Additionally, `Actor.type: 'player' | 'enemy'` (with `Entity = Actor` alias) creates branching in:
- **Initiative** ([initiative.ts#L46](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/initiative.ts#L46)): player gets different initiative calculation
- **Tactical engine** ([tactical-engine.ts#L221](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/tactical-engine.ts#L221)): `consumesTurn` differs by type
- **Entity factory** ([entity-factory.ts#L87](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/entities/entity-factory.ts#L87)): enemy-only skill injection
- **AI strategy registry** ([strategy-registry.ts#L24](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/ai/strategy-registry.ts#L24)): different strategy selection by type

### ✅ AI & Behavior Trees — STRONG

The [generic-unit-ai.ts](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/ai/generic-unit-ai.ts) (1583 lines) is genuinely data-driven:
- Uses **affordances**: "Can I reach this tile?", "Can I deal damage from here?", "Does this reduce my exposure?"
- Behavior is driven by **`AiBehaviorProfile`** data (`offenseBias`, `commitBias`, `selfPreservationBias`, etc.)
- **Overlays** modify behavior dynamically: `AiBehaviorOverlayInstance` with sources like `'loadout'`, `'skill_ready'`, `'status'`
- **Spark Doctrine** evaluates resource spending via data-driven thresholds

Minor leaks:
- `side === 'enemy'` branch in [resolveCoherenceTarget](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/ai/generic-unit-ai.ts#L309) grants enemies memory-based pursuit. This should be a capability/component check.
- `getOpposingActors` uses `factionId` (good), but `getVisibleOpposingActors` branches on `side` literal (leak).

### ✅ Stat Propensity — STRONG

[propensity-instantiation.ts](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/entities/propensity-instantiation.ts) is a textbook DDA implementation:
- Generic `rollFromPropensity()` evaluates any `PropensityDefinition` method
- `evalDerivedStat()` resolves any linear formula from stat references
- The system feeds directly from `BaseUnitDefinition.propensities` — already a pure config-to-actor pipeline
- Roll traces are captured for deterministic replay

### The `enemyType` Problem

`Actor.enemyType?: 'melee' | 'ranged' | 'boss'` is a categorical field that triggers logic branches across:
- Visual selection, budget calculations, encounter difficulty, and spawn profiles

This should be replaced by **tags** (e.g., `balanceTags: ['boss', 'ranged']`) which already exist on `EnemyBalanceContract` but aren't used consistently at runtime.

---

## 3. Authoring Tools

### 🟡 Dungeon Lab — PARTIAL

[DungeonLabScreen.tsx](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/apps/web/src/app/DungeonLabScreen.tsx) (1952 lines) is a comprehensive editor with:
- ✅ Entity editing (Trinity stats, skill loadouts, weight class)
- ✅ Scenario compilation and live simulation
- ✅ Replay artifacts with checkpoint restoration
- ✅ Batch simulation for balance testing

However:
- **Schema-Driven UI: 🔴 No.** The UI is manually authored with `TextField`, `NumberField`, `SelectField` components. Adding a new trait or stat requires manual UI changes. The existing JSON schemas are not used to generate editor fields.
- **Reference Integrity: 🟡 Partial.** `ALL_SKILLS` enumerates available skills from `COMPOSITIONAL_SKILLS`, but the editor doesn't validate that an entity's loadout references only valid/existing skills.
- **Hot-Swapping: ✅ Yes.** The editor compiles entities and sends them to the headless engine for immediate simulation without recompilation.

---

## 4. Headless Validation

### ✅ Deterministic Results — STRONG

- **Seeded RNG** ([rng.ts](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/rng.ts)): `randomFromSeed(seed, counter)` ensures determinism
- **Command Pattern**: `GameState.commandLog` + `undoStack` for full replay
- **Action Log serialization**: `serializeActionLogForExport` / `parseImportedActionLog`
- **`fingerprintFromState`** provides state hashing for regression detection
- **Replay validation** system exists in [replay-validation.ts](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/replay-validation.ts)

### ✅ Balancing via Data — STRONG

- The `DungeonLabScreen` supports **batch simulations** (configurable batch count, max turns)
- **Evaluation subsystem** ([evaluation/](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/evaluation)) includes balance budget gates, enemy power analysis, encounter difficulty scoring
- The **emergent bestiary** system ([emergent-bestiary.ts](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/entities/emergent-bestiary.ts)) runs evolutionary stress tests across biomes with configurable propensity targets

---

## Recommendations

### Critical (Architecture-Level)

| # | Recommendation | Impact |
|---|---|---|
| **C1** | **Unify `GameState` actor storage.** Replace `player` / `enemies` / `companions` with a single `actors: Actor[]` array. Filter by `factionId` and tags. | Eliminates the #1 source of logic leaks and the triple-path actor resolution pattern. |
| **C2** | **Replace `Actor.type: 'player' \| 'enemy'`** with a tag/capability system. Use `factionId` (already exists) for alignment and tags for behavioral differences. | Removes 12+ branching sites. |
| **C3** | **Replace `enemyType: 'melee' \| 'ranged' \| 'boss'`** with the existing `balanceTags` array from `EnemyBalanceContract`, promoted to the runtime Actor. | Eliminates categorical branching in visuals, budget, and spawning. |

### High Priority (DDA Purity)

| # | Recommendation | Impact |
|---|---|---|
| **H1** | **Derive `PASSIVE_SKILL_IDS`** from `SkillDefinition.slot === 'passive'` instead of maintaining a hard-coded allowlist. | Auto-updates when new passive skills are added. |
| **H2** | **Make player a `BaseUnitDefinition`** in a data pack, like enemies. Move `INITIAL_PLAYER_STATS` / `DEFAULT_SKILLS` into a `player-pack.ts`. | Players become data payloads, not hard-coded configs. |
| **H3** | **Data-drive status tick behaviors.** Add `onTick` as part of the `STATUS_REGISTRY` definition rather than building it in code via `buildStatusOnTick`. | New statuses auto-work without code changes. |
| **H4** | **Move `FLOOR_THEMES` into content packs** as part of the dungeon generation spec. | Floor theming becomes content-editable. |

### Medium Priority (Tooling)

| # | Recommendation | Impact |
|---|---|---|
| **M1** | **Schema-driven editor UI.** Use the existing JSON schemas to auto-generate Dungeon Lab form fields. New traits/stats in the schema automatically appear in the editor. | Gold-standard authoring tool. |
| **M2** | **Reference integrity in editor.** Validate that entity skill loadouts only reference registered skills. Warn on orphan references. | Prevents data corruption. |
| **M3** | **Consolidate `isProactiveTurnSkill` logic** into a metadata flag on `SkillDefinition` (e.g., `proactive: boolean`). | Removes magic string checks. |

### Low Priority (Polish)

| # | Recommendation | Impact |
|---|---|---|
| **L1** | Make AI memory/awareness a **capability provider** rather than branching on `side === 'enemy'`. | Full DDA purity for AI. |
| **L2** | Unify visual resolution to use **component-based visual tags** on Actor instead of `enemyType` branching. | Visual system becomes data-driven. |

---

## DDA Scorecard

| Dimension | Score | Key Finding |
|---|---|---|
| **Serialization Integrity** | 🟢 8/10 | Strong pipeline; player config is the gap |
| **Magic String / Enum Audit** | 🟡 6/10 | `enemyType`, `PASSIVE_SKILL_IDS`, `BASIC_ATTACK` checks |
| **Archetypes as Shortcuts** | 🟢 8/10 | Enemy archetypes are pure data; player archetype is hard-coded |
| **Universal Actor Model** | 🔴 5/10 | `GameState.player` vs `enemies` is the critical violation |
| **AI Affordance-Driven** | 🟢 9/10 | Genuinely generic; minor `side` leaks |
| **Stat Propensity** | 🟢 10/10 | Textbook DDA implementation |
| **Schema-Driven UI** | 🔴 3/10 | Schemas exist but aren't used to drive the editor |
| **Reference Integrity** | 🟡 5/10 | Partial; no validation in editor |
| **Hot-Swapping** | 🟢 9/10 | Live simulation from editor works |
| **Deterministic Results** | 🟢 9/10 | Seeded RNG, command log, replay validation |
| **Balancing via Data** | 🟢 8/10 | Batch sims, budget gates, emergent bestiary |
