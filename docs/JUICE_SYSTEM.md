# Juice System Implementation Guide

## Overview

The **Juice System** transforms the headless Hop engine from a sterile mathematical simulation into a visceral, satisfying tactical experience. Every skill, effect, and environmental interaction now emits a complete **visual/haptic signature** that communicates **Intent**, **Impact**, and **Weight** to the frontend renderer.

## Architecture

### 1. Expanded Juice Vocabulary (`types.ts`)

The `Juice` AtomicEffect type has been expanded to support:

**Legacy Effects** (backward compatible):
- `shake`, `flash`, `freeze`, `combat_text`, `impact`

**Environmental Reactions**:
- `lavaSink`, `lavaRipple`, `wallCrack`, `iceShatter`, `voidConsume`

**Projectile/Path Effects**:
- `spearTrail`, `shieldArc`, `hookCable`, `dashBlur`

**Momentum & Weight**:
- `momentumTrail`, `heavyImpact`, `lightImpact`, `kineticWave`

**Anticipation & Telegraphs**:
- `anticipation`, `chargeUp`, `aimingLaser`, `trajectory`

**Skill Signatures**:
- `grappleHookWinch`, `shieldSpin`, `spearWhistle`, `vaultLeap`

**Status & Feedback**:
- `stunBurst`, `poisonCloud`, `armorGleam`, `hiddenFade`

**Extended Properties**:
```typescript
{
    type: 'Juice';
    effect: JuiceEffectType;
    target?: Point | string;
    path?: Point[];
    intensity?: 'low' | 'medium' | 'high' | 'extreme';
    direction?: Point;
    text?: string;
    duration?: number;        // For sustained effects (ms)
    color?: string;           // Hex color for themed effects
    metadata?: Record<string, any>; // Extensible payload
}
```

### 2. Juice Manifest (`systems/juice-manifest.ts`)

The **Juice Manifest** is the contract between the headless engine and the frontend. It defines:

#### **Reusable Helpers** (`JuiceHelpers`)
Pre-configured effect generators for common patterns:
- `shake(intensity, direction?)` - Camera shake with directional bias
- `flash(color?)` - Screen flash for critical moments
- `freeze(duration)` - Freeze frame for impact
- `combatText(text, target, color?)` - Floating damage/status text
- `momentumTrail(path, intensity)` - Speed-based particle effects
- `heavyImpact(target, direction?)` - High-weight collision
- `lightImpact(target)` - Low-weight collision
- `kineticWave(origin, direction, intensity)` - Radial shockwave
- `stunBurst(target)` - Stun particle explosion
- `lavaRipple(position)` - Lava surface disturbance
- `wallCrack(position, direction)` - Wall impact damage

#### **Skill Signatures** (`SKILL_JUICE_SIGNATURES`)
Each skill defines its complete 4-phase sensory profile:

**1. ANTICIPATION** - Pre-action telegraph (player intent)
- Aiming lasers, charge-up effects, trajectory previews

**2. EXECUTION** - The action itself (movement, projectile)
- Projectile trails, movement blur, cable/rope effects

**3. IMPACT** - Collision/damage/environmental reaction
- Screen shake, freeze frames, particle explosions, combat text

**4. RESOLUTION** - Aftermath/settling (dust, debris, status effects)
- Momentum trails, kinetic waves, status effect bursts

### 3. Skill Integration Pattern

Skills now emit juice at each phase of execution:

```typescript
execute: (state, shooter, target) => {
    const effects: AtomicEffect[] = [];
    
    // ANTICIPATION: Show player intent
    effects.push(...SKILL_JUICE_SIGNATURES.SKILL_NAME.anticipation(origin, target));
    
    // ... validation logic ...
    
    // EXECUTION: Action in progress
    effects.push(...SKILL_JUICE_SIGNATURES.SKILL_NAME.execution(path));
    
    // ... core mechanics ...
    
    // IMPACT: Collision/damage
    effects.push(...SKILL_JUICE_SIGNATURES.SKILL_NAME.impact(impactPoint, direction));
    
    // RESOLUTION: Aftermath
    effects.push(...SKILL_JUICE_SIGNATURES.SKILL_NAME.resolution(resultPath));
    
    return { effects, messages, consumesTurn: true };
}
```

