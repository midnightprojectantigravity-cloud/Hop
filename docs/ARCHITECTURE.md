# Project Architecture: The "Gold Standard" Tech Stack

*Last Updated: January 9, 2026 (v4.0 - Monorepo & Deterministic Command-Stream)*

This document outlines the core architectural pillars of the project, designed for world-class performance, stability, and extensibility.

## 1. Distribution: Deterministic Monorepo

The project is structured as a **Workspace-based Monorepo** (pnpm/Turborepo) to ensure the "Referee" (the engine) is identical across all environments.

* **Shared Logic:** The `@hop/engine` package is a pure TypeScript module imported by both the Client and the Server.
* **Client-Side Simulation:** The browser runs the engine locally for zero-latency gameplay and instant "Juice" feedback.
* **Server-Side Validation:** The server re-runs the `ActionLog` through the same engine package to verify scores and prevent cheating.
* **Deterministic Replays:** Replays are simply a "Play-by-Play" script (ActionLog + Seed) reduced by the engine.

TODO:
* Move from a flat src/ structure to a workspace-based monorepo (e.g., via pnpm or Turborepo).
* New Directory Map:
packages/engine: The "Penthouse." Contains pure, headless, deterministic game logic. Zero dependencies on React, DOM, or PixiJS.
* packages/shared: Shared TypeScript interfaces, Action schemas, and grid constants.
* apps/web-arcade: The "Juice." React/Vite frontend. Imports @hop/engine for local simulation.
* apps/validator: The "Referee." Node.js backend. Imports @hop/engine to re-run ActionLogs and verify scores.

## 2. Logic: Command Stream & Immutable State

The game engine acts as a pure reducer that transforms state based on a stream of serializable commands.

* **Action Log (The DNA):** Instead of saving state snapshots, we save the `initialSeed` and an array of `Actions`.
* **Immutable State:** The `GameState` is never mutated. Every action produces a new state object, enabling **Infinite Undo**.
* **State Deltas:** Every command generates a `StateDelta`. This allows for microscopic replay files and easy synchronization.

## 3. Scheduling: Initiative-Based Granular Turns

The game loop has been upgraded from a batch-turn model to a granular, per-actor initiative system.

* **Initiative Queue:** Defined in `src/game/initiative.ts`. It governs the exact order of actions based on actor speed and status effects.
* **Deterministic Sequencing:** By resolving turns one-by-one, the engine can accurately track "Turn Start" vs "Turn End" positions, enabling deep tactical mechanics like **Persistence-based Auto-Attacks**.
* **Individual Turn Resolution:** Each actor processes their own AI, telegraphed attacks, and environmental effects (like Lava) during their specific slice of the round.

## 4. Validation: Scenario TDD & Behavioral Fuzzing

Reliability is enforced through a "Simulation-First" testing strategy.

* **Scenario-as-Code:** Skills are defined alongside their own tactical tests.
* **Stress Scenarios:** Tests validate complex clusters (e.g., verifying that `AUTO_ATTACK` correctly handles persistence, friendly fire, and "new neighbor" logic in a single turn).
* **Behavioral Fuzzing:** A headless script performs 10,000+ random actions per CI/CD cycle to ensure the engine never reaches an invalid state (e.g., two actors on one hex).

## 4. Performance: Spatial Hashing & Bitmasks

High-frequency calculations, such as AI MCTS (Monte Carlo Tree Search) simulations, are optimized for bare-metal speed.

* **Occupancy Mask:** Uses `BigInt` bitmasks to represent the 9x11 grid.
* **Bitwise Collision:** Checking if a tile is occupied or if a "Fireball" hits a wall is a constant-time bitwise `AND` operation. This allows the AI to simulate thousands of potential futures per second.

## 5. ECS-Lite & Effect Interceptors

Entities follow a "Data-over-Logic" approach, using a middleware-inspired effect pipeline.

* **Data-Driven Actors:** Entities are simple data blobs. Logic is handled by pure "Systems."
* **Effect Pipeline (Middleware):** `AtomicEffects` (Damage, Push, Stun) pass through an **Interceptor Pipeline**.
* **Dynamic Interaction:** Status effects (like "Stealth" or "Shield") can "intercept" a Damage effect and modify its value or cancel it entirely before it hits the state.

## 6. Meta: Strategic Hub & Arcade Progression

The 10-level arcade experience is governed by a data-driven escalation curve.

* **Archetype Composition:** Players choose a loadout of 3 equipment pieces. Each piece provides specific `AtomicEffects`.
* **Procedural Drafting:** Mid-run upgrades are injected into the `SkillDefinition` variables (e.g., increasing `Spear` range), which the engine respects deterministically.
* **Unified Actor Logic:** Because skills are unified, any enemy can technically equip a "Player" skill, allowing for rapid creation of Elite variants and Bosses.

## 7. Verification: Scenario-Driven Architecture
We separate **Tactical Scenarios** from the core logic to allow for multi-system testing and tutorial synchronization.

- **Dedicated Scenario Directory:** Tests no longer live inside skill files. They reside in `packages/engine/tests/scenarios/`. This allows testing interactions between multiple skills, hazards (Lava), and AI behaviors in one board setup.
- **Tutorial-as-Test (Executable Docs):** Tutorials are stored as `Scenario` objects. Every time `npm test` runs, the engine "plays" the tutorial to ensure it is still winnable and accurate.
- **Scenario DSL:** A helper utility allows developers to spawn a board state in seconds:
  `setupScenario({ player: [0,0], enemies: [{ type: 'Archer', pos: [3,0] }] })`