# 🏆 The Hop Master Ledger: Principles & Architecture

## 1. The Core Manifesto (Philosophical Pillars)

Every line of code must adhere to these four non-negotiable principles:

* **The Referee is Absolute (Headless-First)**: The engine must solve all logic without a DOM or browser context. If the logic doesn't work in a pure Node.js script, it is broken.
* **Determinism or Death**: All randomness must flow from the `initialSeed`. No `Math.random()` or `Date.now()` is permitted in the engine.
* **State is a River (Immutability)**: The `gameReducer` must never mutate the existing state; it returns a fresh object every turn. This allows for "Infinite Undo" and scrubbable replays.
* **Logic Before "Juice"**: The engine emits **Atomic Effects** (Damage, Displace, Stun). The UI merely "juices" these effects with animations and screen shakes.

---

## 2. Technical Architecture: ECS-Lite

We use a formalized **ECS-Lite** structure to separate data from logic.

* **Entities (Actors)**: Thin data containers identified by a persistent ID.
* **Components**: Strictly typed data blocks (e.g., `PhysicsComponent`, `HealthComponent`) stored in a `Map`.
* **Systems**: Pure functions in `src/systems/` that process components (e.g., `movement.ts`, `combat.ts`). - IN PROGRESS, still need to move more files to the folder.
* **Spatial Bitmasks**: High-speed occupancy lookups use **BigInt bitmasks** to represent the **Flat-Top Hex Grid**.

---

## 3. UI/UX: The Strategic Wrapper

The out-of-combat experience must feel as robust as the tactical grid.

* **Strategic Hub**: The main SPA entry point for loadout selection and meta-progression.
* **Tactical Academy**: Interactive tutorials generated from the `src/scenarios/` registry.
* **The Replay Gallery**: Uses the `ActionLog` to re-simulate matches bit-for-bit.
* **The Preview System**:
* **Level 1 (Movement)**: BFS-based "Bloom" showing reachable hexes and 1-tile threat rings.
* **Level 2 (Targeting)**: Axial "Star" patterns with Line-of-Sight shadowing.



---

## 4. Quality & Validation Pipeline

* **Scenario-Driven TDD**: Every skill must be accompanied by a tactical test in `src/scenarios/`.
* **Fuzz Testing**: A headless script performs 10,000+ random actions to ensure no illegal states occur.
* **Server Validator**: A Node.js CLI to verify `ActionLog` authenticity before leaderboard submission. - TO DO

---

## 5. Definition of Done (MVP Checklist)

* [ ] **ActionLog Export**: UI buttons to save/load JSON session logs.
* [ ] **Visual Feedback**: Impact freezes (50ms) and radial shakes for explosions.
* [ ] **Identity Persistence**: Ensure `turnStartNeighborIds` are captured to prevent "drive-by" auto-attack bugs.

---

## 6. User Feedback

* **Entity overlap**: By default, entities should not overlap unless explicitly allowed. At the moment, a bomb can be sent to a tile that becomes occupied by another entity within the same round, which is not the intended behavior.
* **Skill issues**: 
    * Still need to enforce LOS for skill targeting. At the moment, enemies that are behind other enemies can be targeted. - TODO
    * Bombs should damage every unit in a 1 tile radius.
    * Bombs timer doesn't seem to be working fine or they are not cleared up properly after they explode.
    * Picking up a spear becomes a bit awkward when we have both player and enemies with a spear.
    * Player should die when reaching 0 health. The UI should show the death animation and then the game should end. - IN PROGRESS, the player is dying but no Game Over screen is shown.
* Still need to clean up the preview overlay.
* Still need to create the splash screen and non combat UI and navigation.
* Still need to create juice for the entities and skills and interactions.
* Footman unit that cannot move is attacking from a distance. This should not be allowed.
* Need to allow for free move when there are no enemies left.
* Need to create the 10 level arcade mode.

* TDD
    * All the feedback below should be addressed with TDD.

* Shield Throw
    * Should leave the shield on the ground on impact with another unit. It can then be picked up later just like the spear. - DONE
     
* Grappling Hook
    * Need to connect Grappling Hook to the Kinetic Pulse. - DONE

* Dash
    * If momentum is left after the Dash, the lead unit should be stunned. - TODO

* Vault
    * Vault skill should change its name to Stun Vault every other turn to show that it will behave differently. - DONE

* Spear Throw
    * Cannot pick up the spear after throwing it. - DONE
    * Player loses their spear after a different entity throws their own spear at them. - DONE

* Bombs
    * Bombs should not overlap with entities. - DONE

* Free move
    * Doesn't need to log Free Move in the action log.
    * The turn should end after the target tile is reached with free move.
    * The movement should still follow the same rules as normal movement (LOS, intercept, walkable only, etc.)
    * It should only trigger when there are no enemies left.

* Juice
    * Shield Bash
        * Target displacement should be shown with an animation of the target flying backwards, even if it triggers lava sink.
    * Lava Sink
        * If a unit dies from lava sink, it should be shown with an animation of the unit sinking into the lava.
    * 

* Arcade Mode
    * Level 1 (Environmental Awareness): No enemies, only movement and traps, lava and walls. Teaches the player about movement.
    * Level 2 (The Basics): Standard Footmen. Teaches the player about basic reach.
    * Level 3 (More enemies): Introduce archer, bomber. Force the player to use their archetype to win.
    * Level 4 (Archetype enemies): Introduce spearman, shieldman, grappling hooker as primary threats. Force the player to face threats using the same skills as player archetype.
    * Level 5 (Rest): Introduce a ranged enemy that doesn't move but hits hard, forcing the player to close the gap using Jump or Lunge.
    * Level 6 (Mid boss): Introduce a strong enemy that has boss like skills, "Projected Attacks".
    * Level 7 (Mass kill): High density of low-HP enemies. Tests AoE skills and "Chain Stuns."
    * Level 8 (Increasing difficulty): High density of low-HP enemies. Tests AoE skills and "Chain Stuns."
    * Level 9 (Increasing difficulty): High density of low-HP enemies. Tests AoE skills and "Chain Stuns."
    * Level 10 (The Sentinel): A boss-type enemy with high HP and "Projected Attacks".