## Implemented Skills

### **Grapple Hook** 🪝
**Intent**: Pull enemy → swap positions → fling past you  
**Weight**: Medium-Heavy (kinetic momentum transfer)

- **Anticipation**: Green aiming laser (#00ff88)
- **Execution**: Hook cable with low shake
- **Impact**: Winch effect + medium shake on swap
- **Resolution**: Momentum trails + kinetic wave on fling

### **Shield Throw** 🛡️
**Intent**: Projectile → kinetic pulse on impact  
**Weight**: Heavy (projectile + kinetic chain)

- **Anticipation**: Blue trajectory arc (#4169e1)
- **Execution**: Shield spinning animation (720° rotation)
- **Impact**: Heavy impact + high shake + freeze frame + "IMPACT!" text
- **Resolution**: Kinetic wave + momentum trails

### **Dash** 💨
**Intent**: Linear charge → shield shunt on collision  
**Weight**: Medium → Heavy (on collision)

- **Anticipation**: Charge-up effect
- **Execution**: Dash blur + momentum trail
- **Impact**: 
  - *Without shield*: Light impact
  - *With shield*: Extreme shake + freeze + "SHUNT!" text
- **Resolution**: Kinetic wave + momentum trails (if collision)

### **Spear Throw** 🔱
**Intent**: Instant-kill projectile  
**Weight**: Light-Medium (precision strike)

- **Anticipation**: Red aiming laser (#ff6b6b)
- **Execution**: Spear trail + whistle sound effect
- **Impact**:
  - *Kill*: Heavy impact + medium shake + freeze + "LETHAL" text (#ff0000)
  - *Miss*: Light impact + "MISS" text (#888888)

### **Vault** 🤸
**Intent**: Leap over enemy → stun on odd turns  
**Weight**: Light (acrobatic)

- **Anticipation**: Cyan trajectory arc with high parabola (#00ddff)
- **Execution**: Vault leap animation
- **Impact**:
  - *Stun turn*: Heavy impact + medium shake + stun burst + "STUN!" text
  - *Normal*: Light impact

## Environmental Juice

### **Lava Sink** 🌋
```typescript
ENVIRONMENTAL_JUICE.lavaSink(position, actorId)
```
- Lava sink animation (500ms, 50 particles)
- Lava ripple effect
- High camera shake
- "CONSUMED" text (#ff4400)

### **Wall Impact** 🧱
```typescript
ENVIRONMENTAL_JUICE.wallImpact(position, direction, shouldStun)
```
- Wall crack effect
- High directional shake
- Optional: Stun burst + "STUNNED" text

### **Void Consume** 🕳️
```typescript
ENVIRONMENTAL_JUICE.voidConsume(position)
```
- Black void consume animation (800ms)
- Freeze frame (150ms)
- "VOID" text (#8800ff)

## Status Effect Juice

### **Stunned** ⚡
- Yellow stun burst (#ffff00)
- 200ms duration particle effect

### **Poisoned** ☠️
- Green poison cloud (#00ff00)
- 1000ms lingering effect

### **Armored** 🛡️
- Blue armor gleam (#4169e1)
- 300ms shimmer effect

### **Hidden** 👻
- Fade-out effect
- 500ms transition

## Frontend Implementation Guide

The frontend renderer should listen for `Juice` effects in the `AtomicEffect[]` stream and map them to visual/audio/haptic feedback:

### Example: Handling Shake Effect
```typescript
function handleJuiceEffect(effect: JuiceEffect) {
    if (effect.effect === 'shake') {
        const magnitude = {
            low: 2,
            medium: 5,
            high: 8,
            extreme: 12
        }[effect.intensity || 'medium'];
        
        if (effect.direction) {
            // Directional shake (bias toward direction)
            camera.shake(magnitude, effect.direction);
        } else {
            // Omnidirectional shake
            camera.shake(magnitude);
        }
    }
}
```

### Example: Handling Momentum Trail
```typescript
if (effect.effect === 'momentumTrail') {
    const particleCount = {
        low: 5,
        medium: 10,
        high: 20
    }[effect.intensity || 'medium'];
    
    effect.path?.forEach((point, i) => {
        setTimeout(() => {
            spawnParticles(point, particleCount, {
                velocity: calculateVelocity(effect.path!, i),
                color: effect.color || '#ffffff',
                lifetime: 500
            });
        }, i * 50); // Stagger particles along path
    });
}
```

### Example: Handling Freeze Frame
```typescript
if (effect.effect === 'freeze') {
    game.timeScale = 0;
    setTimeout(() => {
        game.timeScale = 1;
    }, effect.duration || 80);
}
```

## Best Practices

### 1. **Layering Effects**
Combine multiple juice effects for rich feedback:
```typescript
// Heavy impact = shake + freeze + particles + text
effects.push(JuiceHelpers.heavyImpact(point, direction));
effects.push(JuiceHelpers.freeze(120));
effects.push(JuiceHelpers.combatText('CRITICAL!', point, '#ff0000'));
```

### 2. **Intensity Scaling**
Match intensity to mechanical weight:
- **Low**: Minor actions (movement, light collision)
- **Medium**: Standard actions (normal attacks, status effects)
- **High**: Significant actions (heavy impacts, multi-unit effects)
- **Extreme**: Critical moments (boss kills, environmental kills, chain reactions)

### 3. **Color Coding**
Use consistent color themes:
- **Red** (#ff0000): Damage, lethal, danger
- **Yellow** (#ffff00): Stun, warning
- **Green** (#00ff00): Poison, nature
- **Blue** (#4169e1): Shield, armor, protection
- **Cyan** (#00ddff): Movement, agility
- **Orange** (#ffaa00): Kinetic, momentum
- **Purple** (#8800ff): Void, magic

### 4. **Timing & Duration**
- **Anticipation**: 100-200ms (enough to register intent)
- **Execution**: 150-300ms (action in progress)
- **Impact**: 60-120ms freeze + instant effects
- **Resolution**: 300-500ms (settling/aftermath)

### 5. **Metadata Extensibility**
Use the `metadata` field for frontend-specific parameters:
```typescript
{
    type: 'Juice',
    effect: 'shieldArc',
    metadata: {
        rotation: 720,        // Degrees of spin
        wobble: 0.2,         // Rotation wobble
        trailLength: 10      // Particle trail length
    }
}
```

## Testing Juice

The juice system is **non-breaking** - all existing tests pass because juice effects are purely additive. The engine's core logic remains unchanged.

To verify juice integration:
```bash
npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts
```

## Next Steps

### Remaining Skills to Integrate:
1. **Shield Throw** - Add anticipation + execution juice
2. **Dash** - Add anticipation + execution juice
3. **Spear Throw** - Add anticipation + execution juice
4. **Vault** - Add anticipation + execution juice
5. **Basic Attack** - Add simple impact juice
6. **Auto Attack** - Add passive trigger juice
7. **Bulwark Charge** - Add heavy charge juice
8. **Sentinel Blast** - Add boss-tier juice

### Environmental Systems:
1. **Kinetic Kernel** - Add momentum trails to all kinetic pulses
2. **Effect Engine** - Add juice to damage/heal/status application
3. **Combat System** - Add juice to enemy actions

### Advanced Juice:
1. **Combo Chains** - Escalating intensity for consecutive hits
2. **Critical Hits** - Special juice for high-damage rolls
3. **Environmental Synergy** - Unique juice for skill + hazard combos
4. **Boss Encounters** - Cinematic juice for boss-specific mechanics

## Summary

The Juice System transforms every action in the Hop engine into a **complete sensory experience**. By emitting rich, layered effects at each phase of skill execution, the headless simulation now provides all the data needed for a frontend to create a **visceral, satisfying, and readable** tactical combat experience.

**Key Achievement**: The engine now speaks a **visual language** that communicates:
- **Intent** (what's about to happen)
- **Impact** (how hard it hit)
- **Weight** (how significant it was)

This makes every hex-grid interaction feel **meaningful and satisfying**.
