This is the complete **MVP_CHECKLIST.md**. It serves as the final "Golden Contract" for the developer, ensuring the **Strategic Hub** and **Headless Engine** are perfectly decoupled and the game is ready for a world-class release.

---

# 🏆 Hop MVP: Definition of Done & Shipping Checklist

## 1. Core Engine & Determinism (The Foundation)

* [x] **Deterministic Action Log**: command/action recording exists (commandLog/actionLog) — see logic.ts:628-637.
* [x] **Zero-Mutation State**: gameReducer drives state transitions — see logic.ts:320-336.
* [x] **PRNG Integrity**: rng consumption via consumeRandom — see rng.ts.
* [x] **Bitmask Occupancy**: spatial mask refresh exists — see spatial.ts.

---

## 2. Gameplay Mechanics (The "10-Level Arcade")

* [ ] **Strategic Hub**: Hub UI wiring / dedicated Hub screen incomplete — check current Hub rendering in App.tsx and consider a dedicated [apps/web/src/components/Hub.tsx] screen.
* [x] **Archetype Selection**: Loadouts and serialization exist (DEFAULT_LOADOUTS, applyLoadoutToPlayer) — see loadout.ts.
* [x] **The Academy**:  Tutorial scenarios + replay gallery present — see TutorialManager.tsx and ReplayManager.tsx.

* [x] **The 3-Slot Skill System**: implemented (compositional + legacy) — see skillRegistry.ts and SkillTray.tsx.
* [ ] **Unified Actor Logic**: same skill behavior for all enemies — tests and refactor needed — file targets: initiative.ts and packages/engine/src/skills/**.
* [ ] **ActionLog Export**: UI/API missing — add in ReplayManager.tsx and supporting helpers in index.ts.
Hub & Meta

## 3. Architecture & Monorepo (The Plumbing)

*The project structure must support headless validation.*

* [x] **Package Separation**:
* `@hop/engine`: Pure logic, zero DOM/React dependencies.
* `@hop/shared`: Shared types and constants.


* [x] **Server-Side Validator**: A Node.js script that can ingest an `ActionLog` and `initialSeed` to reproduce the final score.
* [x] **Headless Execution**: The engine can run 1,000 turns in <100ms in a non-browser environment.

---

## 5. The Main Game Interface (Tactical Grid)

*The gameplay view is a "thin client" focused entirely on tactical execution and visual feedback.*

* [x] **Thin-client GameBoard & inputs**: wired — see GameBoard.tsx and App.tsx.
* [ ] **Hub UX revamp requested (separate screen, cleaner layout)**: UI change in [apps/web/src/components/Hub.tsx] (to add) and styles.

---

## 6. Visuals & "The Juice" (The Feel)

*The UI must communicate engine events with high-fidelity feedback.*

* [x] **Visual Event Pipeline**: present (engine emits effects) — see effectEngine.ts and GameBoard mapping. The UI maps these to:
* **Impact Freeze**: 50ms pause on enemy death.
* **Radial Shake**: Triggered on Bomb explosions.
* **Combat Text**: Pop-ups for "Stunned!", "Sunk!", and Damage numbers.


* [x] **Deterministic Replay UI**: Controls for Play/Pause/Scrubbing through a saved `ActionLog`.

---

## 8. Verification & Scenario Testing

*Quality is enforced through code, not manual play-testing.*

* [ ] **Tutorial-as-Test**: Every tutorial in the Hub must also exist as a test in `packages/engine/tests/scenarios`. If a mechanic changes, the test fails. Move all the test scenarios from the skill files to the scenarios folder.
* [x] **Skill Scenarios**: embedded in skill defs (compositional scenarios) and unit tests exist — see [packages/engine/src/skills/**/scenarios] and [apps/web/src/tests].
* [ ] **Multi-System Scenarios**: Verified tests for complex interactions (e.g., "Hook a target into a Bomb that pushes a Shield Bearer into Lava").
* [x] **Behavioral Fuzzing**: The `fuzzTest.ts` script successfully completes 10,000 random turns without engine crashes or illegal state overlaps.
* [ ] **ID Intersection**: All passive skills (Auto-Attack) must use Identity intersection (Start ID in End IDs) instead of previousPosition logic.

---

## 9. Known Bug/Todo Highlights (from repo + feedback)

* [x] **Basic Attack was preempting offensive slot**: fixed by marking BASIC_ATTACK passive at basic_attack.ts.
* [x] **Hub selection flow needed APPLY_LOADOUT + selectedLoadout persistence**: addressed in logic.ts and App.tsx.
* [x] **Auto-attack identity logic largely present in AUTO_ATTACK (uses ID intersection)**: see auto_attack.ts, but verify all entry points capture persistent IDs at turn start.


# Add on

## UI Preview system
Focusing on Level 1 (Movement/Attack) and Level 2 (Skill Range/Targeting) is the right move because these form the "spatial vocabulary" of the player. If these aren't perfectly clear, the higher-level physics (Level 4) will just feel like chaos.

Since we are working with a flat-top hex grid, the visual logic for these levels needs to handle the staggered column offsets correctly.

* **Level 1**: Intent to Move & Opportunity
* This is the baseline state. When the player clicks their character, you aren't just showing "where they can go," you are showing zones of influence.
* The "Walkable" Bloom: Instead of just highlighting hexes, use a "flood-fill" (Dijkstra) up to the player's movement points. This needs to account for walls and other units.
* The Passive Threat Ring: Subtly highlight the 1-tile ring around the player. This indicates their Auto-Attack range. If an enemy is in this ring, the highlight should change (e.g., a red inner border) to show they will be hit by the "Identity" attack.

* **Level 2**: Skill Reach & Validity
* This level triggers when a skill like SHIELD_THROW or GRAPPLE_HOOK is selected. It overlays the movement grid.
* The Hard Range Border: A bold outline at dist === 4.
* LoS Shadow-casting: This is where your getHexLine logic comes into play visually. Tiles behind a wall within the range should be "dimmed" or not highlighted at all.
* Target Validity Markers: * Grapple Hook: Highlight units (Standard) and Walls/Pillars (Heavy) differently.
* Shield Throw: Only highlight units.

* **Implementation for the Headless Engine**
* To support these levels in your automated testing framework, you'll want to expose a getValidTargets method in your skill definitions. This allows the UI to call the same logic the engine uses to validate a turn.