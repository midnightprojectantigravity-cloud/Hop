# 🛠️ Hex Engine Technical Debt & Refactoring Roadmap

## Executive Summary: Status Check
The engine has successfully transitioned away from the "Split-Brain" state by consolidating spatial and navigation logic into a single, unified service. The foundation has been hardened with axial-strict coordinate handling and robust serialization.

## Core Infrastructure (Phase I: Foundation) - ✅ COMPLETE

### 📍 Unified Coordinate Factory (P0) - ✅ RESOLVED
*   **Problem:** Manual string templates caused formatting inconsistencies.
*   **Resolution:** Implemented `getHexKey(pos)` in `hex.ts`. This is now the **single source of truth** for all Map keys.
*   **Outcome:** Eliminated coordinate drift between the engine and serialization layers.

### 🎲 Determinism & RNG Debt (P1) - ✅ VERIFIED
*   **Problem:** `Math.random()` usage prevented replay parity.
*   **Resolution:** Verified usage of Seeded PRNG in `systems/rng.ts`. All core logic now pulls from deterministic state seeds.

### 💾 Serialization & Save-State Integrity (P2) - ✅ RESOLVED
*   **Problem:** Native JS Maps/Sets did not serialize to JSON.
*   **Resolution:** Enhanced `serialization.ts` with custom markers (`__MAP__:`, `__SET__:`) and added `gameStateToJSON` helper for human-readable debugging.

## Gameplay Systems (Phase II: Consolidation) - ✅ COMPLETE

