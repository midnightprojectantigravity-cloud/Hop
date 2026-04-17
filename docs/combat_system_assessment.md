# Combat System & Skills: Data-Driven Assessment

**Date:** April 13, 2026

**Scope:** `packages/engine/src/combat`, `packages/engine/src/skills`, `packages/engine/src/systems`, `packages/engine/src/data/contracts.ts`

This document provides a comprehensive, repository-grounded assessment of the engine's Combat System and Skill Systems. The goal is to establish a clear architectural roadmap for migrating from procedural, imperative TypeScript code to generic, schema-validated, data-driven JSON configurations, unified under a shared effect resolution engine.

---

## 1. Executive Summary

The Hop Engine currently bridges two eras: 
1. **The procedural past**, where combat execution and skill logic are written as imperative TypeScript functions (e.g., `execute()` handlers in `src/skills/*`).
2. **The declarative future**, governed by `src/data/contracts.ts` and `CompositeSkillDefinition`, which allows content to be expressed purely as semantic, stack-based JSON data payloads.

Our primary objective is to fully embrace the declarative future. By decomposing the **Combat System** (timeline events, effect resolution, lifecycle hooks) and the **Skill System** (targeting, upgrades, companions) into generic pieces, we can enable true data-driven content authorship.

---

## 2. Current State Analytics

### 2.1 The Skill System
The skill system is tracked in `packages/engine/src/skills/` with 51 registered skills.
- **Data-Driven Elements (Existing):** `baseVariables`, damage taxonomies, `SkillModifier` (upgrades), intent profiles, and resource/metabolic profiles.
- **Procedural Elements (Technical Debt):** 
  - `execute(state, context)` handles complex effect sequencing implicitly.
  - Targeting boundaries (`getValidTargets`) have imperative visibility logic.
  - Upgrade checks (`activeUpgrades.includes(...)`) enforce branching pathways in code.
  - Capability systems (Movement, Senses, Vision) rely on callback-based `resolve()` methods.

### 2.2 The Combat System
Foundational engine logic resides mostly inside `packages/engine/src/systems/`.
- **Effect Engine (`effect-engine.ts`)**: Defines basic timeline events and how `AtomicEffect` elements mutate game state. Handles LIFO stack resolution and vital checks.
- **Data Constructs (`contracts.ts`)**: Introduces `CompositeAtomicEffectDefinition` (`DEAL_DAMAGE`, `APPLY_STATUS`, `APPLY_FORCE`, string messages).
- **Taxonomies (`damage-taxonomy.ts`)**: Strictly defines damage types and elements.
- **Procedural Elements (Technical Debt):**
  - Hardcoded interactions: Hazards are evaluated procedurally inside TileResolvers. Damage modification traits are scattered.
  - The Event Stack: Some legacy interactions bypass standard `AtomicEffect` logic completely.
  - Missing Effect Vocabulary: Currently, actions like "spawn actor", "place surface", or "trigger trait" lack pure data definitions.

---

## 3. The Path to Generic & Data-Driven

For the Combat System and Skills to become truly shared and data-driven (`JSON` authored), we need to pursue the following architectural alignment:

### 3.1 Composite Skill & Action Framework (Phase 1)
Skills must completely abandon handwritten `execute()` logic. 
Instead, they will point to a **JSON sidecar** matching the `CompositeSkillDefinition`. 

```json
{
  "id": "FIREBALL",
  "baseAction": {
    "effects": [
      {
        "kind": "DEAL_DAMAGE",
        "target": { "selector": "targetHex" },
        "amount": { "base": 15, "scaling": [{ "stat": "mind", "coefficient": 1.5 }] },
        "damageClass": "magical"
      },
      {
        "kind": "PLACE_SURFACE",
        "target": { "selector": "targetHex" },
        "surfaceType": "BURN",
        "duration": 3
      }
    ]
  }
}
```
**Required Upgrades to the Engine:**
1. **Targeting Interpreter:** A generic spatial selector parser (`self`, `targetHex`, `line`, `radius`) to replace `getValidTargets`.
2. **Extended Vocabulary:** Add `PLACE_SURFACE`, `DISPLACEMENT` (dashes, knockbacks), `SPAWN_ACTOR`, and `APPLY_AILMENT` to `CompositeAtomicEffectDefinition`.

### 3.2 Upgrade-to-Keyword Decoupling (Phase 2)
Current upgrade logic relies on conditionals: `if (activeUpgrades.includes('EXTRA_RANGE')) { ... }`. 
This must migrate to **Keyword Mutators**. Upgrades are defined inside JSON and apply patches or tag mutations.

- The Engine dynamically calculates the "Virtual Skill" based on `activeUpgrades`.
- Upgrade modifiers (`UpgradeModifier` in contracts) support operations: `add_effect`, `remove_effect_by_tag`, `add_keyword`.
- The combat stack inherently reacts to keywords like `PIERCING` or `VOLATILE` during LIFO resolution without explicit code.

### 3.3 Universal Lifecycle Hooks & Reaction System (Phase 3)
Instead of embedding logic into individual skills, the core Combat Engine introduces robust **Reactive Windows** defined purely by data.
- **Triggers:** `ON_DECLARE`, `BEFORE_RESOLVE`, `ON_COLLISION`, `AFTER_RESOLVE` (Already scaffolded in `SkillReactionDefinition`).
- A status ailment, passive skill, or defensive stance simply inserts a generic `SkillReactionDefinition` into the event queue.
- **Example:** A "Thorns" status is defined by JSON: `trigger: "BEFORE_RESOLVE"`, checking for incoming `physical` damage, and injecting a `DEAL_DAMAGE` effect mapped to `target_to_source`.

### 3.4 Decoupled Summon & Companion Layer (Phase 4)
Current companion systems (e.g., Falcon 'Roost', 'Scout', 'Predator' modes) are hard-coded in TypeScript `execute()` branches.
- Expand `BaseUnitDefinition` and summon schemas to allow data-driven state machines.
- Define companion states as loadout swaps and capability overlays loaded directly from the `data/companions` directory.

### 3.5 Declarative Capabilities (Phase 5)
Senses, passive traits, and movement modes (`BURROW`, `FLIGHT`, `PHASE_STEP`) currently use impenetrable TypeScript callbacks.
We must construct a capability pipeline:
1. Every entity carries a `CapabilityArray` built from JSON definitions.
2. The Engine validates pathing by querying the array properties (`canTraverseObstacles: true`).
3. This creates a scalable pattern for modding without touching the execution engine.

---

## 4. Execution Sandbox

The transition logic should heavily favor the **`CompositeSkillBridge`**. 
1. Build out the vocabulary inside `contracts.ts`.
2. Implement the missing handlers inside `effect-engine.ts`.
3. Sequentially port skills into JSON definitions and validate them using `__tests__/scenarios_runner.test.ts`. 

By centralizing the Combat Ruleset around the universal `applyAtomicEffect` engine, the TypeScript environment acts entirely as a "sandbox" execution context, and JSON becomes the absolute authority.
