# Tactical Roguelike: Game Design Document
**Inspired by:** *Hoplite* and *Enyo* **Platform:** Mobile (Portrait)


---

## 1. Map & Grid Specifications
The game uses a tight, tactical grid designed for mobile screens to ensure every move is visible without scrolling.

* **Orientation:** Vertical / Portrait.
* **Grid Type:** Hexagonal (Flat-Top).
* **Dimensions:** 9 tiles wide × 11 tiles high.
* **Map Shape:** Diamond (shaved corners).
* **Starting positions:** Player at the bottom of the map, stairs at the top.
* **Hazards:** Approximately 15-20% of the map should consist of "Void/Lava" tiles to encourage environmental kills.

---

## 2. Visual & UI Color Palette
High contrast is used to ensure readability on small screens.

 Element: Hex/Color - Visual Treatment - walkable
 **Player**: Blue - Bright white border; pulsing glow. - No
 **Enemy**: Red - Diamond shape for Melee; Triangle for Ranged. - No
 **Floor**: Olive Green - Subtle texture; matte finish. - Yes
 **Wall**: Dark Grey - Elevated 3D look; blocks movement/vision. - No
 **Lava/Void**: Dark Red - "Sunken" appearance; glowing edges. - No
 **Shrine**: Orange - Crystal or Pillar icon. - Yes
 **Portal/Stairs**: White - Swirling animation; highest brightness. - Yes

---

## 3. Skill System Overview
Players have 3 skill slots. Each skill can be upgraded via **Shrines**.
  a. 1 offensive skill (default is throw spear)
  b. 1 defensive skill (default is shield bash)
  c. 1 utility skill (default is jump)
  d. Punch: passive skill, hits enemies that were next to the player at begining of turn and are still next to the player at end of turn (works)
1. Spear
  a. Spear throw: active skill, can be thrown at tiles (with or without an enemy)
    i. kills in 1 hit
    ii. cooldown = disabled until picked up
    iii. can be picked up and thrown again
    iv. initial range = 2 tiles
  b. upgrades
    i. range increases
    ii. Recall: the spear automatically flies back to your hand after being thrown.
    iii. Recall2: as the spear flies back to your hand, it damages everything in the return path, but this costs a turn.
    iv. Lunge: move toward an enemy 2 tiles away performs a "Lunge" kill (only works with spear in hand)
    v. Lunge2: Lunge hits 3 enemies in an arc centered in the direction of the lunge (only works with spear in hand)
    vi. Deep Breath: killing an enemy with a spear throw or Lunge resets Jump cooldown
    vii. Cleave: picking up the spear hits all adjacent enemies
2. Shield
  a. Shield bash: active skill, initial use is to push 1 enemy 1 tile
    i. cooldown = 2 turns
    ii. can be used on tiles (with or without an enemy)
    iii. push an enemy/object(eg.: bomb) x tiles
    iv. initial range = 1 tile
  b. upgrades
    i. range increases
    ii. cooldown decreases
    iii. Arc Bash: bash hits a 3-hex frontal arc simultaneously, but increases cooldown by 1 turn
    iv. 360° Bash: bash hits all neighbors simultaneously, but increases cooldown by 1 turn
    v. Passive Protection: grants +1 temporary armor (first hit is nullified every turn), only when shield is not in cooldown
    vi. Wall Slam: If an enemy is bashed into a Wall or another Enemy, they are Stunned for 1 turn.
3. Jump
  a. Leap over to an empty tile
    i. initial range = 2 tiles
    ii. cooldown = 2 turns
    iii. Void Crossing: Jump allows to cross Lava/Void tiles but not obstacles.
  b. upgrades
    i. range increases
    ii. cooldown decreases
    iii. Stunning Landing: All enemies within 1 hex of landing are stunned
    iv. Meteor Impact: Can land on a tile occupied by an enemy, instantly killing it
    v. Free jump: Can move after a jump

---

## 4. Core Gameplay Loop
1.  **Move/Act:** Player moves one tile OR uses a skill. 
2.  **Environmental Check:** If an enemy was pushed/pulled into Lava/Void, they are destroyed.
3.  **Enemy Turn:** All enemies move or attack simultaneously based on their AI pattern.
4.  **Progression:** Reach the **Stairs (White)** to move to the next floor. Shrines appear on every floor.

---

## 5. Core Requirements
1.  **Headless Engine:** The game should be able to run without a UI. 
2.  **Progression:** The game should be able to save and load the player's progress.
3.  **Replay:** The game should be able to replay a game from a saved state.
4.  **Leaderboard:** The game should be able to display a leaderboard of the top players.

---