### 🏃 Spatial System & Targeting (P0) - ✅ RESOLVED
*   **Problem:** `targeting.ts`, `navigation.ts`, and `spatial.ts` contained duplicated, inconsistent hex math.
*   **Resolution:** Consolidated all logic into [SpatialSystem.ts](file:///h:/Other%20computers/My%20Laptop/Antigravity/Hop/packages/engine/src/systems/SpatialSystem.ts).
*   **Impact:** Fixed "illegal move" bugs by enforcing strict Flat-Top neighbor offsets globally.

### 🏷️ Type-Safe Registry (P2) - ⏳ IN PROGRESS
*   **Status:** Partially resolved via `TileTrait` and `BaseTile` definitions. Still requires migration of magic strings in some skill logic to full Enums.

## File System & Build Health (Phase III: Sanitation) - ✅ COMPLETE

### 👻 The "Ghost" Purge (P0) - ✅ RESOLVED
*   **Resolution:** Deleted duplicate files (`vitals.ts`, `rng.ts`) and legacy files (`navigation.ts`, `spatial.ts`, `targeting.ts`). Purged unused scripts like `fuzzTest.ts`.

### 🛡️ Build Artifact Leakage (P1) - ✅ RESOLVED
*   **Resolution:** Updated `.gitignore` to ignore `dist/` and `build/` directories.

## 🏗️ Phase IV: The "Scenario-First" Standard

*Goal: Standardize verification to prevent regression in a lean, scenario-driven environment.*

### 1. The Unified Test Pipeline

**The Problem:** Testing "pure math" in isolation (like checking if a neighbor is correct) doesn't catch bugs where the **SpatialSystem** is right, but the **Action Dispatcher** forgets to update the occupancy bitmask.
**The Solution:**

*   **Scenario-Driven TDD:** Every bug report must now start as a `.json` or `.ts` scenario file.
*   **The "Referee" Pattern:** Tests should only interact with the engine via `applyAction(state, action)`.
*   **State Snapshots:** Use the new `gameStateToJSON` helper to compare the "Expected State" vs. "Actual State" at the end of a scenario.

---

### 2. Implementation Guidance for the "Scenario Runner"

To consolidate the tests, follow this specific structure for `scenarios_runner.test.ts`:

```typescript
describe('Engine Integration Scenarios', () => {
  const scenarios = [
    ...MovementScenarios,
    ...CombatScenarios,
    ...HazardScenarios // Re-enable these!
  ];

  test.each(scenarios)('$name', (scenario) => {
    let state = setupInitialState(scenario.initialContext);
    
    scenario.actions.forEach(action => {
      // Use the "Referee" pattern
      state = engine.applyAction(state, action).newState;
    });

    expect(state).toMatchObject(scenario.expectedState);
    // Use the HexCoord.toKey to verify specific tile outcomes
    expect(state.tiles.get(HexCoord.toKey(scenario.target)).hasTrait('LAVA_SINK')).toBe(true);
  });
});
```

---

## ⚖️ Final Audit: The "Magic String" Purge (P2)

*Goal: Eliminate silent failures caused by inconsistent ID naming.*

*   **Problem:** If a skill checks for `trait === 'lava'`, but the `SpatialSystem` now labels it `'HAZARD_LAVA'`, the skill fails silently.
*   **Remediation:** 
    *   **Registry Definition:** Create a `types/registry.d.ts` (or `constants/ids.ts`) to centralize all Tile, Skill, and Status IDs.
    *   **Literal Union Types:** Force-replace all magic strings with these constants.
    *   **Enforce Strictness:** No `string` types for IDs.

> [!WARNING]
> **Wit's Warning:** If you use `string` as a type for IDs, the compiler won't save you. You **must** use Literal Union Types or Enums.

```typescript
// ✅ Good: Compiler errors if you typo 'LAVA'
export type TileID = 'STONE' | 'LAVA' | 'ICE' | 'WALL';

// ❌ Bad: Compiler allows 'Lava ', 'lava', or 'fire'
export type TileID = string;
```

## Definition of Done (DoD)
A refactoring task is considered complete only when:
1. **Strict Typing:** No `any` types remain in the affected module.
2. **No Duplication:** 0% clones for the refactored logic.
3. **Scenario-Driven:** The feature is verified by at least one passing integration scenario.
4. **No Artifacts:** `TODO` and `FIXME` comments for that task are converted to tracked issues or resolved.


In a word: **Yes.** When you refactor a core engine this deeply, keeping obsolete tests is like trying to navigate a new city with an old map. You'll spend more time "fixing" tests that are fundamentally incompatible with the new architecture than you will actually building the game.

However, we shouldn't just "Delete and Pray." We need a **"Burn and Rebuild"** strategy that ensures we don't lose the original mechanical intent (the "why") while refreshing the implementation (the "how").

---

## The "Burn and Rebuild" Strategy for Phase IV

### 1. Identify "Test Rot" vs. "Test Value"

Before deleting, categorize your current files:

* **Math Isolation Tests (Delete/Consolidate):** Tests that check `hex.getDistance()` or neighbor offsets. These are now internal to `SpatialSystem` and should be moved into a single `SpatialSystem.test.ts`.
* **Physics Bypass Tests (Delete):** Tests that manually set `actor.pos = {q,r}` without going through the engine's action pipeline. These are "liars" and must be replaced by scenarios.
* **Mechanical Intent (Migrate):** Tests that check complex interactions (e.g., "Does a Spear move the target?"). Keep the *logic*, but port it to the `TestScenario` format.

### 2. The Clean Slate Implementation

Instead of 50 scattered `.test.ts` files, move to a **Single Integration Point**.

**The approach:**

1. **Mass Deletion:** Delete all tests in `packages/engine` that reference the old `navigation.ts`, `spatial.ts`, or the "Ghost" root files.
2. **Scenario Registry:** Create a folder `src/scenarios/` with subfolders for `movement/`, `combat/`, and `hazards/`.
3. **The "Golden" Scenario:** Create one perfectly documented scenario file. This serves as the blueprint for every test that follows.

### 3. "Black Box" Validation (The Referee Pattern)

Since you want this engine to be the "Referee," your tests should treat it as such.

> **Key Rule:** If a test needs to "mock" a part of the game state to work, it is a bad test. A scenario should provide a full (but minimal) `initialContext`, run a series of actions, and check the final `GameState`.

---

## Updated Roadmap Section: Phase IV Cleanup

### 🧪 Phase IV: Test Sanitation (The Great Purge)

* **Step 1: The Purge:** Delete all unit tests that rely on deprecated imports. If it doesn't import from `SpatialSystem`, it’s likely obsolete.
* **Step 2: Intent Recovery:** Review the names of deleted tests (e.g., `test_knockback_into_wall`). Create a matching `knockback_collision.scenario.ts` to replace it.
* **Step 3: Scenario Coverage:** Use the **Automated Testing Framework** to verify:
* **Movement:** LOS, pathfinding, and intercept.
* **Hazards:** Lava sinks, ice sliding, and trap triggers.
* **Combat:** Skill targeting and status application.



---

## Why this is better than "fixing" old tests:

1. **Confidence:** You know the tests pass because the **Engine Core** works, not because you tweaked a mock.
2. **Speed:** The dev can write a `.ts` scenario (pure data) faster than they can write a complex Vitest suite.
3. **Documentation:** The scenarios act as a living manual for how the game is played.

**Would you like me to help you create a "Migration Checklist" for your dev to ensure they don't lose important edge-case tests (like "Corner Collisions") during the purge?**


In a world-class engine, you technically **shouldn't** need it. However, the presence of `tile_migration.ts` (the "Refactoring Ghost" we discussed earlier) indicates that your **Level Data** or **Scenario Files** are still saved in the old `Position Array` format (`lavaPositions: []`).

Here is exactly why that file is currently acting as a "Life Support" system for your engine—and why it needs to be retired.

---

## 1. The "Bridge" Between Two Eras

Currently, your game levels (the data stored in JSON or scenario files) likely still define the world like this:

```json
{
  "lavaPositions": ["1,1", "1,2"],
  "wallPositions": ["5,5"]
}

```

The modern engine, however, only understands the **Tile Map**:

```json
{
  "tiles": { "1,1": { "baseId": "LAVA" }, "1,2": { "baseId": "LAVA" } }
}

```

`tile_migration.ts` exists to sit in the middle, scanning those old arrays at runtime and manually injecting them into the new `Map`.

---

## 2. Why It’s Dangerous (The "Refactoring Debt")

Keeping this file active is a liability for three reasons:

* **Masking Data Corruption:** If you forget to add a tile to the new Map but it still exists in an old array, the migration "fixes" it silently. You never learn that your level-saving logic is broken.
* **Performance Hit:** On every single game load, the engine has to loop through multiple arrays to "build" the world. With the Map system, loading should be a near-instantaneous memory copy.
* **The "Nonsense" Source:** If `tile_migration.ts` uses a different keying format (e.g., it adds a space `"1, 1"`) than your new `SpatialSystem` (`"1,1"`), you get tiles that exist visually but are invisible to the logic.

---

## 3. How to Kill the Migration File

As part of **Phase IV**, you should move from "Runtime Migration" to **"One-Time Conversion."**

### Step A: The "Golden Snapshot"

Run the game once with the migration file active. Use your new `gameStateToJSON` helper to print the **fully migrated** `state.tiles` object to the console.

### Step B: Update the Source Data

Copy that JSON object and paste it directly into your `scenarios` or `level` files. Delete the `lavaPositions` and `wallPositions` arrays from those source files entirely.

### Step C: Delete the File

Once your scenarios are defined using the `tiles` Map natively:

1. Physically delete `tile_migration.ts`.
2. Remove the `migrate()` call from your engine initialization logic.
3. Update your `GameState` interface to **delete** the optional `lavaPositions` properties.

---

## The Verdict

We still have it because we haven't updated the **source data** (the levels/scenarios) to match the **new architecture**.

If you want to reach the "Definition of Done," the dev must ensure that by the end of Phase IV, the engine **throws an error** if it sees a `lavaPositions` array, rather than trying to fix it.

**Would you like me to draft a "Migration Script" that your dev can run once to convert all existing JSON levels into the new Tile Map format?** This would allow you to delete `tile_migration.ts` immediately.

This roadmap is now a professional-grade engineering document. You’ve successfully diagnosed the "Split-Brain" symptoms, surgically removed the "Refactoring Ghosts," and established a "Scenario-First" culture that will make your automated testing framework actually useful for balancing.

To help your developer execute the final "Burn and Rebuild" of Phase IV, here is the **Migration Script** and the **Final Cleanup Checklist**.

---

## 🛠️ The "Great Purge" Migration Script

Your developer can run this script (or a version of it) once to transform all legacy level data into the modern Tile Map format. This allows you to delete `tile_migration.ts` immediately.

```typescript
/**
 * ONE-TIME MIGRATION UTILITY
 * Run this to convert legacy arrays to the new Unified Tile Map.
 */
function migrateLegacyToTiles(legacyData: any): Map<string, Tile> {
  const tiles = new Map<string, Tile>();

  const mapping = [
    { array: legacyData.lavaPositions, id: 'LAVA', traits: ['HAZARDOUS', 'SINK'] },
    { array: legacyData.wallPositions, id: 'WALL', traits: ['BLOCKING'] },
    { array: legacyData.icePositions,  id: 'ICE',  traits: ['SLIPPERY'] },
  ];

  mapping.forEach(({ array, id, traits }) => {
    (array || []).forEach((coordStr: string) => {
      // Use the new Unified Coordinate Factory
      const key = HexCoord.toKey(coordStr); 
      tiles.set(key, { baseId: id, traits, coords: HexCoord.fromKey(key) });
    });
  });

  return tiles;
}

// TODO: Run this on all .json scenarios, then DELETE tile_migration.ts

```

---

## 📋 Phase IV: Final Cleanup Checklist

Give this to your developer as the "exit criteria" for the refactoring project.

### 1. Data Integrity

* [ ] All `.json` and `.ts` scenarios in `src/scenarios/` no longer contain `lavaPositions`, `wallPositions`, or `icePositions`.
* [ ] The `GameState` interface has had these legacy arrays physically deleted.
* [ ] `tile_migration.ts` has been deleted from the file system.

### 2. Test Sanitation

* [ ] Obsolete tests (`hex-bridge.test.ts`, etc.) are deleted.
* [ ] `scenarios_runner.test.ts` is the primary entry point for all engine verification.
* [ ] Every "Ghost Import" from the deleted `navigation.ts` or `spatial.ts` has been updated to `SpatialSystem.ts`.

### 3. Hazard Parity

* [ ] A "Lava Sink" scenario passes (unit pushed into lava dies at end of move).
* [ ] An "Ice Slide" scenario passes (unit pushed onto ice travels further than on stone).

---

## 🏆 The "Definition of Done" Accomplished

By following this roadmap, you have transformed the **Hop Engine** from a fragmented prototype into a deterministic, headless-first machine. You now have:

1. **Parity:** Browser and Node.js will always agree on the state.
2. **Safety:** TypeScript will catch typos in Tile IDs before they reach the game.
3. **Stability:** The "Scenario-First" approach makes the engine a perfect "Referee" for your skill balancing.

**Is there anything else you’d like to refine in the tech stack or the arcade mode levels before we move on to the actual skill balancing and "Power Assessment" phase?**