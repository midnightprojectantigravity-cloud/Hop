# Tile Effects System: Observer-Based Architecture

## 🎯 Overview

The **Tile Effects System** is a vital architectural shift from **event-based** damage to **observer-based** tile logic. This makes the engine more robust, especially for a flat-top hex grid where movement is constant and varied.

### The Problem with Event-Based Effects

Previously, effects were triggered by **actions**:
- Mage casts "Fire" → Damage applied to target
- Warrior pushes enemy → Check if enemy lands on lava

This approach had several issues:
1. **Temporal Coupling**: Effects depended on when and how they were triggered
2. **Missed Interactions**: Units could "skip" hazards during complex movements
3. **High Complexity**: Each action had to manually check for environmental effects
4. **Poor Separation**: Movement logic was tightly coupled with hazard logic

### The Solution: Observer-Based Tiles

Now, tiles are **active observers** that monitor units:
- Tile has lava → Tile watches for units → Tile triggers effects
- Movement system doesn't care about hazards → Tiles intercept movement → Tiles apply their own logic

## 🏗️ Architecture

### Core Concepts

#### 1. **onPass Hook**
Triggered when a unit moves **through** a tile (mid-movement).

**Use cases:**
- Momentum modification (friction, slipperiness)
- Damage during transit
- Status application during movement

**Example:**
```typescript
onPass: (context: TileEffectContext) => {
    return {
        effects: [
            { type: 'Damage', target: context.actor.id, amount: 5 }
        ],
        messages: [`${context.actor.id} passes through lava!`],
        newMomentum: context.momentum ? context.momentum - 2 : undefined
    };
}
```

#### 2. **onEnter Hook**
Triggered when a unit's movement **terminates** on a tile.

**Use cases:**
- Landing damage
- Status application on arrival
- Tile state changes

**Example:**
```typescript
onEnter: (context: TileEffectContext) => {
    return {
        effects: [
            { type: 'Damage', target: context.actor.id, amount: 999 },
            { type: 'ApplyStatus', target: context.actor.id, status: 'stunned', duration: 1 }
        ],
        messages: [`${context.actor.id} sinks into lava!`],
        interrupt: true
    };
}
```

#### 3. **Momentum Modification**
Tiles can modify kinetic momentum during movement, creating realistic physics.

**Examples:**
- **Lava**: Reduces momentum by 2 (viscosity/friction)
- **Ice**: Preserves momentum (no friction)
- **Snare**: Sets momentum to 0 (immediate stop)

### Integration with Movement System

The movement system now calls tile effect hooks at key points:

```typescript
// In processKineticRequest (for kinetic movements)
for (each hex in movement path) {
    const tileResult = processTilePass(hexPos, actor, state, currentMomentum);
    
    // Apply effects from tile
    effects.push(...tileResult.effects);
    messages.push(...tileResult.messages);
    
    // Update momentum
    if (tileResult.newMomentum !== undefined) {
        currentMomentum = tileResult.newMomentum;
    }
    
    // Check for interruption
    if (tileResult.interrupt) {
        break; // Stop movement
    }
}
```

```typescript
// In resolveMove (for standard movement)
let newState = applyEffects(state, moveEffects, { targetId: actorId });

// Process onEnter tile effects
const enterResult = processTileEnter(target, updatedActor, newState);
newState = applyEffects(newState, enterResult.effects, { targetId: actorId });
```

## 📊 Comparison: Old vs. New

| Feature | Old Logic (Action-Driven) | New Logic (Tile-Driven) |
| --- | --- | --- |
| **Trigger** | Mage casts "Fire" on Warrior | Warrior moves onto "Fire Tile" |
| **Physics** | Hard to calculate mid-slide | Every hex in a slide checks its own hazards |
| **Complexity** | High (Mage must track all units) | Low (Tile only cares what is currently on it) |
| **Knockback** | Units often "skip" hazards | **Hazard Interception:** Pushing someone *through* lava now hurts them |
| **Extensibility** | Must modify movement code | Just register a new tile effect |

## 🧪 Built-In Tile Effects

### 1. Lava Sink
**ID:** `lava_sink`

**Behavior:**
- **onPass**: Deals 5 damage, reduces momentum by 2
- **onEnter**: Deals 999 damage (instant death), applies stun, interrupts chain

**Juice:**
- Steam particles on pass
- Vaporize effect on enter
- "Sizzle!" combat text

### 2. Ice (Slippery)
**ID:** `ice`

**Behavior:**
- **onPass**: Preserves momentum (no reduction)
- **onEnter**: Flash effect

**Juice:**
- "Slide!" combat text
- Long, high-pitched sliding sound
- Flash effect on landing

### 3. Void
**ID:** `void`

**Behavior:**
- **onPass**: Deals 10 damage, reduces momentum by 3
- **onEnter**: Deals 999 damage (instant death), interrupts chain

**Juice:**
- Flash effect
- "The void consumes you!" message

### 4. Snare Trap
**ID:** `snare_trap`

**Behavior:**
- **onPass**: Applies stun, sets momentum to 0, interrupts chain

**Juice:**
- "SNAP!" combat text
- Camera shake
- Impact sound

## 🎨 Creating Custom Tile Effects

### Example: Healing Spring

