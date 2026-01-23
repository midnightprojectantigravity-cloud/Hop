# Smooth Movement System

## Overview

All unit displacements in the Hop engine now include **path information** for smooth, tile-by-tile animation. Units no longer teleport - they smoothly traverse each hex along their movement path.

## Displacement Effect Structure

```typescript
{
    type: 'Displacement',
    target: 'player-1',
    destination: { q: 5, r: 3, s: -8 },  // Final position
    path: [                               // Full movement path
        { q: 3, r: 3, s: -6 },           // Start
        { q: 4, r: 3, s: -7 },           // Intermediate
        { q: 5, r: 3, s: -8 }            // End
    ],
    animationDuration: 180                // Suggested total duration (ms)
}
```

## Animation Timing

Different skills have different movement speeds:

| Skill | Duration per Tile | Total Duration | Feel |
|-------|------------------|----------------|------|
| **Dash** | 60ms | `path.length * 60` | Fast, aggressive |
| **Vault** | 250ms (total) | 250ms | Slow, acrobatic leap |
| **Kinetic Pulse (single tile)** | 100ms | 100ms | Medium, forceful |
| **Kinetic Pulse (multi-tile)** | 80ms | `path.length * 80` | Fast, momentum-driven |

## Frontend Implementation

### Basic Interpolation

```typescript
class MovementAnimator {
    animateDisplacement(effect: DisplacementEffect, unit: Unit) {
        if (!effect.path || effect.path.length <= 1) {
            // Instant teleport (fallback)
            unit.position = effect.destination;
            return;
        }

        const duration = effect.animationDuration || (effect.path.length * 100);
        const timePerTile = duration / (effect.path.length - 1);

        // Animate through each tile
        effect.path.forEach((point, index) => {
            setTimeout(() => {
                unit.position = point;
                this.renderUnit(unit);
            }, index * timePerTile);
        });
    }
}
```

### Smooth Interpolation (Recommended)

```typescript
class SmoothMovementAnimator {
    animateDisplacement(effect: DisplacementEffect, unit: Unit) {
        if (!effect.path || effect.path.length <= 1) {
            unit.position = effect.destination;
            return;
        }

        const duration = effect.animationDuration || (effect.path.length * 100);
        const startTime = Date.now();
        const startPos = effect.path[0];
        const path = effect.path;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Calculate which segment we're on
            const segmentIndex = Math.floor(progress * (path.length - 1));
            const segmentProgress = (progress * (path.length - 1)) - segmentIndex;

            // Interpolate between current and next tile
            const current = path[segmentIndex];
            const next = path[Math.min(segmentIndex + 1, path.length - 1)];

            unit.position = {
                q: current.q + (next.q - current.q) * segmentProgress,
                r: current.r + (next.r - current.r) * segmentProgress,
                s: current.s + (next.s - current.s) * segmentProgress
            };

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                unit.position = effect.destination;
            }
        };

        requestAnimationFrame(animate);
    }
}
```

### Parabolic Arc (for Vault)

```typescript
animateVaultLeap(effect: DisplacementEffect, unit: Unit) {
    if (!effect.path) return;

    const duration = effect.animationDuration || 250;
    const startTime = Date.now();
    const path = effect.path;

    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Linear horizontal movement
        const segmentIndex = Math.floor(progress * (path.length - 1));
        const segmentProgress = (progress * (path.length - 1)) - segmentIndex;
        const current = path[segmentIndex];
        const next = path[Math.min(segmentIndex + 1, path.length - 1)];

        const basePos = {
            q: current.q + (next.q - current.q) * segmentProgress,
            r: current.r + (next.r - current.r) * segmentProgress,
            s: current.s + (next.s - current.s) * segmentProgress
        };

        // Parabolic vertical offset (arc)
        const arcHeight = 2.0; // tiles
        const verticalOffset = arcHeight * Math.sin(progress * Math.PI);

        unit.position = basePos;
        unit.visualOffset = { y: -verticalOffset * TILE_HEIGHT };

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            unit.position = effect.destination;
            unit.visualOffset = { y: 0 };
        }
    };

    requestAnimationFrame(animate);
}
```

## Kinetic Pulse Movement

The **Kinetic Kernel** automatically generates path-aware displacements:

