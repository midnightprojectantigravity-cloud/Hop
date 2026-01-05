# Hop - Game Mechanics Documentation

*Last Updated: January 2, 2026 (v3.0 - Spear & Shield Expansion)*

**✅ IMPLEMENTED**: 7+ Enemy types, 3-slot Skill System (Offensive/Defensive/Utility), 15+ Upgrades, Visual FX (Lava bubbles, Shrines, smooth transitions), Replay & Scoring.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Systems](#core-systems)
3. [Entities](#entities)
4. [Player Actions](#player-actions)
5. [Enemy AI](#enemy-ai)
6. [Game Flow](#game-flow)
7. [Special Tiles](#special-tiles)
8. [Upgrades](#upgrades)
9. [Combat System](#combat-system)
10. [RNG & Determinism](#rng--determinism)
11. [Replay System](#replay-system)
12. [Known Issues & Recommendations](#known-issues--recommendations)

---

## Architecture Overview

The game follows a **functional, immutable state** pattern using a Redux-like reducer architecture:

```
src/game/
├── types.ts       # Core type definitions (GameState, Entity, Action, Point)
├── logic.ts       # Game reducer and state generation
├── combat.ts      # Combat resolution (telegraphed attacks, enemy turns)
├── enemyAI.ts     # Enemy behavior and decision-making
├── actor.ts       # Actor operations (damage, heal, etc.)
├── helpers.ts     # Utility functions (lava, shrine, stairs checks)
├── hex.ts         # Hexagonal grid math utilities
├── rng.ts         # Deterministic random number generation
├── constants.ts   # Game configuration constants
```

**Key Principles:**
- All state mutations return new objects (immutability)
- Deterministic RNG enables replay functionality
- Actions are recorded to `actionLog` for replay

---

## Core Systems

### Hexagonal Grid

The game uses a **cube coordinate system** (`q`, `r`, `s`) where `q + r + s = 0`.

| Function | Purpose |
|----------|---------|
| `createHex(q, r)` | Creates a hex point (auto-computes `s = -q - r`) |
| `hexEquals(a, b)` | Tests hex equality |
| `hexDistance(a, b)` | Manhattan distance on hex grid |
| `getNeighbors(hex)` | Returns 6 adjacent hexes |
| `getGridCells(radius)` | Returns all hexes within radius |
| `getHexLine(start, end)` | Returns line of hexes between two points |
| `hexToPixel(hex, size)` | Converts hex coords to screen position |

**Grid Configuration:**
- `GRID_WIDTH = 7` (Tiles wide)
- `GRID_HEIGHT = 9` (Tiles tall)
- `TILE_SIZE = 36` pixels for rendering

### Flat-Top Diamond Geometry
The grid follows a strict axial parallelogram bounding box:
- Columns ($q$): $0$ to $6$ (7 tiles wide).
- Rows ($r$): $0$ to $8$ (9 tiles tall).
- Visible hexes must satisfy $0 < q < 7$ and $0 < r < 9$.
- Visible hexes must satisfy $2 < q + r < 12$.
- **Orientation**: Flat-Top hexes. This ensures columns are perfectly straight vertical lines.
- **Vertical Shift**: Each column $(q)$ is shifted vertically by $0.5$ hex height ($q \times 0.5 \times \sqrt{3} \times size$) to create the tilted diamond look.
- **Key Spawns**: Player starts at $(3, 7)$ (bottom center), Stairs at $(3, 0)$ (top center).

### Game State

```typescript
interface GameState {
    turn: number;              // Current turn number
    floor: number;             // Current dungeon floor (1-5)
    player: Entity;            // Player entity
    enemies: Entity[];         // Active enemies
    gridRadius: number;        // Arena size
    gameStatus: 'playing' | 'won' | 'lost' | 'choosing_upgrade';
    message: string;           // UI message
    hasSpear: boolean;         // Player has spear in hand
    spearPosition?: Point;     // Spear location if thrown
    stairsPosition: Point;     // Exit stairs location
    lavaPositions: Point[];    // Hazard tiles
    shrinePosition?: Point;    // Upgrade shrine (every even floor)
    upgrades: string[];        // Collected upgrades
    
    // Determinism/Replay fields:
    rngSeed?: string;          // Seed for this floor
    initialSeed?: string;      // Original run seed
    rngCounter?: number;       // RNG consumption counter
    actionLog?: Action[];      // Recorded actions
    completedRun?: {...};      // Final run data for leaderboard
}
```

---

## Entities

All entities (player and enemies) share the `Actor` interface:

```typescript
interface Actor {
    id: string;
    type: 'player' | 'enemy';
    subtype?: string;           // 'footman', 'archer', 'bomber'
    position: Point;
    hp: number;
    maxHp: number;
    energy?: number;            // Currently unused
    intent?: string;            // 'Attacking!', 'Aiming', 'Bombing', 'Moving'
    intentPosition?: Point;     // Target hex for telegraphed attack
    gear?: { ... };             // Future equipment slots
    skills?: string[];          // Acquired upgrade IDs
    activeSkills?: Skill[];     // Detailed skill objects with cooldowns
    temporaryArmor?: number;    // From Shield upgrades
    isStunned?: boolean;        // From Wall Slam/Jump upgrades
    isVisible?: boolean;        // For Assassin stealth
    facing?: number;            // For Shield Bearer defense
    actionCooldown?: number;    // For Golem/Bomb timers
}
```

### Player

| Property | Value | Notes |
|----------|-------|-------|
| `id` | `'player'` | Fixed identifier |
| `hp` | 3 | Starting health |
| `maxHp` | 3 | Can increase via upgrades |
| `energy` | 100 | Currently unused |
| Start Position | `(0, 0, 0)` | Center of grid |

### Enemies

| Type | HP | Range | Damage | Behavior |
|------|-----|-------|--------|----------|
| **Footman** | 2 | 1 | 1 | Melee. Moves toward player. Uses **Punch** passive. |
| **Archer** | 1 | 4 | 1 | Ranged (axial). Telegraphs shots. |
| **Bomber** | 1 | 3 | 1 | Ranged. Throws bombs that explode after 2 turns. |
| **Sprinter** | 1 | 1 | 1 | Melee. Moves 2 hexes per turn. |
| **Shield Bearer** | 3 | 1 | 1 | Melee. Blocks frontal attacks. Must be flanked. |
| **Warlock** | 2 | 4 | 1 | Ranged. Teleports randomly when approached. |
| **Assassin** | 1 | 1 | 2 | Melee. Invisible until adjacent. |
| **Golem** | 4 | 3 | 2 | Heavy. Moves every other turn. Powerful line attack. |
| **Bomb** | 1 | 1 | 1 | Hazard. Explodes in 2 turns, hitting target + neighbors. |

**Enemy Spawns (Floor 1):**
- Footman at `(0, -2)`
- Archer at `(2, 2)`
- Bomber at `(-2, 0)`

---

## Player Actions

| Action | Type | Payload | Description |
|--------|------|---------|-------------|
| `MOVE` | Basic | `Point` | Move to adjacent hex (distance 1) |
| `LEAP` | Upgrade | `Point` | Jump 1-2 hexes (requires LEAP upgrade) |
| `THROW_SPEAR` | Special | `Point` | Throw spear at target (range 2-4, one-time use) |
| `WAIT` | Basic | None | Skip turn, let enemies act |
| `RESET` | Meta | None | Restart the game from floor 1 |
| `SELECT_UPGRADE` | Meta | `string` | Choose shrine upgrade |
| `LOAD_STATE` | Meta | `GameState` | Load state for replay |

### Action Validation

**USE_SKILL:**
- Dispatched for `SPEAR_THROW`, `SHIELD_BASH`, `JUMP`, or `LUNGE`.
- Enforces range and cooldown.
- **SPEAR_THROW**: Range 2-3 (base). RETRIEVAL required unless RECALL upgraded.
- **SHIELD_BASH**: Range 1. Pushes enemies. Stuns if bashed into walls.
- **JUMP**: Range 2. Crosses lava/void.
- **LUNGE**: Move-attack to enemy 2 tiles away. Requires spear in hand.

**WAIT:**
- Regenerates `temporaryArmor` if Passive Protection is active.
- Advances enemy turns.

### Action Flow

1. Player dispatches action
2. Action is recorded to `actionLog`
3. Action-specific logic executes (movement, combat)
4. `resolveEnemyActions()` processes enemy turn:
   - Resolve telegraphed attacks
   - Apply lava damage
   - Enemies move or prepare attacks
   - Check spear pickup
   - Check shrine/stairs
5. State updates with new turn number

---

## Enemy AI

All enemy AI is in `enemyAI.ts::computeEnemyAction()`.

### Footman AI

```
If distance to player == 1:
    Set intent: "Attacking!" with intentPosition = player position
Else:
    Find neighbor hex that minimizes distance to player
    Move to that hex
    If now adjacent, set intent to attack
```

### Archer AI

```
isInLine = player is on same q, r, or s axis
If isInLine AND distance > 1 AND distance <= 4:
    Set intent: "Aiming" with intentPosition = player position
Else:
    Move toward player (greedy pathfinding)
    After move, check if can aim (same axis, distance 2-4)
```

### Bomber AI

```
targetDistance = 2.5 (prefers being 2-3 hexes away)
If distance >= 2 AND distance <= 3:
    Set intent: "Bombing" with intentPosition = player position
Else:
    Move to minimize |distance - 2.5|
    After move, check if can bomb
```

### Tie-Breaking

When multiple hexes are equally valid moves, the AI uses deterministic RNG (`consumeRandom()`) to select one, ensuring replay consistency.

---

## Game Flow

### Turn Structure

```
1. PLAYER PHASE
   └─ Player takes action (move, leap, throw, wait)
   
2. ENEMY PHASE (resolveEnemyActions)
   ├─ Resolve telegraphed attacks (damage player if in intent position)
   ├─ Apply lava damage to player
   ├─ Each enemy:
   │   ├─ Calculate new position/intent via AI
   │   └─ Apply lava damage to enemy (may kill)
   ├─ Check spear pickup
   ├─ Check shrine → 'choosing_upgrade' state
   └─ Check stairs → advance floor or win game

3. END PHASE
   ├─ Increment turn counter
   ├─ Update game status (lost if HP <= 0, won if floor 5 complete)
   └─ Generate message
```

### Floor Progression

1. **Floors 1-4:** Stepping on stairs generates a new floor
2. **Floor 5 (Arcade Max):** Stepping on stairs triggers victory
3. **Victory:** Stores `completedRun` with seed, actions, score, floor for leaderboard

**Next floor seed derivation:** `${initialSeed}:${nextFloor}`

### Game Over Conditions

- **Lost:** Player HP drops to 0
- **Won:** Clear floor 5 by reaching stairs

---

## Special Tiles

### Lava Tiles
- **Generation:** 5-9 random tiles per floor (not on spawn, stairs, shrine)
- **Effect:** Deals 1 damage when stepped on (to player or enemy)
- **Visual:** Orange (`#f97316`)

### Stairs
- **Position:** Randomly placed each floor
- **Effect:** Advances to next floor (or victory on floor 5)
- **Visual:** Purple (`#6d28d9`)

### Shrine
- **Appears:** Every even floor (2, 4)
- **Effect:** Triggers upgrade selection overlay
- **Visual:** Purple (`#6d28d9`)

### Player Spawn
- **Position:** Always `(0, 0, 0)` center
- **Special:** Lava cannot spawn here

---

## Upgrades

Currently available upgrades:

| Slot | Name | Description | Upgrades |
|------|------|-------------|----------|
| **Offensive** | Spear Throw | Throw/Retrieve kill | Recall, Lunge, Arc Lunge, Recall Damage, Deep Breath, Cleave |
| **Defensive** | Shield Bash | Push & Stun | Arc Bash, 360° Bash, Wall Slam, Passive Protection, Quick Recovery |
| **Utility** | Jump | Agile Leap | Meteor Impact, Stunning Landing, Free Jump, Nimble |

### Core Passive: Punch
Enemies that remain adjacent to the player at the end of the player's turn take 1 damage automatically.

### Key Upgrades
- **Recall Damage**: Spear kills all enemies on the return path.
- **Lunge**: Enables the Lunge skill execution.
- **Passive Protection**: Provides +1 Armor when shield is not on cooldown.
- **Wall Slam**: Stuns enemies bashed into obstacles.
- **Meteor Impact**: Jump on enemies to kill them.
- **Deep Breath**: Spear/Lunge kills reset Jump cooldown.

### Upgrade Application

```typescript
case 'SELECT_UPGRADE':
    if (upgrade === 'EXTRA_HP') {
        player = increaseMaxHp(player, 1, true);
    }
    // LEAP is passive - just checked in UI/logic
```

---

## Combat System

### Damage Model

All attacks deal **1 damage** (flat damage model):

```typescript
export const applyDamage = (actor: Entity, amount: number): Entity => {
    return { ...actor, hp: Math.max(0, actor.hp - amount) };
};
```

### Telegraphed Attacks

Enemies telegraph their attacks by setting `intentPosition`. On the **next turn**, if the player is still at that position, they take damage.

```typescript
// In combat.ts
state.enemies.forEach(e => {
    if (e.intentPosition && hexEquals(e.intentPosition, playerMovedTo)) {
        player = applyDamage(player, 1);
        messages.push(`Hit by ${e.subtype}!`);
    }
});
```

### Lunge Kill (Leap)

When player leaps, enemies in the path are killed:

```typescript
const killedEnemies = state.enemies.filter(e =>
    (hexDistance(state.player.position, e.position) === 2 &&
     hexDistance(target, e.position) === 1)
);
```

This kills enemies that were 2 hexes from the player's starting position and end up 1 hex from landing position.

### Spear Mechanics

1. Check if enemy exists at target hex
2. Remove that enemy from play
3. Set `hasSpear = false`
4. Set `spearPosition = target`
5. Player can pick up spear by stepping on it

---

## RNG & Determinism

The game uses a seeded PRNG (Mulberry32) for deterministic gameplay:

### RNG Functions

| Function | Purpose |
|----------|---------|
| `createRng(seed)` | Creates a PRNG instance |
| `randomFromSeed(seed, counter)` | Single random value from seed+counter |
| `consumeRandom(state)` | Get random value and increment `rngCounter` |
| `nextIdFromState(state, len)` | Generate deterministic ID string |

### Determinism Guarantee

Every random decision uses `consumeRandom()` which:
1. Computes value from `seed:counter`
2. Returns new state with `rngCounter + 1`

This ensures identical playthrough for same seed + actions.

### Seed Flow

```
generateInitialState(floor=1, seed=Date.now())
├── Uses seed for: stairs, lava, shrine positions
├── Uses seed for: enemy IDs
└── Stores rngSeed, initialSeed, rngCounter=0

Floor transition:
└── nextSeed = `${initialSeed}:${floor+1}`
```

---

## Replay System

### Recording

Every player action is automatically appended to `state.actionLog`:

```typescript
const appendAction = (s: GameState, a: Action): GameState => {
    const log = s.actionLog ? [...s.actionLog, a] : [a];
    return { ...s, actionLog: log };
};
```

### Playback

1. Load replay record with seed and actions
2. `generateInitialState(1, seed)` creates identical starting state
3. Dispatch each action in sequence
4. State evolves identically due to determinism

### Storage

- `STORAGE_KEY = 'hop_replays_v1'` - Local replays
- `LEADERBOARD_KEY = 'hop_leaderboard_v1'` - Local leaderboard

### Export/Import

Replays can be exported as JSON files and imported for verification.

---

## Known Issues & Recommendations

None! Replay determinism and core mechanics are stable.

### 🟡 Minor Improvements (WIP)
1. **Archer/Golem Sprite Differentiation**: Currently all enemies use sprites, but visual hierarchy can be improved.
2. **Leaderboard Submission**: Scoring is live, but persistence to global backend is optional.
3. **Multi-room layouts**: Procedural rooms are functional but could use more variety in prefabs.

### 🟢 Improvement Opportunities

1. **Add more enemy types**
   - Shield-bearer (blocks frontal attacks)
   - Mage (teleports, casts spells)
   - Elite footman (2 movement per turn)

2. **Expand upgrade system**
   - Spear return upgrade
   - Shield bash ability
   - Heal on kill

3. **Add difficulty scaling**
   - More enemies per floor
   - Stronger enemy variants
   - Boss fights on floors 3 and 5

4. **Sound effects and particles**
   - Hit feedback
   - Movement trails
   - Death animations

5. **Unit tests for combat edge cases**
   - Leap through multiple enemies
   - Simultaneous lava + attack damage
   - Upgrade state persistence across floors

---

## Test Coverage

| Test File | Coverage |
|-----------|----------|
| `actor.test.ts` | `applyDamage`, `resolveMeleeAttack` |
| `hex.test.ts` | `hexDistance`, `getNeighbors`, `getGridCells` |
| `rng.test.ts` | PRNG determinism |
| `rng_id.test.ts` | `nextIdFromState` determinism |
| `replay.test.ts` | Basic replay round-trip |
| `replay_roundtrip.test.ts` | Stress test with WAIT actions |

**All 8 tests pass ✅**

---

## Summary

The game architecture is **solid and well-designed**:

- ✅ Immutable state management
- ✅ Deterministic RNG for replays
- ✅ Clear separation of concerns
- ✅ Comprehensive type definitions
- ✅ Functional, testable code

The core mechanics work correctly. The main opportunities are expanding content (enemies, upgrades) and polishing edge cases. The codebase is ready for feature development.
