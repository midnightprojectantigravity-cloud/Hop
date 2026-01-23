# Frontend Juice Integration Guide

## Quick Start

The Hop engine emits `Juice` effects in the `AtomicEffect[]` stream. Your frontend renderer should listen for these effects and map them to visual/audio/haptic feedback.

## Effect Categories

### 1. **Anticipation** (Pre-Action Telegraphs)

#### `aimingLaser`
```typescript
{
    type: 'Juice',
    effect: 'aimingLaser',
    target: Point,      // Origin point
    path: Point[],      // Line from origin to target
    intensity: 'low',
    color: string       // '#00ff88' (grapple), '#ff6b6b' (spear)
}
```
**Render**: Thin laser line with pulsing glow, fade in over 100ms

#### `trajectory`
```typescript
{
    type: 'Juice',
    effect: 'trajectory',
    target: Point,      // Origin
    path: Point[],      // Arc path
    intensity: 'low' | 'medium',
    color: string,      // '#4169e1' (shield), '#00ddff' (vault)
    metadata: { arc: 'high' | 'parabolic' }
}
```
**Render**: Dotted arc showing projectile/leap path, with arc height based on metadata

#### `chargeUp`
```typescript
{
    type: 'Juice',
    effect: 'chargeUp',
    target: Point,      // Charging actor position
    direction: Point,   // Direction of charge
    intensity: 'medium',
    duration: 100       // ms
}
```
**Render**: Particle vortex pulling toward actor, screen slight zoom-in

---

### 2. **Execution** (Action in Progress)

#### `hookCable`
```typescript
{
    type: 'Juice',
    effect: 'hookCable',
    path: Point[],
    intensity: 'medium',
    duration: 200,      // ms
    color: '#00ff88'
}
```
**Render**: Animated cable/rope from origin to target, with tension wobble

#### `shieldArc` / `shieldSpin`
```typescript
{
    type: 'Juice',
    effect: 'shieldArc',
    path: Point[],
    intensity: 'high',
    duration: 300,
    metadata: { rotation: 720 }  // Degrees of spin
}
```
**Render**: Shield sprite rotating along path, with motion blur trail

#### `spearTrail` / `spearWhistle`
```typescript
{
    type: 'Juice',
    effect: 'spearTrail',
    path: Point[],
    intensity: 'high',
    duration: 150
}
```
**Render**: Spear sprite with speed lines, whistle sound effect with rising pitch

#### `dashBlur`
```typescript
{
    type: 'Juice',
    effect: 'dashBlur',
    path: Point[],
    intensity: 'high',
    duration: 150
}
```
**Render**: Motion blur effect along path, afterimage trail

#### `vaultLeap`
```typescript
{
    type: 'Juice',
    effect: 'vaultLeap',
    path: Point[],
    intensity: 'medium',
    duration: 250,
    metadata: { arc: 'parabolic' }
}
```
**Render**: Actor sprite following parabolic arc, with shadow on ground

#### `momentumTrail`
```typescript
{
    type: 'Juice',
    effect: 'momentumTrail',
    path: Point[],
    intensity: 'low' | 'medium' | 'high'
}
```
**Render**: Speed-based particle trail:
- **Low**: 5 particles, 300ms lifetime
- **Medium**: 10 particles, 500ms lifetime
- **High**: 20 particles, 700ms lifetime

---

### 3. **Impact** (Collision/Damage)

#### `shake`
```typescript
{
    type: 'Juice',
    effect: 'shake',
    intensity: 'low' | 'medium' | 'high' | 'extreme',
    direction?: Point   // Optional directional bias
}
```
**Render**: Camera shake with magnitude:
- **Low**: 2px, 100ms
- **Medium**: 5px, 150ms
- **High**: 8px, 200ms
- **Extreme**: 12px, 250ms

If `direction` is provided, bias shake toward that direction (70% directional, 30% random)