### Single Tile Movement (Chain)
```typescript
// Engine emits:
{
    type: 'Displacement',
    target: 'enemy-1',
    destination: { q: 5, r: 3, s: -8 },
    path: [
        { q: 4, r: 3, s: -7 },  // Start
        { q: 5, r: 3, s: -8 }   // End
    ],
    animationDuration: 100  // 100ms for single tile
}
```

### Multi-Tile Movement (Lead Unit)
```typescript
// Engine emits:
{
    type: 'Displacement',
    target: 'enemy-1',
    destination: { q: 7, r: 3, s: -10 },
    path: [
        { q: 4, r: 3, s: -7 },   // Start
        { q: 5, r: 3, s: -8 },   // Tile 1
        { q: 6, r: 3, s: -9 },   // Tile 2
        { q: 7, r: 3, s: -10 }   // End
    ],
    animationDuration: 240  // 80ms per tile * 3 tiles
}
```

## Skill-Specific Behaviors

### Dash 💨
- **Speed**: 60ms per tile (fast)
- **Path**: Linear from origin to collision point
- **Visual**: Motion blur + momentum trail
- **Feel**: Aggressive, forceful charge

### Vault 🤸
- **Speed**: 250ms total (slow)
- **Path**: Linear from origin to landing
- **Visual**: Parabolic arc + leap animation
- **Feel**: Acrobatic, graceful

### Grapple Hook 🪝
- **Pull Phase**: Uses kinetic kernel (100ms per tile)
- **Swap Phase**: Instant (simultaneous swap)
- **Fling Phase**: Uses kinetic kernel (80ms per tile)
- **Visual**: Hook cable + momentum trails

### Shield Throw 🛡️
- **Projectile**: Not a displacement (visual only)
- **Impact**: Uses kinetic kernel for pushed units
- **Visual**: Shield arc + spinning animation

### Kinetic Pulse ⚡
- **Chain Movement**: 100ms per tile (synchronized)
- **Lead Unit**: 80ms per tile (momentum-driven)
- **Visual**: Momentum trails + kinetic wave

## Special Cases

### Instant Teleport
If `path` is undefined or has only 1 element, the frontend should teleport instantly:
```typescript
if (!effect.path || effect.path.length <= 1) {
    unit.position = effect.destination;
    return;
}
```

### Lava Interception
Units may stop mid-path if they hit lava:
```typescript
// Engine emits:
{
    type: 'Displacement',
    target: 'enemy-1',
    destination: { q: 6, r: 3, s: -9 },  // Lava tile
    path: [
        { q: 4, r: 3, s: -7 },
        { q: 5, r: 3, s: -8 },
        { q: 6, r: 3, s: -9 }   // Stops here
    ],
    animationDuration: 160
}
// Followed immediately by:
{
    type: 'LavaSink',
    target: 'enemy-1'
}
```

The frontend should:
1. Animate the full path
2. When reaching the lava tile, trigger the sink animation
3. Remove the unit

## Performance Considerations

### Batching
If multiple units move simultaneously (kinetic chain), stagger their animations slightly for visual clarity:
```typescript
chainUnits.forEach((unit, index) => {
    setTimeout(() => {
        this.animateDisplacement(unit.displacement, unit);
    }, index * 20); // 20ms stagger
});
```

### Easing Functions
Use easing for more natural movement:
- **Dash**: `easeOutQuad` (fast start, slow end)
- **Vault**: `easeInOutSine` (smooth arc)
- **Kinetic Pulse**: `linear` (constant force)

```typescript
const easeOutQuad = (t: number) => t * (2 - t);
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
```

## Testing

All displacement effects now include paths. Test with:
```bash
npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts
```

Watch the `AtomicEffect[]` stream to see path data for each displacement.

## Summary

**Before**: Units teleported from A to B
```typescript
{ type: 'Displacement', target: 'player', destination: B }
```

**After**: Units smoothly traverse A → B
```typescript
{ 
    type: 'Displacement', 
    target: 'player', 
    destination: B,
    path: [A, ...intermediate, B],
    animationDuration: 180
}
```

The engine now provides **complete movement data** for smooth, tile-by-tile animation. No more teleporting - every movement is smooth and visually satisfying! 🎮
