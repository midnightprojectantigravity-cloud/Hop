# ECS Architecture Analysis for Hop

## Current Architecture Assessment

### What You Already Have (ECS-Lite)

Your codebase **already implements an ECS-Lite architecture**! Looking at your code:

```typescript
/**
 * ARCHITECTURE OVERVIEW: "Gold Standard" Tech Stack
 * Logic: Immutable State + Command Pattern (see Command, StateDelta)
 * Validation: TDD for Scenarios + Fuzzing for stability
 * Performance: Spatial Hashing/Bitmasks for the AI (see GameState.occupancyMask)
 * Meta: Strategic Hub with serialized JSON Loadouts
 * 
 * ECS-Lite: The Actor model stores data and components, Logic is handled by pure Systems.
 */
```

### Current ECS-Lite Elements

#### ✅ **Entities**: `Actor` interface
```typescript
export interface Actor {
    id: string;
    type: 'player' | 'enemy';
    // ... core properties
    
    // ECS-Lite: Components can be stored here as optional records
    components?: Record<string, any>;
    
    // Skills
    activeSkills: Skill[];
    
    // Status system
    statusEffects: StatusEffect[];
}
```

#### ✅ **Components**: Already in use
- `components?: Record<string, any>` - Generic component storage
- `activeSkills: Skill[]` - Skill component
- `statusEffects: StatusEffect[]` - Status component
- `weightClass?: WeightClass` - Physics component
- `archetype?: 'VANGUARD' | 'SKIRMISHER'` - Class component

#### ✅ **Systems**: Pure functions operating on state
- **Movement System**: `applyEffects()` with `Displacement` effects
- **Combat System**: `resolveSingleEnemyTurn()`, skill execution
- **Initiative System**: `buildInitiativeQueue()`, `advanceInitiative()`
- **Effect System**: `applyAtomicEffect()`, `effectEngine.ts`
- **Status System**: `StatusEffect` with hooks
- **Spatial System**: `refreshOccupancyMask()`, spatial hashing

#### ✅ **Immutable State**: Command Pattern
- All state transitions through `gameReducer()`
- Command pattern for replays/undo
- Pure functions, no mutations

## Should You Go Full ECS?

### ❌ **My Recommendation: NO**

Here's why your current **ECS-Lite + Immutable State** is superior for your game:

### 1. **Turn-Based Games Don't Need Full ECS**

Full ECS shines in:
- Real-time games with thousands of entities
- Games needing cache-friendly data layouts
- Systems that need to iterate over specific component combinations frequently

Your game has:
- ~10-20 entities max per floor
- Turn-based, not real-time
- Immutable state (already optimal for your use case)

### 2. **You Already Have the Benefits**

| ECS Benefit | Your Current Implementation |
|-------------|----------------------------|
| **Separation of Concerns** | ✅ Pure systems, immutable state |
| **Composability** | ✅ `components`, `statusEffects`, `activeSkills` |
| **Testability** | ✅ Excellent scenario system |
| **Performance** | ✅ Spatial hashing, occupancy masks |
| **Reusability** | ✅ Shared Actor interface, compositional skills |

### 3. **Full ECS Would Add Complexity**

Full ECS requires:
- Component registration systems
- Query systems for component combinations
- More boilerplate for simple operations
- Harder to serialize/deserialize state
- More difficult to reason about data flow

Your current approach:
- Simple, readable data structures
- Easy serialization (JSON)
- Clear data flow through reducer
- TypeScript gives you type safety

## What You SHOULD Do Instead

### ✅ **Recommended Improvements**

#### 1. **Formalize Your Component System**

Instead of `components?: Record<string, any>`, create typed components:

```typescript
// New file: components.ts
export interface Component {
    type: string;
}

export interface VaultComponent extends Component {
    type: 'vault';
    counter: number;
}

export interface StealthComponent extends Component {
    type: 'stealth';
    isHidden: boolean;
    remainingTurns: number;
}

export interface BerserkComponent extends Component {
    type: 'berserk';
    damageBonus: number;
    duration: number;
}

// Union type for all components
export type GameComponent = 
    | VaultComponent 
    | StealthComponent 
    | BerserkComponent;

// Update Actor
export interface Actor {
    // ... existing fields
    components?: Map<string, GameComponent>; // Typed instead of any
}
```

#### 2. **Extract More Systems**

Move logic from `logic.ts` into focused system files:

```
packages/engine/src/systems/
├── movement.ts       // All displacement logic
├── combat.ts         // Damage, attacks
├── status.ts         // Status effect processing
├── initiative.ts     // Already exists!
├── spatial.ts        // Already exists!
└── loot.ts           // Item pickups
```

Each system exports pure functions:
```typescript
// systems/movement.ts
export const applyDisplacement = (
    state: GameState, 
    actorId: string, 
    destination: Point
): GameState => {
    // Pure function, returns new state
};
```

#### 3. **Strengthen Effect System**

Your `AtomicEffect` system is excellent! Expand it:

