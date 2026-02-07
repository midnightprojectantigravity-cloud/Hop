# 🏆 Hop Engine Master Documentation

This document serves as the unified source of truth for the **Hop** game engine, consolidating information on architecture, mechanics, and visual integration.

---

## 1. Core Principles & Architecture

The engine is built on a "Logic-First" philosophy, ensuring that the game's "brain" is entirely decoupled from its "body" (the UI).

Every line of code must adhere to these four non-negotiable principles:

* **The Referee is Absolute (Headless-First)**: All game logic must run in a pure Node.js environment without a DOM. If it doesn't work in a headless script, it's broken.
* **Determinism or Death**: All logic, including RNG (Mulberry32) and AI, must be bit-for-bit identical across environments based on an `initialSeed`.
* **State is a River (Immutability)**: The `gameReducer` returns a fresh state object every turn, enabling "Infinite Undo" and frame-perfect replays.
* **Logic Before "Juice"**: The engine only emits **Atomic Effects** (Damage, Displace, Stun). The frontend interprets these to create animations.

**Repository Structure (Monorepo)**:

* `packages/engine`: Pure TypeScript game logic (The "Referee").
* `packages/shared`: Common types and constants.
* `apps/web`: React/PixiJS frontend (The "Juice").
* `apps/server`: Node.js backend for validation and leaderboards.

---

## 2. Technical Architecture: ECS-Lite

We use a formalized **ECS-Lite** structure to separate data from logic.

* **Entities (Actors)**: Thin data containers identified by a persistent ID.
* **Components**: Strictly typed data blocks (e.g., `PhysicsComponent`, `HealthComponent`) stored in a `Map`.
* **Systems**: Pure functions in `src/systems/` that process components (e.g., `movement.ts`, `combat.ts`). - IN PROGRESS, still need to move more files to the folder.
* **Spatial Data**: Occupancy lookups use **BigInt bitmasks** for speed, but the physical world properties (Lava, Walls, Snare) are managed by the **Unified Tile Map**.
---

## 3. Tile Effects System (Observer-Based)

The engine has transitioned from action-driven effects to an **observer-based** architecture where tiles monitor units passing over or landing on them.

### Core Hooks

* **`onPass(context)`**: Triggered when a unit moves **through** a tile. Used for mid-slide damage or momentum modifications (e.g., Lava viscosity slowing a push).
* **`onEnter(context)`**: Triggered when a unit's movement **terminates** on a tile. Used for landing damage or status application (e.g., sinking into Lava).

### Momentum & Physics

Tiles can actively modify the `remainingMomentum` of a kinetic request:

* **Lava**: Reduces momentum by 2 (viscosity).
* **Ice**: Preserves momentum (no friction).
* **Snare Trap**: Sets momentum to 0 (immediate stop).

---

## 4. The Juice System

"Juice" is the sensory vocabulary the engine uses to communicate **Intent, Impact, and Weight** to the player. Every skill follows a 4-phase signature:

| Phase | Description | Example Effects |
| --- | --- | --- |
| **1. Anticipation** | Pre-action telegraphs | Aiming lasers, trajectory arcs, charge-up vortexes |
| **2. Execution** | The action in progress | Projectile trails, motion blur, cable tension |
| **3. Impact** | The moment of collision | Screen shake, freeze frames, particle explosions, "IMPACT!" text |
| **4. Resolution** | Aftermath and settling | Kinetic shockwaves, status bursts, settling dust |

### Key "Juice" Signatures

* **Shield Throw**: Blue trajectory arc → 720° spinning animation → Heavy impact + high shake + freeze frame.
* **Grapple Hook**: Green laser → Hook cable with tension wobble → Winch effect on swap.
* **Lava Sink**: Lava ripple + high shake + "CONSUMED" combat text.

---

## 5. Smooth Movement & Displacement

Units no longer "teleport" between hexes. Every displacement effect includes a full `path` array.

**Displacement Structure**:

```typescript
{
    type: 'Displacement',
    target: 'player-1',
    destination: { q: 5, r: 3, s: -8 },
    path: [{ q: 3, r: 3, s: -6 }, { q: 4, r: 3, s: -7 }, { q: 5, r: 3, s: -8 }],
    animationDuration: 180 // Speed varies by skill (Dash is fast, Vault is slow)
}

```

**Timing Recommendations**:

* **Dash**: 60ms per tile (aggressive).
* **Kinetic Pulse**: 80ms-100ms per tile (forceful).
* **Vault**: 250ms total for the parabolic arc.

---

## 6. Development & Testing

* **Scenario-Driven Testing**: All new mechanics should have a test case in `packages/engine/src/scenarios/`.
* **Determinism Validation**: Use the `validateReplay` script to ensure that engine changes don't break existing `ActionLog` replays.
* **Running Tests**: `npm test` or `npx vitest run` to verify the "Juice" stream and logic parity.



## 7. Technical Architecture: ECS-Lite

We use a formalized **ECS-Lite** structure to separate data from logic.

* **Entities (Actors)**: Thin data containers identified by a persistent ID.
* **Components**: Strictly typed data blocks (e.g., `PhysicsComponent`, `HealthComponent`) stored in a `Map`.
* **Systems**: Pure functions in `src/systems/` that process components (e.g., `movement.ts`, `combat.ts`). - IN PROGRESS, still need to move more files to the folder.
* **Spatial Bitmasks**: High-speed occupancy lookups use **BigInt bitmasks** to represent the **Flat-Top Hex Grid**.

---

## 8. UI/UX: The Strategic Wrapper

The out-of-combat experience must feel as robust as the tactical grid.

* **Strategic Hub**: The main SPA entry point for loadout selection and meta-progression.
* **Tactical Academy**: Interactive tutorials generated from the `src/scenarios/` registry.
* **The Replay Gallery**: Uses the `ActionLog` to re-simulate matches bit-for-bit.
* **The Preview System**:
* **Level 1 (Movement)**: BFS-based "Bloom" showing reachable hexes and 1-tile threat rings.
* **Level 2 (Targeting)**: Axial "Star" patterns with Line-of-Sight shadowing.



---

## 9. Quality & Validation Pipeline

* **Scenario-Driven TDD**: Every skill must be accompanied by a tactical test in `src/scenarios/`.
* **Fuzz Testing**: A headless script performs 10,000+ random actions to ensure no illegal states occur.
* **Server Validator**: A Node.js CLI to verify `ActionLog` authenticity before leaderboard submission. - TO DO

### Quality Gates
A PR is not ready for review if:
* `npx knip` reports unused exports or files in the new logic.
