# 🏆 The Hop Engine: Gold Standard Manifesto

## I. The Core Philosophy: "The Referee & The Juice"

The engine is divided into two immutable domains:

1. **The Referee (Engine)**: Headless, pure TypeScript. It handles the "Truth." It must run identically in Node.js (for balancing/validation) and the Browser (for gameplay).
2. **The Juice (Client)**: The React/PixiJS wrapper. It handles "Perception." It translates the Referee's dry data into animations, screenshake, and sounds.

---

## II. Strategic Logic: Intent vs. Execution

To ensure a robust UI and valid turn accounting, we strictly separate "asking" from "doing."

### 1. The Intent Phase (Validation)

* **Definition**: A request to perform an action (e.g., `USE_SKILL`, `MOVE`).
* **Rule**: Intent must be validated against the current `GameState` *before* any state modification occurs.
* **Preview**: The engine must support "Ghost Executions" where an intent is simulated to return a `PotentialOutcome` (visualized by the UI) without consuming resources or turns.

### 2. The Execution Phase (Atomic Application)

* **Definition**: The commitment of an intent to the state.
* **Turn Consumption**: **Turns are only consumed upon successful execution.** If a skill fails (e.g., target moved, out of range), no turn is spent, and no "Action Log" is generated.
* **Atomic Effects**: Execution does not "change" the state directly; it generates a list of `AtomicEffects` (Damage, Displace, Stun) which are then applied to the state.

---

## III. The World-Class Standard of Determinism

* **Flat-Top Grid Integrity**: All spatial logic must use the unified `HexCoord` factory. Tie-breaking (e.g., finding the "closest" hex) must be deterministic (e.g., sort by , then ).
* **Seeded RNG**: Only use the provided `Mulberry32` PRNG. No `Math.random()`. The `rngCounter` must be part of the `GameState` to ensure replays are frame-perfect.
* **Headless-First**: If a feature requires `window`, `document`, or `fs` to function, it is broken. Node-specific utilities (like balancing loggers) must be dynamically imported or guarded.

---

## IV. The Golden Rules of the Grid

To prevent "Split-Brain" state bugs:

1. **Single Source of Truth**: The `state.tiles` Map is the ONLY source for world properties. NEVER use standalone arrays like `lavaPositions`.
2. **The Movement Hook**: Any logic moving an entity MUST call `resolveEnvironment(entity)`. This ensures "Lava Sinking" or "Trap Triggers" cannot be bypassed.
3. **Occupancy Mask**: High-speed lookups must use the **BigInt bitmask**. The bitmask must be refreshed at the start of every execution phase.

---

## V. Skill & Entity Design (ECS-Lite)

* **Universal Entity Factory**: Every Actor (Player, Enemy, Falcon) must be created via the `EntityFactory`. They must all possess a consistent `activeSkills` loadout.
* **Skill Composition**: Behaviors (Movement, Attack, Teleport) are not hardcoded into the engine; they are defined as `Skill` objects with `validate()`, `run()`, and `juice()` signatures.

---

## VI. Quality & Validation Standards (Definition of Done)

A task is not complete until:

* **Scenario-First TDD**: A `.ts` or `.json` scenario file exists that proves the mechanic works and correctly fails on illegal input.
* **Clean Build**: `npm run build` passes with zero TypeScript errors (no `any` types allowed).
* **Parity Check**: The `validateReplay` script confirms that the Node.js runner produces the same hash as the browser.

---

### Interactive Exercise: Applying the Standard

To put these principles into practice for your upcoming **Skill Power Assessment**, let's look at a pending feature: **Firewalk**.

**The Challenge:** Based on the Feedback, Firewalk is missing from the UI and needs to teleport the player to fire/lava tiles while granting immunity.

**Applying the "Gold Standard":**

1. **Intent**: The `ManualStrategy` must check if the target tile has the `ON_FIRE` or `LAVA` trait.
2. **Execution**: The skill generates a `Displacement` effect and a `StatusEffect` (Immunity).
3. **Turn Consumption**: If the player clicks a stone tile, the UI should block the intent—no turn is spent, and the player remains active.
