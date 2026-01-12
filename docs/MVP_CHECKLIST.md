This is the complete **MVP_CHECKLIST.md**. It serves as the final "Golden Contract" for the developer, ensuring the **Strategic Hub** and **Headless Engine** are perfectly decoupled and the game is ready for a world-class release.

---

# 🏆 Hop MVP: Definition of Done & Shipping Checklist

## 1. Core Engine & Determinism (The Foundation)

*The game must be a mathematically perfect simulation before it is a visual experience.*

* [x] **Deterministic Action Log**: Every session generates a serializable `ActionLog` + `initialSeed`.
* [x] **Zero-Mutation State**: All `GameState` transitions happen through pure reducers. `npm test` confirms state parity across 100+ turns.
* [x] **PRNG Integrity**: All random events (AI tie-breaks, floor generation) strictly consume from the `rngCounter`.
* [x] **Bitmask Occupancy**: Collision and spatial checks use `BigInt` bitmasks for  performance.

---

## 2. Gameplay Mechanics (The "10-Level Arcade")

*A complete "Run" must be playable from start to finish with tactical depth.*

* [x] **The 3-Slot Skill System**:
Vanguard Archetype
* **Offensive**: Spear Throw.
* **Defensive**: Shield Bash (with Wall Slam stun logic).
* **Utility**: Jump (Leap over hazards/actors, stun neighbors, 1 turn CD).

Skirmisher Archetype
* **Offensive**: Grapple Hook (Standard/Heavy branching).
* **Defensive**: Shield Throw.
* **Utility**: Vault (Leap over hazards/actors, stun neighbors every other time, no CD).


* [ ] **Unified Actor Logic**: All 5 base enemies (Footman, Archer, Bomber, Shield Bearer, Assassin) use the same `SkillInstance` logic as the player.
* [x] **Floor Escalation**: Enemy "Point Budget" increases from Floor 1 to 10.
* [x] **Victory Condition**: Reaching the Floor 10 stairs or dying triggers the "Run Complete" / "Game Over" state and score calculation.

---

## 3. Architecture & Monorepo (The Plumbing)

*The project structure must support headless validation.*

* [x] **Package Separation**:
* `@hop/engine`: Pure logic, zero DOM/React dependencies.
* `@hop/shared`: Shared types and constants.


* [x] **Server-Side Validator**: A Node.js script that can ingest an `ActionLog` and `initialSeed` to reproduce the final score.
* [x] **Headless Execution**: The engine can run 1,000 turns in <100ms in a non-browser environment.

---

## 4. The Strategic Hub (Meta Interface)

*The Hub is the persistent entry point where the player makes high-level decisions before entering the tactical grid.*

* [x] **Archetype Selection**: Choice of starting loadout (e.g., *Vanguard*, *Skirmisher*) which injects specific skills into the engine.
* [x] **The Academy (Tutorials)**: A dedicated list of "Executable Scenarios" that teach mechanics (Spear, Bash, Jump) using the engine’s verification logic.
* [x] **Replay Gallery**: A browser for saved `ActionLogs`. Selecting one re-runs the simulation in the Game Interface in "Watch Mode."
* [x] **Global Persistence**: Choice of archetype, high-score history, and tutorial completion status saved to `localStorage`.

---

## 5. The Main Game Interface (Tactical Grid)

*The gameplay view is a "thin client" focused entirely on tactical execution and visual feedback.*

* [x] **Portrait Optimization**: A clean 9x11 grid layout optimized for mobile screens with zero UI clutter.
* [x] **Action Input**: Simplified controls for Movement, Skipping Turns, and 3 specific Skill slots.

---

## 6. Visuals & "The Juice" (The Feel)

*The UI must communicate engine events with high-fidelity feedback.*

* [x] **Visual Event Pipeline**: The engine emits `AtomicEffects` (Shake, Freeze, Text). The UI maps these to:
* **Impact Freeze**: 50ms pause on enemy death.
* **Radial Shake**: Triggered on Bomb explosions.
* **Combat Text**: Pop-ups for "Stunned!", "Sunk!", and Damage numbers.


* [x] **Deterministic Replay UI**: Controls for Play/Pause/Scrubbing through a saved `ActionLog`.

---

## 7. The Headless Engine (@hop/engine)

*The "Brain" of the game must be a mathematically perfect, isolated simulation.*

* [x] **Deterministic Command-Stream**: Every state change is driven by `(State, Action) => NewState`. No hidden side effects.
* [x] **PRNG Integrity**: All entropy (enemy spawns, AI tie-breakers) is derived from the `initialSeed` and `rngCounter`.
* [x] **Unified Actor System**: Both Player and Enemies use the same skill objects and "Weight Class" logic (Standard vs. Heavy).
* [x] **Bitmask Performance**: Occupancy and spatial lookups use `BigInt` bitmasks to allow for high-speed AI simulations.

---

## 8. Verification & Scenario Testing

*Quality is enforced through code, not manual play-testing.*

* [x] **Tutorial-as-Test**: Every tutorial in the Hub must also exist as a test in `packages/engine/tests/scenarios`. If a mechanic changes, the test fails. Move all the test scenarios from the skill files to the scenarios folder.
* [x] **Skill Scenarios**: Each skill (especially Grapple Hook) has at least 3 verified scenarios (Positive, Negative, Hazard Interaction).
* [ ] **Multi-System Scenarios**: Verified tests for complex interactions (e.g., "Hook a target into a Bomb that pushes a Shield Bearer into Lava").
* [x] **Behavioral Fuzzing**: The `fuzzTest.ts` script successfully completes 10,000 random turns without engine crashes or illegal state overlaps.
* [ ] **ID Intersection**: All passive skills (Auto-Attack) must use Identity intersection (Start ID in End IDs) instead of previousPosition logic.

---

## 9. Scoring & Validation (Leaderboard)

*Anti-cheat and competitive integrity are baked into the engine.*

* [x] **Score Formula Parity**: `Score = (Floor * 1000) + (HP * 100) - (Turns * 10)`. The logic must be identical on the Client and the `validator` app.
* [ ] **ActionLog Export**: Ability to export a JSON string of a run that can be imported and replayed bit-for-bit on another device.
* [ ] **Server-Side Re-run**: The `validator` successfully re-simulates a full 10-floor log and confirms the score matches.
* [x] **Local Persistence**: `localStorage` saves the current run state and high scores.

---

## 🛑 Blockers for Shipping (The "No-Go" List)

*If any of these occur, the build is rejected.*

1. **Determinism Break**: Does the same seed + action log ever produce a different result? (Must be **NO**).
2. **UI Leak**: Does the `engine` package require `window`, `document`, or `React`? (Must be **NO**).
3. **Friendly Fire**: Does `AUTO_ATTACK` (Punch) damage allied units? (Must be **NO**).
4. **Invalid Move**: Can an actor ever occupy the same hex as another actor or a wall? (Must be **NO**).
5. Can a player move onto a Lava tile without taking damage? (Must be **No**)
6. Does the server validator require browser APIs (window/document)? (Must be **No**)

---

### Developer Final Instruction

Focus on the **Scenario Tests** first. If you can prove the **Grapple Hook** flings an enemy into lava via a headless test, the UI implementation is just a matter of connecting the sprites. **The Hub is the home of your meta; the Grid is the home of your math.**

> "World-Class" doesn't mean "Feature Complete." It means "Architecture Perfect." Prioritize the **Determinism** and **Scenario Tests** over adding a 6th enemy type. If the foundation is solid, content expansion is trivial.