```typescript
export type AtomicEffect =
    | { type: 'Displacement'; ... }
    | { type: 'Damage'; ... }
    | { type: 'AddComponent'; actorId: string; component: GameComponent }
    | { type: 'RemoveComponent'; actorId: string; componentType: string }
    | { type: 'ModifyComponent'; actorId: string; componentType: string; changes: Partial<GameComponent> }
    // ... existing effects
```

#### 4. **Component Query Helpers**

Add utility functions for working with components:

```typescript
// helpers/components.ts
export const hasComponent = <T extends GameComponent>(
    actor: Actor, 
    type: T['type']
): boolean => {
    return actor.components?.has(type) ?? false;
};

export const getComponent = <T extends GameComponent>(
    actor: Actor, 
    type: T['type']
): T | undefined => {
    return actor.components?.get(type) as T | undefined;
};

export const setComponent = (
    actor: Actor, 
    component: GameComponent
): Actor => {
    const components = new Map(actor.components || new Map());
    components.set(component.type, component);
    return { ...actor, components };
};
```

#### 5. **Move Actor Properties to Components**

Gradually migrate optional properties to components:

**Before:**
```typescript
export interface Actor {
    weightClass?: WeightClass;
    archetype?: 'VANGUARD' | 'SKIRMISHER';
    facing?: number;
    isVisible?: boolean;
}
```

**After:**
```typescript
export interface Actor {
    // Core properties only
    id: string;
    type: 'player' | 'enemy';
    position: Point;
    hp: number;
    maxHp: number;
    
    // Everything else is a component
    components?: Map<string, GameComponent>;
}

// Components
export interface PhysicsComponent extends Component {
    type: 'physics';
    weightClass: WeightClass;
    facing?: number;
}

export interface ArchetypeComponent extends Component {
    type: 'archetype';
    archetype: 'VANGUARD' | 'SKIRMISHER';
}

export interface VisibilityComponent extends Component {
    type: 'visibility';
    isVisible: boolean;
    stealthLevel?: number;
}
```

## Implementation Plan

### Phase 1: Formalize Components (Week 1)
1. Create `components.ts` with typed component interfaces
2. Add component helper functions
3. Update `UpdateComponent` effect to use typed components
4. Write tests for component system

### Phase 2: Extract Systems (Week 2)
1. Create `systems/` folder
2. Move movement logic to `systems/movement.ts`
3. Move combat logic to `systems/combat.ts`
4. Move status logic to `systems/status.ts`
5. Update tests

### Phase 3: Migrate to Components (Week 3-4)
1. Migrate `weightClass` to `PhysicsComponent`
2. Migrate `archetype` to `ArchetypeComponent`
3. Migrate `isVisible` to `VisibilityComponent`
4. Update all code that accesses these properties
5. Comprehensive testing

### Phase 4: Polish (Week 5)
1. Add component-based queries
2. Optimize component access patterns
3. Documentation
4. Performance testing

## Benefits of This Approach

### ✅ **Improved Separation of Concerns**
- Systems are pure, focused functions
- Components are typed, validated data
- Clear boundaries between different mechanics

### ✅ **Better Composability**
- Mix and match components on actors
- Easy to add new mechanics (just add a component)
- No inheritance hierarchies

### ✅ **Maintains Your Strengths**
- Immutable state (critical for turn-based games)
- Command pattern for replays
- Excellent testability
- Simple serialization

### ✅ **TypeScript-Friendly**
- Full type safety for components
- Autocomplete for component properties
- Compile-time checking

### ✅ **Gradual Migration**
- Can migrate one property at a time
- No big-bang refactor
- Backward compatible during transition

## What NOT to Do

### ❌ **Don't Use a Full ECS Library**
Libraries like `bitECS`, `ecsy`, or `miniplex` are overkill for your game and would:
- Add unnecessary complexity
- Make serialization harder
- Reduce type safety
- Hurt readability

### ❌ **Don't Separate Data and Behavior Too Much**
Some ECS purists separate all data from behavior. For a turn-based game:
- Keep skills as data on actors
- Keep status effects as data on actors
- These are already well-designed

### ❌ **Don't Optimize Prematurely**
Your game has ~20 entities max. Don't worry about:
- Cache locality
- Data-oriented design
- SIMD optimizations
These matter for games with 10,000+ entities

## Conclusion

**You already have an excellent architecture!** Your ECS-Lite + Immutable State + Command Pattern is:
- ✅ Perfect for turn-based games
- ✅ Highly testable
- ✅ Easy to reason about
- ✅ TypeScript-friendly
- ✅ Serialization-friendly

**Recommended next steps:**
1. Formalize your component system with types
2. Extract more systems from `logic.ts`
3. Gradually migrate optional properties to components
4. Keep your immutable state and command pattern

**Don't:**
- ❌ Adopt a full ECS library
- ❌ Separate data and behavior excessively
- ❌ Optimize for 10,000+ entities you'll never have

Your architecture is already world-class for a turn-based tactical game. The improvements I suggest will enhance what you have, not replace it.