#### `freeze`
```typescript
{
    type: 'Juice',
    effect: 'freeze',
    duration: 60 | 80 | 100 | 120 | 150  // ms
}
```
**Render**: Set `game.timeScale = 0`, resume after duration

#### `heavyImpact`
```typescript
{
    type: 'Juice',
    effect: 'heavyImpact',
    target: Point | string,
    direction?: Point,
    intensity: 'extreme'
}
```
**Render**: Radial particle explosion (50+ particles), screen flash, sound effect

#### `lightImpact`
```typescript
{
    type: 'Juice',
    effect: 'lightImpact',
    target: Point | string,
    intensity: 'low'
}
```
**Render**: Small particle puff (5-10 particles), soft sound

#### `combat_text`
```typescript
{
    type: 'Juice',
    effect: 'combat_text',
    text: string,       // "IMPACT!", "LETHAL", "SHUNT!", etc.
    target: Point | string,
    color?: string      // '#ff0000', '#ffaa00', etc.
}
```
**Render**: Floating text rising from target, fade out over 1s

---

### 4. **Environmental Reactions**

#### `lavaSink`
```typescript
{
    type: 'Juice',
    effect: 'lavaSink',
    target: Point,
    intensity: 'extreme',
    duration: 500,
    metadata: { particleCount: 50 }
}
```
**Render**: Unit sinking animation, lava bubbles, particle eruption

#### `lavaRipple`
```typescript
{
    type: 'Juice',
    effect: 'lavaRipple',
    target: Point,
    intensity: 'medium'
}
```
**Render**: Concentric ripple waves on lava surface

#### `wallCrack`
```typescript
{
    type: 'Juice',
    effect: 'wallCrack',
    target: Point,
    direction: Point,
    intensity: 'high'
}
```
**Render**: Crack sprite appearing on wall, debris particles

#### `voidConsume`
```typescript
{
    type: 'Juice',
    effect: 'voidConsume',
    target: Point,
    intensity: 'extreme',
    duration: 800,
    color: '#000000'
}
```
**Render**: Black hole vortex effect, screen desaturation, eerie sound

---

### 5. **Momentum & Physics**

#### `kineticWave`
```typescript
{
    type: 'Juice',
    effect: 'kineticWave',
    target: Point,      // Origin
    direction: Point,   // Direction of wave
    intensity: 'low' | 'medium' | 'high'
}
```
**Render**: Expanding shockwave ring from origin, distortion effect

---

### 6. **Status Effects**

#### `stunBurst`
```typescript
{
    type: 'Juice',
    effect: 'stunBurst',
    target: Point | string,
    intensity: 'medium',
    duration: 200,
    color: '#ffff00'
}
```
**Render**: Yellow star particles radiating from target, dizzy animation

#### `poisonCloud`
```typescript
{
    type: 'Juice',
    effect: 'poisonCloud',
    target: Point | string,
    intensity: 'low',
    duration: 1000,
    color: '#00ff00'
}
```
**Render**: Green particle cloud lingering around target

#### `armorGleam`
```typescript
{
    type: 'Juice',
    effect: 'armorGleam',
    target: Point | string,
    intensity: 'medium',
    duration: 300,
    color: '#4169e1'
}
```
**Render**: Blue shimmer effect on unit sprite

#### `hiddenFade`
```typescript
{
    type: 'Juice',
    effect: 'hiddenFade',
    target: Point | string,
    intensity: 'low',
    duration: 500,
    metadata: { fadeOut: true }
}
```
**Render**: Unit sprite fading to 30% opacity

---

## Implementation Example

