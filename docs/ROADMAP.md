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

### Current Enemies
| Type | HP | Behavior |
|------|-----|----------|
| Footman | 2 | Melee, moves toward player |
| Archer | 1 | Ranged, requires line-of-sight on axis |
| Bomber | 1 | AoE, prefers 2-3 hex distance |

### New Enemy Proposals

#### Tier 1 - Basic (Floors 1-3)

**🛡️ Shield Bearer**
- HP: 3
- Behavior: Slow movement, blocks frontal attacks
- Mechanic: Cannot be damaged from the direction they're facing. Must flank.
- Implementation: Add `facing: number` (0-5 direction) to Entity

**⚡ Sprinter**
- HP: 1
- Behavior: Moves 2 hexes per turn toward player
- Mechanic: Fast but fragile. Creates pressure.
- Implementation: Add `movementSpeed: number` to Entity

#### Tier 2 - Intermediate (Floors 3-5)

**🧙 Warlock**
- HP: 2
- Behavior: Teleports every 2 turns, casts ranged spell
- Mechanic: Unpredictable positioning
- Implementation: Add `teleportCooldown: number`, use RNG for destination

**🗡️ Assassin**
- HP: 1
- Behavior: Invisible until adjacent. Backstab deals 2 damage.
- Mechanic: Revealed when player is adjacent or uses detection skill
- Implementation: Add `isVisible: boolean`, reveal logic in combat

**🪨 Golem**
- HP: 4
- Behavior: Slow (moves every other turn), attacks in 3-hex line
- Mechanic: Telegraph shows multiple hexes, high damage
- Implementation: Add `actionCooldown: number`, line attack telegraph

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

#### Tile Sprites
- [ ] Stone floor (catacombs)
- [ ] Lava tile (animated glow)
- [ ] Ice tile (frozen depths)
- [ ] Void tile (dark energy)
- [ ] Stairs (descent portal)
- [ ] Shrine (corrupted altar)

#### Entity Sprites
- [ ] Player (warrior silhouette)
- [ ] Footman (armored soldier)
- [ ] Archer (hooded figure with bow)
- [ ] Bomber (hunched figure with bombs)
- [ ] Shield Bearer (heavy armor, large shield)
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
1. ⚡ Implement 2-3 new enemy types (Shield Bearer, Sprinter, Warlock)
2. 🗺️ Basic procedural room generation
3. 🎨 Generate initial art assets

### Medium Priority
4. ⚔️ Implement skill system with 3-4 skills
5. 🏰 Room templates and corridor generation
6. 🎵 Sound effects foundation

### Lower Priority
7. 👑 Boss fights
8. 🏆 Meta progression
9. 🎮 Mobile controls

---

## Next Action

Ready to begin implementation? I recommend starting with:
1. **Art Assets** - Generate placeholder sprites for new enemies
2. **New Enemies** - Implement Shield Bearer and Sprinter
3. **Map Generation** - Create room-based dungeon generation

Let me know which you'd like to tackle first!
