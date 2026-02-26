# ECS Lite Consistency Refactor

## Problem Statement
The current ECS-Lite system has inconsistencies in how entities are created and managed:
- Some entities have skills in `activeSkills`, others have empty arrays
- The Falcon entity is created with special-case logic instead of following the same pattern
- Enemy stats define skills in constants, but they're not always applied consistently
- Basic behaviors like movement and attack aren't consistently represented as skills

## Goal
**Every entity should be consistent:**
1. **Basic Stats**: hp, maxHp, speed, factionId, etc.
2. **Traits/Components**: weightClass, archetype, isFlying, etc. (via components map)
3. **Skill Loadout**: Every entity gets a loadout of skills (BASIC_MOVE, BASIC_ATTACK, etc.)

## Design Principles

### 1. Universal Entity Structure
```typescript
interface Actor {
  // Identity
  id: string;
  type: 'player' | 'enemy';
  subtype?: string; // 'footman', 'falcon', etc.
  
  // Core Stats
  position: Point;
  hp: number;
  maxHp: number;
  speed: number;
  factionId: string;
  
  // Status System
  statusEffects: StatusEffect[];
  temporaryArmor: number;
  
  // Skill System - EVERY entity has this
  activeSkills: Skill[];
  
  // Components (traits, special behaviors)
  components?: Map<string, GameComponent>;
}
```

### 2. Skill-Based Behavior
All entity behaviors should be skill-based:
- **BASIC_MOVE**: Standard movement (range based on `speed` stat)
- **BASIC_ATTACK**: Melee attack (range 1, damage 1)
- **AUTO_ATTACK**: Passive auto-attack behavior
- **FALCON_PECK**: Falcon's basic attack
- **FALCON_SCOUT**: Falcon's patrol behavior
- etc.

### 3. Entity Factory Pattern
Create entities through factory functions that ensure consistency:
```typescript
function createEntity(config: EntityConfig): Actor {
  return {
    ...baseStats,
    activeSkills: buildSkillLoadout(config.skills),
    components: buildComponents(config.traits),
  };
}
```

## Implementation Plan

### Phase 1: Skill Definitions
- [ ] Ensure BASIC_MOVE is properly defined ✅ (already exists)
- [ ] Ensure BASIC_ATTACK is properly defined ✅ (already exists)
- [ ] Create FALCON_PECK skill (basic attack for falcon)
- [ ] Create FALCON_SCOUT skill (patrol behavior)
- [ ] Create FALCON_HUNT skill (predator behavior)

### Phase 2: Entity Factory
- [ ] Create `src/systems/entity-factory.ts`
- [ ] Implement `createPlayer(config)` factory
- [ ] Implement `createEnemy(config)` factory
- [ ] Implement `createFalcon(config)` factory
- [ ] Update ENEMY_STATS to include skill loadouts

### Phase 3: Update Entity Creation
- [ ] Update `logic.ts` to use entity factories
- [ ] Update `map.ts` to use `createEnemy()` factory
- [ ] Update `falcon_command.ts` to use `createFalcon()` factory
- [ ] Update test utilities to use factories

### Phase 4: Falcon Refactor
- [ ] Falcon gets BASIC_MOVE skill (with isFlying trait for special movement)
- [ ] Falcon gets FALCON_PECK skill instead of hardcoded attack
- [ ] Falcon behavior driven by its skill loadout
- [ ] Remove special-case falcon logic from effect-engine

### Phase 5: Validation
- [ ] Run all scenario tests
- [ ] Verify falcon behavior works correctly
- [ ] Verify enemy AI still works
- [ ] Update documentation

## Benefits
1. **Consistency**: All entities follow the same pattern
2. **Testability**: Easier to test individual skills
3. **Extensibility**: Easy to add new entity types
4. **Clarity**: Clear separation between stats, traits, and behaviors
5. **Maintainability**: Less special-case code
