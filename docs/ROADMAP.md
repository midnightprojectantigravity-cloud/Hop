# Hop - Development Roadmap

*Updated: January 9, 2026*

This document outlines the expansion plan for Hop, focusing on deterministic engine scaling, procedural generation, and high-fidelity arcade "Juice."

---

## 🟢 Phase 0: The "World-Class" Foundation (Completed)

Before expanding content, we finalized the core engine reliability to ensure leaderboard integrity.

| Milestone | Description | Status |
| --- | --- | --- |
| **Monorepo Migration** | Decouple `@hop/engine` from the UI for server-side validation. | 🏗️ In Progress |
| **Deterministic Command-Stream** | Ensure all state changes are driven by a serializable `ActionLog`. | ✅ Done |
| **Multi-Condition TDD** | Implement stress-scenarios for `AUTO_ATTACK` (Persistence/Friendly Fire). | ✅ Done |
| **Bitmask Occupancy** | Optimize grid lookups for AI MCTS simulations. | ✅ Done |
| **Initiative Queue System** | Per-actor granular turns and persistence tracking. | ✅ Done |
| **Theme Logic (Slippery/Void)** | Interceptor-based floor hazard system. | ✅ Done |
| **Initiative Queue UI** | Visual representation of turn order in the sidebar. | ✅ Done |

---

## Phase 0.5: Executable Documentation (Integration)
Before moving to the "Void" theme, we must bridge the gap between Tutorial and Test.

- [ ] **Scenario Engine**: Build the `ScenarioLoader` that can ingest JSON board states.
- [ ] **Tutorial Porting**: Convert existing onboarding steps into verified Scenarios.
- [ ] **Balance Benchmarking**: Create a "DPS Stress Room" scenario that outputs damage-per-turn metrics for all skill loadouts to assist in Skill Power Assessment.

---

## Phase 1: Expanded Enemy Types (Unified Actor System)

| Type | HP | Behavior | Status |
| --- | --- | --- | --- |
| **Footman** | 2 | Melee, moves toward player; uses **Punch** passive | ✅ |
| **Archer** | 1 | Ranged (axial) | ✅ |
| **Shield Bearer** | 3 | Slow, blocks front via **Interceptor Middleware** | ✅ |
| **Assassin** | 1 | Stealth Melee; ignores `AUTO_ATTACK` while hidden | ✅ |
| **Golem** | 4 | Heavy Line Attack; moves every 2nd turn | ✅ |

#### 👑 The Demon Lord (End-of-Run Boss)

The Boss is built using the **Phase Transition** logic in the engine:

* **Phase 1 (100% HP)**: Ranged Fireballs (Telegraphed).
* **Phase 2 (50% HP)**: Summons 2 Footmen; triggers **Enrage** interceptor (Double Damage).
* **Phase 3 (25% HP)**: Melee rampage; moves 2x speed.

---

## Phase 2: Procedural "Room-Based" Generation

We are moving away from simple random placement to a **Prefab-Room Graph** system (Diablo 2 style).

### Room Types (Prefabs)

* **Entrance**: Safe zone with 0 hazards.
* **Ambush Room**: Triggers enemy spawns when player reaches the center.
* **The Crucible**: High lava density with a guaranteed Shrine.
* **Boss Arena**: Fixed 30-hex circular arena with pillars (Obstacles).

### Theming System

| Floors | Theme | Mechanic | Status |
| --- | --- | --- | --- |
| **1-4** | Catacombs | Standard Stone/Lava. | ✅ |
| **5-7** | Frozen Depths | **Slippery Tiles**: Moving causes you to slide 2 hexes. | ✅ |
| **8-10** | The Void | **Void Tiles**: Step here and lose 1 max HP (Permanent). | ✅ |

---

## Phase 3: "The Juice" & Visual Events

The engine emits `VisualEvents` that the UI interprets to create a high-end arcade feel.

* [x] **Impact Freeze**: 50ms-100ms game pause on a killing blow.
* [x] **Screen Shake**: Linear (for punches) vs. Radial (for explosions).
* [ ] **Dynamic Combat Text**: Critically-sized numbers that "pop" and fade.
* [x] **Initiative Queue UI**: A visual sidebar or floating icons showing the current turn order.
* [ ] **Turn Transition VFX**: Subtle highlights on the actor whose turn is resolving.
* [ ] **Ghosting**: Leave a trail of blue transparent sprites when using `JUMP` or `BLINK`.

---

## Phase 4: Progression & Meta Systems

### Deterministic Leaderboard

* **Replay Verification**: The server runs the `ActionLog` through the `@hop/engine` package to confirm the final score.
* **Daily Seed**: Every 24 hours, a global seed is generated so everyone plays the exact same map layout.

### Character Archetypes

Players choose a "Loadout" of 3 starting skills:

* **The Hoplite**: Spear / Shield / Jump.
* **The Wraith**: Dagger / Blink / Stealth.
* **The Pyromancer**: Fireball / Flame-Dash / Fire-Aura.

---

## Phase 5: Progression & Meta Systems (Updated)
- **Verified Achievements**: Achievements like "Untouchable" are verified by the server re-running the `ActionLog` against the **Scenario Engine** to ensure no state-tampering occurred during the run.

---

## Implementation Priority

### High Priority (Next Sprint)

1. 🏆 **Verification Pipeline**: Finalize the `apps/validator` Node.js script. (Monorepo Migration)
2. 🧠 **AI Upgrade**: Implement MCTS (Monte Carlo Tree Search) for enemies on Floors 7+.
3. 📦 **Scenario Engine**: Build the `ScenarioLoader` for JSON board states.

### Completed ✅

1. **Command-Stream Architecture**: Infinite undo and tiny replay files.
2. **Unified Skill System**: Skills work identically for players and enemies.
3. **Initiative Queue System**: Granular turns and deterministic turn ordering.
4. **Theme Logic (Slippery/Void)**: Interceptor-based floor hazard system.
5. **Initiative Queue UI**: Visual representation of turn order in the sidebar.