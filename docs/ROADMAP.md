# Hop - Development Roadmap

*Created: December 25, 2024*

This document outlines the expansion plan for Hop, focusing on enemies, skills, procedural map generation, and visual theming.

---

## Table of Contents

1. [Phase 1: Expanded Enemy Types](#phase-1-expanded-enemy-types)
2. [Phase 2: Player Skills & Abilities](#phase-2-player-skills--abilities)
3. [Phase 3: Procedural Map Generation](#phase-3-procedural-map-generation)
4. [Phase 4: Visual Theme & Assets](#phase-4-visual-theme--assets)
5. [Phase 5: Progression & Meta Systems](#phase-5-progression--meta-systems)

---

## Phase 1: Expanded Enemy Types

| Type | HP | Behavior | Status |
|------|-----|----------|--------|
| Footman | 2 | Melee, moves toward player | ✅ |
| Archer | 1 | Ranged (axial) | ✅ |
| Bomber | 1 | AoE, throws bombs | ✅ |
| Shield Bearer | 3 | Slow, blocks front | ✅ |
| Sprinter | 1 | Fast (2 hex/turn) | ✅ |
| Warlock | 2 | Teleport & Cast | ✅ |
| Assassin | 1 | Stealth Melee | ✅ |
| Golem | 4 | Heavy Line Attack | ✅ |
| Bomb | 1 | Delayed Explosion | ✅ |

#### Tier 3 - Elite (Floors 5+, Bosses)

**👑 The Sentinel (Boss)**
- HP: 20
- Behavior: Area-of-effect "Projected Attacks", stays range 5.
- Status: ✅ **Completed**

**💀 Death Knight (Mini-boss)**
- HP: 6
- Behavior: Charges in straight line, cursed ground
- Status: **To Do**

#### Tier 3 - Elite (Floors 5+, Bosses)

**👑 Demon Lord (Boss)**
- HP: 10
- Behavior: Multi-phase fight, summons minions
- Mechanics:
  - Phase 1: Ranged fireballs
  - Phase 2 (50% HP): Summons 2 footmen
  - Phase 3 (25% HP): Melee rampage, moves 2x speed
- Implementation: Add boss logic with phase transitions

**💀 Death Knight (Mini-boss)**
- HP: 6
- Behavior: Charges in straight line, leaves trail of cursed ground
- Mechanic: Cursed tiles deal damage like lava for 3 turns
- Implementation: Add temporary tile effects with duration

### Enemy Spawn Scaling

| Floor | Enemy Budget | Types Available |
|-------|--------------|-----------------|
| 1 | 3 points | Footman (1), Archer (1) |
| 2 | 5 points | + Bomber (1), Sprinter (1) |
| 3 | 7 points | + Shield Bearer (2) |
| 4 | 9 points | + Warlock (2), Assassin (2) |
| 5 | 12 points | + Golem (3), Mini-boss |
| 6+ | 15+ points | Boss encounters |

---

## Phase 2: Player Skills & Abilities

### Skill System Design

Each skill has:
- **Cooldown**: Turns until reusable
- **Energy Cost**: Optional resource cost
- **Effect**: What happens when activated

### Proposed Skills

#### Movement Skills

**🦘 Leap** (Current)
- Cooldown: 0
- Effect: Jump 2 hexes, kill enemies in path

**🌀 Blink**
- Cooldown: 3 turns
- Effect: Teleport to any visible hex within range 4
- Upgrade: Stun enemies adjacent to landing

**💨 Dodge Roll**
- Passive ability
- Effect: 30% chance to avoid incoming damage
- Upgrade: Guaranteed dodge after moving 3+ hexes in a turn

#### Attack Skills

**⚔️ Whirlwind**
- Cooldown: 4 turns
- Effect: Damage all adjacent enemies
- Upgrade: Knockback enemies 1 hex

**🎯 Precision Strike**
- Cooldown: 2 turns
- Effect: Next attack deals double damage

**🔥 Fire Spear**
- Cooldown: 5 turns
- Effect: Throw spear, creates lava at landing + adjacent hexes
- Upgrade: Spear automatically returns

#### Defensive Skills

**🛡️ Shield Block**
- Cooldown: 2 turns
- Effect: Block next incoming attack, reflect damage to attacker

**❤️ Second Wind**
- Cooldown: Once per floor
- Effect: Heal 2 HP when dropping below 1 HP

### Skill Tree Structure

```
                    [START]
                       |
         +-------------+-------------+
         |             |             |
      [WARRIOR]    [RANGER]     [MAGE]
         |             |             |
    Whirlwind     Precision     Blink
         |             |             |
   Shield Block   Dodge Roll   Fire Spear
         |             |             |
    Second Wind   Multi-Shot   Teleport
```

---

## Phase 3: Procedural Map Generation

### Inspiration: Diablo 2 Style

Diablo 2 uses a **tile-based procedural system** with:
1. Pre-designed room templates ("prefabs")
2. Corridors connecting rooms
3. Guaranteed progression path
4. Dead ends with optional rewards
5. Themed tile sets per act/area

### Hex-Based Dungeon Generation Algorithm

#### Room-Based Generation

```
1. Generate dungeon layout as graph of rooms
2. Each "room" is a cluster of hexes
3. Rooms connected by corridors
4. Place special rooms: Entrance, Exit, Shrine, Boss
```

#### Room Types

| Room Type | Size (hexes) | Contents |
|-----------|--------------|----------|
| Entrance | 7-12 | Player spawn, safe zone |
| Combat | 15-25 | Enemy spawns, hazards |
| Treasure | 7-10 | Chest, upgrade shrine |
| Corridor | 3-8 wide | Connects rooms, may have ambush |
| Boss Arena | 30-40 | Boss encounter, pillars |
| Secret | 5-8 | Hidden, special reward |

#### Generation Algorithm (Pseudocode)

```typescript
interface Room {
  id: string;
  type: 'entrance' | 'combat' | 'treasure' | 'corridor' | 'boss' | 'secret';
  center: Point;
  hexes: Point[];
  connections: string[];  // IDs of connected rooms
}

interface Dungeon {
  rooms: Room[];
  tiles: Map<string, TileType>;  // hex key -> tile
}

function generateDungeon(floor: number, seed: string): Dungeon {
  const rng = createRng(seed);
  
  // 1. Determine dungeon parameters based on floor
  const roomCount = 4 + Math.floor(floor / 2);
  const hasBoss = floor % 5 === 0;
  
  // 2. Generate room graph using random walk
  const rooms: Room[] = [];
  rooms.push(createRoom('entrance', { q: 0, r: 0, s: 0 }, rng));
  
  for (let i = 1; i < roomCount; i++) {
    const parent = rooms[Math.floor(rng.next() * rooms.length)];
    const direction = Math.floor(rng.next() * 6);
    const distance = 8 + Math.floor(rng.next() * 6);
    const newCenter = hexInDirection(parent.center, direction, distance);
    
    const type = determineRoomType(i, roomCount, hasBoss, rng);
    const newRoom = createRoom(type, newCenter, rng);
    
    // Create corridor between parent and new room
    const corridor = createCorridor(parent.center, newRoom.center, rng);
    
    rooms.push(newRoom);
    parent.connections.push(newRoom.id);
    newRoom.connections.push(parent.id);
  }
  
  // 3. Add boss room on boss floors
  if (hasBoss) {
    const furthestRoom = findFurthestRoom(rooms, rooms[0]);
    const bossRoom = createRoom('boss', offsetFromRoom(furthestRoom), rng);
    rooms.push(bossRoom);
  }
  
  // 4. Place exit stairs in last room
  // 5. Scatter shrines, lava, enemies
  
  return { rooms, tiles: compileTiles(rooms) };
}
```

#### Theming System

Each "act" or floor range has a tileset:

| Floors | Theme | Tiles | Enemies |
|--------|-------|-------|---------|
| 1-2 | Catacombs | Stone, torches, graves | Footmen, Archers |
| 3-4 | Inferno | Lava, brimstone, embers | Bombers, Warlocks |
| 5 | Throne Room | Marble, pillars, banners | Demon Lord Boss |
| 6-8 | Frozen Depths | Ice, snow, crystals | New ice enemies |
| 9-10 | Void | Dark matter, portals | Eldritch horrors |

---

## Phase 4: Visual Theme & Assets

### Art Direction

**Style**: Medieval dark fantasy with apocalyptic undertones
**Palette**: 
- Primary: Burnt umber (#2b1f17), aged bronze (#8b5e34)
- Danger: Molten orange (#f97316), blood red (#b91c1c)
- Magic: Corrupted purple (#6d28d9), void black (#0b0b0b)

### Required Assets

#### Tile Sprites / SVG
- [x] Stone floor (with texture)
- [x] Lava tile (animated bubbles/glow)
- [x] Ice tile (To Do)
- [x] Void tile (To Do)
- [x] Stairs (SVG icon)
- [x] Shrine (Crystal SVG)

#### Entity Sprites / Shapes
- [x] Player (Square SVG)
- [x] Footman (Diamond shape)
- [x] Archer (Triangle shape)
- [x] Bomber (Circle shape)
- [x] Shield Bearer (Heavy shape)
- [ ] Warlock (robed, staff)
- [ ] Golem (stone giant)
- [ ] Demon Lord (boss, winged demon)

#### UI Elements
- [ ] Health bar frame
- [ ] Skill icons
- [ ] Upgrade cards
- [ ] Floor transition screen

#### VFX
- [ ] Attack slash
- [ ] Damage numbers
- [ ] Heal particles
- [ ] Spell effects
- [ ] Death explosion

---

## Phase 5: Progression & Meta Systems

### Run Progression
- Score based on: floors cleared, enemies killed, HP remaining
- Persistent unlocks: new starting skills, cosmetics

### Leaderboards
- Daily/weekly challenges with fixed seeds
- Global high scores

### Achievements
- "First Blood" - Kill 100 enemies
- "Untouchable" - Clear floor without damage
- "Boss Slayer" - Defeat Demon Lord

---

## Implementation Priority

### High Priority (Next Sprint)
1. 🧊 Implementing Frozen & Void themes (Ice/Void tiles)
2. 🏆 Meta-progression (Global Leaderboard backend)
3. 🎵 Sound effects & Music integration
4. 🧠 Advanced AI MCTS simulation (using occupancyMask)

### Completed ✅
1. Full 8+ Enemy roster with specialized AI, including The Sentinel (Boss).
2. 3-slot Skill system with deep upgrade trees and compositional framework.
3. Visual overhaul (SVG shapes, animations, lava bubbles).
4. Permanent session persistence & Replay verification.
5. In-game scoring & leaderboard with Arcade Mode formula.
6. **"The Juice" System**: Granular VisualEvent pipeline for screenshakes, freezes, and combat text.
7. **10-Level Arcade Progression**: 1-10 level curve with tactical escalation.

---

## Next Action

Ready to begin implementation? I recommend starting with:
1. **Art Assets** - Generate placeholder sprites for new enemies
2. **New Enemies** - Implement Shield Bearer and Sprinter
3. **Map Generation** - Create room-based dungeon generation

Let me know which you'd like to tackle first!
