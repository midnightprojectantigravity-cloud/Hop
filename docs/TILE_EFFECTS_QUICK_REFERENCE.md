# Tile Effects Quick Reference

## 🚀 Quick Start

### Creating a New Tile Effect

```typescript
import { registerTileEffect, TileEffect } from './systems/tile-effects';

const MY_EFFECT: TileEffect = {
    id: 'my_effect',
    name: 'My Effect',
    description: 'What this effect does',
    
    // Optional: Check if effect applies to a position
    appliesTo: (position, state) => {
        return state.myTilePositions?.some(p => hexEquals(p, position));
    },
    
    // Optional: Triggered when unit passes through
    onPass: (context) => {
        return {
            effects: [/* AtomicEffects */],
            messages: ['Message to display'],
            newMomentum: context.momentum ? context.momentum - 1 : undefined
        };
    },
    
    // Optional: Triggered when unit lands on tile
    onEnter: (context) => {
        return {
            effects: [/* AtomicEffects */],
            messages: ['Message to display'],
            interrupt: false // Set true to stop movement chain
        };
    }
};

// Register it
registerTileEffect(MY_EFFECT);
```

## 📋 Common Patterns

### Damage on Pass
```typescript
onPass: (context) => ({
    effects: [
        { type: 'Damage', target: context.actor.id, amount: 5 }
    ],
    messages: [`${context.actor.id} takes damage!`]
})
```

### Momentum Reduction
```typescript
onPass: (context) => ({
    effects: [],
    messages: [],
    newMomentum: context.momentum ? Math.max(0, context.momentum - 2) : undefined
})
```

### Status Application
```typescript
onEnter: (context) => ({
    effects: [
        { type: 'ApplyStatus', target: context.actor.id, status: 'stunned', duration: 1 }
    ],
    messages: [`${context.actor.id} is stunned!`]
})
```

### Interrupt Movement
```typescript
onEnter: (context) => ({
    effects: [
        { type: 'Damage', target: context.actor.id, amount: 999 }
    ],
    messages: [`${context.actor.id} dies!`],
    interrupt: true // Stops the movement chain
})
```

### Conditional Effects
```typescript
onEnter: (context) => {
    const isPlayer = context.actor.type === 'player';
    const damage = isPlayer ? 1 : 999;
    
    return {
        effects: [
            { type: 'Damage', target: context.actor.id, amount: damage }
        ],
        messages: [`${context.actor.id} takes ${damage} damage!`]
    };
}
```

## 🎯 Built-In Effects

### Lava Sink
- **ID**: `lava_sink`
- **onPass**: 5 damage, -2 momentum
- **onEnter**: 999 damage, stun, interrupt

### Ice
- **ID**: `ice`
- **onPass**: No momentum reduction (preserves slide)
- **onEnter**: Flash effect

### Void
- **ID**: `void`
- **onPass**: 10 damage, -3 momentum
- **onEnter**: 999 damage, interrupt

### Snare Trap
- **ID**: `snare_trap`
- **onPass**: Stun, momentum = 0, interrupt

## 🔍 Context Properties

```typescript
interface TileEffectContext {
    actor: Actor;              // The unit interacting with the tile
    state: GameState;          // Current game state
    momentum?: number;         // Current momentum (for kinetic movements)
    isFinalDestination: boolean; // True if this is where movement ends
    source?: Point;            // Where the movement started
}
```

## 📤 Return Values

```typescript
interface TileEffectResult {
    effects: AtomicEffect[];   // Effects to apply
    messages: string[];        // Messages to display
    newMomentum?: number;      // Modified momentum (optional)
    interrupt?: boolean;       // Stop movement chain (optional)
}
```

## 🎨 Adding Juice

### Visual Effects
```typescript
effects: [
    { type: 'Juice', effect: 'shake', intensity: 'medium' },
    { type: 'Juice', effect: 'flash', target: context.actor.position },
    { type: 'Juice', effect: 'combat_text', target: context.actor.position, text: 'Boom!' }
]
```

### Available Juice Types
- `shake`: Camera shake
- `flash`: Flash effect
- `combat_text`: Floating text
- `impact`: Impact visual
- `lavaSink`: Lava vaporize effect
- `freeze`: Freeze frame

## 🧪 Testing

### Create a Test Scenario
```typescript
export const MY_SCENARIO = {
    id: 'my_test',
    title: 'Test My Effect',
    description: 'Tests that my effect works',
    
    setup: (engine: any) => {
        engine.state.player.position = { q: 0, r: 0, s: 0 };
        engine.state.myTilePositions = [{ q: 1, r: 0, s: -1 }];
    },
    
    run: (engine: any) => {
        engine.dispatch({ type: 'MOVE', payload: { q: 1, r: 0, s: -1 } });
    },
    
    verify: (state: GameState, logs: string[]): boolean => {
        // Check that effect was applied
        return state.player.hp < state.player.maxHp;
    }
};
```

### Add to Test Suite
```typescript
import { MY_SCENARIO } from '../scenarios/my_scenarios';

it('should apply my effect', () => {
    MY_SCENARIO.setup(engine);
    engine.state.initiativeQueue = buildInitiativeQueue(engine.state);
    
    // Advance to player's turn
    while (/* not player's turn */) {
        engine.dispatch({ type: 'ADVANCE_TURN' });
    }
    
    MY_SCENARIO.run(engine);
    const result = MY_SCENARIO.verify(engine.state, engine.logs);
    expect(result).toBe(true);
});
```

## 🐛 Debugging

### Check if Effect is Registered
```typescript
import { TILE_EFFECT_REGISTRY } from './systems/tile-effects';
console.log(TILE_EFFECT_REGISTRY['my_effect']);
```

### Check if Effect Applies
```typescript
import { getTileEffectsAt } from './systems/tile-effects';
const effects = getTileEffectsAt(position, state);
console.log('Effects at position:', effects.map(e => e.id));
```

### Test Effect Manually
```typescript
import { processTilePass, processTileEnter } from './systems/tile-effects';

const result = processTilePass(position, actor, state, momentum);
console.log('Effects:', result.effects);
console.log('New momentum:', result.newMomentum);
console.log('Interrupted:', result.interrupt);
```

## ⚠️ Common Mistakes

### ❌ Don't Modify State Directly
```typescript
// BAD
onEnter: (context) => {
    context.actor.hp -= 10; // Don't mutate!
    return { effects: [], messages: [] };
}

// GOOD
onEnter: (context) => {
    return {
        effects: [
            { type: 'Damage', target: context.actor.id, amount: 10 }
        ],
        messages: []
    };
}
```

### ❌ Don't Forget to Return Momentum
```typescript
// BAD - Momentum will be undefined
onPass: (context) => ({
    effects: [],
    messages: []
})

// GOOD - Preserve momentum if not modifying
onPass: (context) => ({
    effects: [],
    messages: [],
    newMomentum: context.momentum // Pass through unchanged
})
```

### ❌ Don't Use onPass for Final Destination
```typescript
// BAD - Use onEnter instead
onPass: (context) => {
    if (context.isFinalDestination) {
        // This should be in onEnter!
    }
}

// GOOD
onEnter: (context) => {
    // Logic for when unit lands here
}
```

## 📚 More Information

- Full documentation: `docs/TILE_EFFECTS_SYSTEM.md`
- Refactor summary: `docs/TILE_EFFECTS_REFACTOR_SUMMARY.md`
- Source code: `packages/engine/src/systems/tile-effects.ts`
- Test examples: `packages/engine/src/scenarios/tile_effects.ts`
