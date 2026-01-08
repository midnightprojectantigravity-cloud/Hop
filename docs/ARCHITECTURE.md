# Project Architecture: The "Gold Standard" Tech Stack

This document outlines the core architectural pillars of the project, designed for world-class performance, stability, and extensibility.

## 1. Logic: Immutable State + Command Pattern
The game engine is built as a pure, deterministic state machine.
- **Immutable State:** The `GameState` is never mutated. Every action produces a new state object.
- **Command Pattern:** Every user or AI action is encapsulated as a `Command`. 
- **State Deltas:** Every command generates a `StateDelta` (the difference between old and new state). This enables **Infinite Undo** and extremely small **Replay files**.

## 2. Validation: TDD for Scenarios + Fuzzing
Reliability is enforced through a multi-tier testing strategy.
- **Scenario TDD:** Skills are defined alongside `scenarios` (see `src/game/skills/`). These test specific tactical interactions (e.g., "Chain-stun into a wall") automatically.
- **Behavioral Fuzzing:** A automated script (`src/scripts/fuzzTest.ts`) performs thousands of random actions to ensure the engine never reaches an invalid state or crashes.

## 3. Performance: Spatial Hashing & Bitmasks
High-frequency calculations (like AI move simulations) are optimized for speed.
- **Occupancy Mask:** Uses `BigInt` bitmasks to represent the grid. 
- **Constant Time Lookups:** Checking if a tile is occupied is a simple bitwise AND operation, allowing the engine to simulate thousands of turns per second.

## 4. Meta: Strategic Hub & Serialized Loadouts
Pre-game and meta-progression are fully data-driven.
- **Loadouts:** Players can choose from different character configurations (e.g., *Skisher*, *Vanguard*, *Sniper*).
- **Serialization:** All system state, including loadouts and character progress, is serializable to JSON for easy storage and cloud-sync.

## 5. ECS-Lite: Actor-Component Model
Entities follow a "Data-over-Logic" approach.
- **Actors:** Entities (Player, Enemies) store raw data and a dynamic `components` record.
- **Pure Systems:** Logic is handled by stateless functions that operate on these data structures.
- **Interceptors:** A middleware pipeline (`runInterceptors` in `effectEngine.ts`) allows status effects and items to dynamically modify game effects before they are applied.
