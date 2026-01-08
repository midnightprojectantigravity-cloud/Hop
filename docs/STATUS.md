# Tactical Roguelike: Game Design Document
**Inspired by:** *Hoplite* and *Enyo* **Platform:** Mobile (Portrait)


---

## 1. Map & Grid Specifications
The game uses a tight, tactical grid designed for mobile screens to ensure every move is visible without scrolling.

* **Map & Grid Specifications:**
    *   **Grid:** Hexagonal flat-top, axial coordinates. (Done)
    *   **Map Shape:** Diamond (shaved corners). (Done)
    *   **Grid dimensions:** 9 wide x 11 high (standard mobile view). (Done)
* **Starting positions:** Player at the bottom of the map, stairs at the top. (Done)
* **Hazards:** Approximately 15-20% of the map should consist of "Void/Lava" tiles to encourage environmental kills. (Done)

---

## 2. Visual & UI Color Palette (Done):
*   Background (Void): `#030712` (Slate-950)
*   Floor Tiles (Stone): `#4b5563` (Slate-600)
*   Wall/Obstacle: `#1f2937` (Slate-800)
*   Lava/Hazard: `#991b1b` (Red-800)
*   Standard Player (Blue): `#3b82f6` (Blue-500)
*   Standard Enemy (Red): `#ef4444` (Red-500)
  
Element: Hex/Color - Visual Treatment - walkable
  **Player**: Blue - Square SVG shape. - No (Done)
  **Enemy**: Red - Based on type (Footman, Archer, Bomber). - No (Done)
  **Floor**: Olive Green - Subtle texture; matte finish. - Yes (Done)
  **Wall**: Dark Grey - Blocks movement/vision. - No (Done)
  **Lava/Void**: Dark Red - "Bubbley" appearance; glowing edges. - No (Done)
  **Shrine**: Orange - Crystal or Pillar SVG shape. - Yes (Done)
  **Portal/Stairs**: White - Stairs SVG shape. - Yes (Done)

---

## 3. Skill System Overview
Players have 3 skill slots. Each skill can be upgraded via **Shrines**.
  * 1 offensive skill (default is throw spear) (Done - integrated as separate action)
  * 1 defensive skill (default is shield bash) (Done)
  * 1 utility skill (default is jump) (Done)
  **Passive: Punch:** Enemies that remain adjacent to you at the end of your turn take 1 damage. (Done)
1. Spear
  * **Spear throw:** active skill, can be thrown at tiles (with or without an enemy)
    *   kills in 1 hit (Done)
    *   cooldown = disabled until picked up (Done)
    *   can be picked up and thrown again (Done)
    *   initial range = 2 tiles (Done)
  * upgrades
    *   range increases (Done)
    *   Recall: the spear automatically flies back to your hand after being thrown. (Done)
    *   Recall2: as the spear flies back to your hand, it damages everything in the return path, but this costs a turn. (Done)
    *   Lunge: move toward an enemy 2 tiles away performs a "Lunge" kill (only works with spear in hand) (Done)
    *   Lunge2: Lunge hits 3 enemies in an arc centered in the direction of the lunge (only works with spear in hand) (Done)
    *   Deep Breath: killing an enemy with a spear throw or Lunge resets Jump cooldown (Done)
    *   Cleave: picking up the spear hits all adjacent enemies (Done)
2. Shield
  * Shield bash: active skill, initial use is to push 1 enemy 1 tile
    *   cooldown = 2 turns (Done)
    *   can be used on tiles (with or without an enemy) (Done)
    *   push an enemy/object(eg.: bomb) x tiles (Done)
    *   initial range = 1 tile (Done)
  * upgrades
    *   range increases (Done)
    *   cooldown decreases (Done)
    *   Arc Bash: bash hits a 3-hex frontal arc simultaneously, but increases cooldown by 1 turn (Done)
    *   360° Bash: bash hits all neighbors simultaneously, but increases cooldown by 1 turn (Done)
    *   Passive Protection: grants +1 temporary armor (first hit is nullified every turn), only when shield is not in cooldown (Done)
    *   Wall Slam: If an enemy is bashed into a Wall or another Enemy, they are Stunned for 1 turn. (Done)
3. Jump
  * Leap over to an empty tile
    *   initial range = 2 tiles (Done)
    *   cooldown = 2 turns (Done)
    *   Void Crossing: Jump allows to cross Lava/Void tiles but not obstacles. (Done)
  * upgrades
    *   range increases (Done)
    *   cooldown decreases (Done)
    *   Stunning Landing: All enemies within 1 hex of landing are stunned (Done)
    *   Meteor Impact: Can land on a tile occupied by an enemy, instantly killing it (Done)
    *   Free jump: Can move after a jump (Done)

---

## 4. Core Gameplay Loop
1.  **Move/Act:** Player moves one tile OR uses a skill. (Done)
2.  **Environmental Check:** If an enemy was pushed/pulled into Lava/Void, they are destroyed. (Done)
3.  **Enemy Turn:** All enemies move or attack simultaneously based on their AI pattern. (Done)
4.  **Progression:** Reach the **Stairs (White)** to move to the next floor. Shrines appear on every floor. (Done)

---

## 5. Core Requirements
1.  **Headless Engine:** The game should be able to run without a UI. (Done)
2.  **Progression:** The game should be able to save and load the player's progress. (Done - via StateDelta/Command Pattern)
3.  **Replay:** The game should be able to replay a game from a saved state. (Done - via commandLog)
4.  **Leaderboard:** The game should be able to display a leaderboard of the top players. (Done)
5.  **"Gold Standard" Tech Stack:** (Done)
    *   Logic: Immutable State + Command Pattern
    *   Validation: TDD for Scenarios + Fuzzing
    *   Performance: Spatial Hashing / Bitmasks
    *   Meta: Strategic Hub with serialized Loadouts
104:     *   **"The Juice"**: View-Model Event pipeline (shake, freeze, text). (Done)
105:     *   **Arcade Loop**: 10-level tactical escalation. (Done)

---

## 6. Enemy Archetypes
*   **Footman:** Diamond SVG shape; Moves 1 tile toward player; uses the **Punch** passive skill. (Done)
*   **Archer:** Triangle SVG shape; Maintains a 3-tile distance; fires in straight hex-lines. (Done)
*   **Bomber:** Circle SVG shape; Throws bombs (smaller circle SVG shape for bombs) at the player, range = 2 tiles, bomb explodes after 2 turns. (Done)

---

## 7. Scoring & Meta-Progression
*   **Score:** (Level × 1000) + (TurnsRemaining × 50) - (DamageTaken × 10). (Done)
*   **Achievements:** Unlock new starting skill loadouts (e.g., "Hook" instead of "Spear") by completing specific challenges. (To Do)
*   **Leaderboard:** Global rankings tracking "Max Floor" and "Total Score." (Done - Local/Replay based)

---

## 8. Developer Suggestions & Adjustments (Updated)
1.  **Compositional Skill Framework:** (In Progress) Most skills are now in `src/game/skills/`. Final evacuation of legacy `skills.ts` is required.
2.  **State Delta Optimization:** Current deltas are snapshots. Suggest transitioning to JSON-patching for massive replay files.
3.  **AI Simulation:** Use `occupancyMask` (Goal 3) for the next iteration of Monte Carlo Tree Search (MCTS) AI.
4.  **Persistence:** Character loadouts are serialized. Implement a robust cloud-sync strategy for meta-progression.