```typescript
import { registerTileEffect, TileEffect } from './systems/tile-effects';

const HEALING_SPRING: TileEffect = {
    id: 'healing_spring',
    name: 'Healing Spring',
    description: 'A magical spring that heals units',
    
    appliesTo: (position: Point, state: GameState) => {
        // Check if this position is a healing spring
        return state.healingSprings?.some(hs => hexEquals(hs, position)) || false;
    },
    
    onEnter: (context: TileEffectContext) => {
        const { actor } = context;
        const healAmount = 5;
        
        return {
            effects: [
                { type: 'Heal', target: actor.id, amount: healAmount },
                { type: 'Juice', effect: 'flash', target: actor.position }
            ],
            messages: [`${actor.id} is healed by the spring!`]
        };
    }
};

// Register the effect
registerTileEffect(HEALING_SPRING);
```

### Example: Quicksand (Momentum Trap)

```typescript
const QUICKSAND: TileEffect = {
    id: 'quicksand',
    name: 'Quicksand',
    description: 'Sticky sand that slows movement',
    
    appliesTo: (position: Point, state: GameState) => {
        return state.quicksandPositions?.some(qs => hexEquals(qs, position)) || false;
    },
    
    onPass: (context: TileEffectContext) => {
        const { actor, momentum } = context;
        
        return {
            effects: [
                { type: 'Juice', effect: 'combat_text', target: actor.position, text: 'Stuck!' }
            ],
            messages: [`${actor.id} struggles through quicksand!`],
            // Quicksand reduces momentum by 3 (more than lava!)
            newMomentum: momentum !== undefined ? Math.max(0, momentum - 3) : undefined
        };
    },
    
    onEnter: (context: TileEffectContext) => {
        const { actor } = context;
        
        return {
            effects: [
                { type: 'ApplyStatus', target: actor.id, status: 'stunned', duration: 1 },
                { type: 'Juice', effect: 'shake', intensity: 'low' }
            ],
            messages: [`${actor.id} is stuck in quicksand!`]
        };
    }
};

registerTileEffect(QUICKSAND);
```

## 🧪 Testing

### TDD Scenario: The "Lava Slide"

**Goal:** Prove that the Warrior cannot push an enemy as far across Lava as they can across Stone.

**Setup:**
- A line of 5 hexes
- Hexes 2 and 3 are `LavaSink`
- Warrior at hex 0
- Enemy at hex 1

**Action:**
- Warrior Shield Slams an enemy with **Momentum: 6**

**Expected Logic:**
- Hex 1 (Stone): Momentum 6 → 5 (standard -1)
- Hex 2 (Lava): Momentum 5 → 2 (standard -1, plus Lava -2)
- Hex 3 (Lava): Momentum 2 → -1 (standard -1, plus Lava -2)

**Result:**
- The enemy stops on Hex 3
- The enemy has "Burning" status

**Assertion:**
```typescript
assert(enemy.position == Hex_3);
assert(enemy.hasStatus("Burning"));
```

See `scenarios/tile_effects.ts` for full implementation.

## 🎯 Benefits

### 1. Separation of Concerns
- Movement logic is pure and simple
- Tile logic is isolated and testable
- Easy to add new tile types without touching movement code

### 2. Consistency
- Effects trigger regardless of HOW a unit arrives
- Walking, dashing, pushing, grappling - all trigger the same effects

### 3. Extensibility
- New tile effects can be added by simply registering them
- No need to modify core systems

### 4. Realistic Physics
- Tiles can modify momentum, creating realistic friction/slipperiness
- Supports complex interactions (ice + lava + snare)

### 5. Testability
- Each tile effect can be tested in isolation
- Easy to write TDD scenarios for new effects

## 🚀 Future Enhancements

### Dynamic Tile States
Tiles could have their own state that changes over time:
```typescript
interface TileState {
    position: Point;
    type: 'lava' | 'ice' | 'normal';
    temperature: number; // Lava cools over time
    frozen: boolean;     // Water can freeze
}
```

### Tile Interactions
Tiles could interact with each other:
- Fire melts ice
- Water extinguishes fire
- Ice freezes water

### Tile Ownership
Tiles could belong to factions:
- Mage creates fire tiles
- Tiles only affect enemies
- Tiles can be dispelled

### Tile Combos
Multiple tile effects could combine:
- Ice + Fire = Steam (vision obscured)
- Lava + Water = Obsidian (becomes solid)

## 📚 API Reference

### `TileEffect`
```typescript
interface TileEffect {
    id: string;
    name: string;
    description: string;
    appliesTo?: (position: Point, state: GameState) => boolean;
    onPass?: (context: TileEffectContext) => TileEffectResult;
    onEnter?: (context: TileEffectContext) => TileEffectResult;
}
```

### `TileEffectContext`
```typescript
interface TileEffectContext {
    actor: Actor;
    state: GameState;
    momentum?: number;
    isFinalDestination: boolean;
    source?: Point;
}
```

### `TileEffectResult`
```typescript
interface TileEffectResult {
    effects: AtomicEffect[];
    messages: string[];
    newMomentum?: number;
    interrupt?: boolean;
}
```

### Functions

#### `registerTileEffect(effect: TileEffect): void`
Registers a new tile effect in the global registry.

#### `getTileEffectsAt(position: Point, state: GameState): TileEffect[]`
Gets all tile effects that apply to a given position.

#### `processTilePass(position: Point, actor: Actor, state: GameState, momentum?: number): TileEffectResult`
Processes all onPass hooks for a given position.

#### `processTileEnter(position: Point, actor: Actor, state: GameState): TileEffectResult`
Processes all onEnter hooks for a given position.

## 🎓 Summary

The Tile Effects System represents a fundamental shift in how environmental hazards work in the engine. By making tiles **active observers** rather than passive recipients of actions, we achieve:

1. **Better separation of concerns**
2. **More consistent behavior**
3. **Easier extensibility**
4. **Realistic physics simulation**
5. **Improved testability**

This is a **vital architectural shift** that makes the engine more robust and maintainable.
