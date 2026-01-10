Here is the updated `GAME_MECHANICS.md` file, incorporating the **Deterministic Monorepo** architecture, the **Command-Stream** model, and the **Scenario-Driven Verification** strategy.

---

# Hop - Game Mechanics Documentation

*Last Updated: January 9, 2026 (v4.0 - Monorepo & Deterministic Command-Stream)*

**✅ WORLD-CLASS STATUS**: Unified Actor Skill System, 10-Level Arcade Progression, Bitmask Performance, Deterministic Replay Verification, Scenario-Driven Testing.

---

## Table of Contents

1. [Architecture Overview]
2. [Core Systems]
3. [Entities & Unified Actor Model]
4. [Initiative & Turn Management]
5. [Command-Stream & Determinism]
6. [Scenario-Driven Verification]
7. [Enemy AI & Skills]
8. [Game Flow & Arcade Mode]
9. [Special Tiles & Hazards]
10. [Combat & Effect Pipeline]
11. [Replay & Validation System]

---

## Architecture Overview

The project follows a **Deterministic Monorepo** pattern, decoupling the "Referee" (Headless Engine) from the "Juice" (UI/Frontend).

### Monorepo Structure

```text
/packages
├── /engine         # Pure Headless Logic (Hex math, Reducers, PRNG)
├── /shared         # Type definitions and Command schemas
/apps
├── /web-arcade     # React/PixiJS (The "Juice" and Visual Event listener)
└── /validator      # Node.js (Server-side session verification)

```

**Key Principles:**

* **Deterministic Parity**: The same code runs in the browser and on the server.
* **Immutability**: Every action produces a new state object.
* **Bit-for-Bit Identical**: Replays are guaranteed by identical engine versions.

---

## Core Systems

### Hexagonal Grid (Flat-Top Diamond)

The game uses a **cube coordinate system** (`q`, `r`, `s`) within a strict axial parallelogram bounding box.

| Constraint | Value |
| --- | --- |
| **Columns (q)** |  to  |
| **Rows (r)** |  to  |
| **Visibility** | Must satisfy  |
| **Occupancy** | Represented via **BigInt Bitmasks** for  lookups. |

### Game State

```typescript
interface GameState {
    turn: number;
    floor: number;
    player: Actor;
    enemies: Actor[];
    gameStatus: 'playing' | 'won' | 'lost' | 'choosing_upgrade';
    turnsSpent: number;
    actionLog: Action[]; // The "DNA" of the session
    initialSeed: string; // Source of all entropy
    rngCounter: number;  // PRNG consumption tracker
    initiativeQueue: InitiativeQueue; // Per-actor turn order
}

interface InitiativeQueue {
    entries: InitiativeEntry[];
    currentIndex: number;
    round: number;
}

interface InitiativeEntry {
    actorId: string;
    initiative: number;
    hasActed: boolean;
    turnStartPosition?: Point; // Captured at start of actor's turn
}

```

---

## Entities & Unified Actor Model

All entities share the **Actor** interface, allowing skills to be assigned interchangeably to players or enemies.

```typescript
interface Actor {
    id: string;
    factionId: 'player' | 'enemy';
    position: Point;
    hp: number;
    maxHp: number;
    activeSkills: SkillInstance[]; // Skill logic + cooldowns
    statusEffects: Status[];       // Shield, Stun, Stealth
}

```

### Enemy Archetypes (Skill-Based)

* **Footman**: Equips `AUTO_ATTACK` + `BASIC_MOVE`. (Initiative: 50)
* **Archer**: Equips `AXIAL_STRIKE` (Telegraphed). (Initiative: 60)
* **Shield Bearer**: Equips `FRONTAL_SHIELD` (Interceptor logic). (Initiative: 40)
* **Bomb**: Self-destruct cooldown. (Initiative: 10)

---

## Initiative & Turn Management

The game has transitioned from a global "batch" turn model to a **Granular Per-Actor Turn System**.

### 1. Initiative Scores
Every actor (player and enemy) has an initiative score. Higher scores act earlier in the round.
- **Player**: 100 (Default first)
- **Fast Enemies**: 55-70
- **Slow Enemies**: 30-40
- **Environmental Hazards (Bombs)**: 10 (Usually last)

### 2. The Turn Cycle
A "Round" consists of every actor in the `initiativeQueue` taking their individual turn.
1. The engine identifies the actor with the highest initiative who hasn't acted.
2. If it's the **Player**, the engine pauses for input.
3. If it's an **Enemy**, the engine resolves their full turn (AI Movement -> Skill Usage -> End-of-Turn Effects).
4. The cycle continues until all actors have marked `hasActed: true`.

### 3. Turn Start Position Tracking
At the moment an actor's turn begins, their current position is saved in the `InitiativeEntry`. This is critical for **Persistence-based mechanics**:
- **Auto-Attack (Punch)**: Only triggers if the target was adjacent at the *start* of the acting entity's turn AND remains adjacent at the *end* of that same turn.
- This prevents "Drive-by Punches" where an enemy moves past you but was never there when their turn actually started.

---

## Command-Stream & Determinism

The engine is a reducer: `(State, Action) => NewState`. It does not "play" the game; it "reduces" inputs.

### RNG Guarantee

The engine uses **Mulberry32** seeded with `initialSeed`. Every random event (AI tie-breaks, spawns) calls `consumeRandom()`, which increments the `rngCounter`. Matching the seed and counter guarantees identical results.

---

## Scenario-Driven Verification

To guarantee mechanics remain balanced and tutorials are always functional, we use **Executable Documentation**.

### The Scenario Object

```typescript
interface Scenario {
  id: string;          // e.g., 'tutorial_spear_recall'
  map: HexGridData;    // Specific tile/hazard layout
  actors: ActorData[]; // Initial positions and health
  requiredAction: Action; 
  verify: (state: GameState) => boolean;
}

```

**Benefits:**

* **Tutorials as Tests**: Running `npm test` "plays" the tutorials to ensure they are still winnable.
* **Multi-System Interaction**: Scenarios test how a *Shield Bash* into a *Bomb* next to a *Lava* pit works.

---

## Combat & Effect Pipeline

Combat uses a **Middleware Interceptor** pattern.

1. **Trigger**: Skill generates an `AtomicEffect` (e.g., Damage: 1).
2. **Interception**: Target's `statusEffects` are checked (e.g., "Shield" reduces damage to 0).
3. **Resolution**: Final state is applied.

---

## Replay & Validation System

### 1. Zero-Latency Play

The `web-arcade` app uses the engine locally for instant feedback and "Juice" (impact freezes/shakes).

### 2. Server Validation

On session end, the `ActionLog` and `initialSeed` are sent to the `validator`. The server re-runs the simulation; if the final state matches the client's reported score, the session is saved.

### 3. Leaderboard Replays

Players watch replays by downloading another user's `ActionLog` and feeding it into their local engine.

---

## Summary

The Hop engine is a **Simulation-First** architecture. By separating the logic into a dedicated package and using scenarios for verification, the game achieves high performance, cheat-proofing, and immortal tutorials.