```typescript
class JuiceRenderer {
    handleJuiceEffect(effect: JuiceEffect) {
        switch (effect.effect) {
            case 'shake':
                this.handleShake(effect);
                break;
            case 'freeze':
                this.handleFreeze(effect);
                break;
            case 'momentumTrail':
                this.handleMomentumTrail(effect);
                break;
            case 'kineticWave':
                this.handleKineticWave(effect);
                break;
            case 'combat_text':
                this.handleCombatText(effect);
                break;
            // ... etc
        }
    }

    private handleShake(effect: JuiceEffect) {
        const magnitude = {
            low: 2,
            medium: 5,
            high: 8,
            extreme: 12
        }[effect.intensity || 'medium'];

        if (effect.direction) {
            // Directional shake
            this.camera.shake(magnitude, effect.direction, 150);
        } else {
            // Omnidirectional shake
            this.camera.shake(magnitude, null, 150);
        }
    }

    private handleMomentumTrail(effect: JuiceEffect) {
        const config = {
            low: { count: 5, lifetime: 300 },
            medium: { count: 10, lifetime: 500 },
            high: { count: 20, lifetime: 700 }
        }[effect.intensity || 'medium'];

        effect.path?.forEach((point, i) => {
            setTimeout(() => {
                this.spawnParticles(point, config.count, {
                    velocity: this.calculateVelocity(effect.path!, i),
                    color: effect.color || '#ffffff',
                    lifetime: config.lifetime
                });
            }, i * 50); // Stagger along path
        });
    }

    private handleKineticWave(effect: JuiceEffect) {
        const radius = {
            low: 100,
            medium: 150,
            high: 200
        }[effect.intensity || 'medium'];

        this.spawnShockwave(effect.target, radius, {
            duration: 300,
            color: '#ffaa00',
            distortion: true
        });
    }

    private handleCombatText(effect: JuiceEffect) {
        this.spawnFloatingText(effect.target, effect.text!, {
            color: effect.color || '#ffffff',
            fontSize: 24,
            duration: 1000,
            rise: 50 // pixels
        });
    }
}
```

## Color Palette

Use consistent colors for themed effects:

| Theme | Color | Usage |
|-------|-------|-------|
| **Damage** | `#ff0000` | Lethal hits, critical damage |
| **Kinetic** | `#ffaa00` | Momentum, shunts, pushes |
| **Stun** | `#ffff00` | Stun effects, warnings |
| **Poison** | `#00ff00` | Poison clouds, nature |
| **Shield** | `#4169e1` | Shield effects, armor |
| **Grapple** | `#00ff88` | Grapple hook, pull effects |
| **Movement** | `#00ddff` | Vault, dash, agility |
| **Void** | `#8800ff` | Void tiles, magic |
| **Lava** | `#ff4400` | Lava effects, fire |

## Performance Tips

1. **Particle Pooling**: Reuse particle objects instead of creating new ones
2. **Batch Rendering**: Group similar effects for single draw call
3. **LOD**: Reduce particle count/quality when zoomed out
4. **Culling**: Don't render effects outside camera view
5. **Throttling**: Limit max simultaneous effects (e.g., 50 active particles max)

## Audio Mapping

Suggested sound effects for each juice type:

- **shake**: Low rumble (pitch varies with intensity)
- **heavyImpact**: Deep thud + metal clang
- **lightImpact**: Soft tap
- **spearWhistle**: Rising pitch whistle
- **hookCable**: Metallic zip + tension creak
- **shieldSpin**: Whoosh with Doppler effect
- **lavaSink**: Bubbling + sizzle
- **wallCrack**: Stone crack + debris scatter
- **stunBurst**: Electric zap
- **kineticWave**: Shockwave boom

## Testing

Use the scenario runner to test juice rendering:
```bash
npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts
```

All scenarios emit complete juice signatures. Watch the `AtomicEffect[]` stream to see the full sensory profile for each skill.

## Summary

The Hop engine provides a **complete sensory vocabulary** through the Juice system. Every action emits rich, layered effects that communicate:
- **Intent** (anticipation effects)
- **Impact** (collision/damage effects)
- **Weight** (intensity scaling)
- **Context** (environmental reactions)

Build your renderer to map these effects to visuals/audio/haptics, and you'll have a **visceral, satisfying tactical combat experience**.
