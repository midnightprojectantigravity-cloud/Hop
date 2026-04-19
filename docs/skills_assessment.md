# Skills, Combat & Companions: Data-Driven Assessment

**Date:** April 17, 2026

**Scope:** `packages/engine/src/skills`, `packages/engine/src/types.ts`, `packages/engine/src/data/companions`, `packages/engine/src/data/contracts.ts`, `packages/engine/src/systems/combat`

This document is the canonical human-readable assessment and normalized JSON-style inventory of every skill, its upgrade tree, the combat damage taxonomy, and companion definitions in the Hop engine. It is grounded in the live codebase and generated runtime metadata, but the JSON blocks below are assessment snapshots rather than verbatim generated runtime payloads.

Runtime ownership truth still lives in `artifacts/skills/skill-library.metadata.json`; current generated runtime metadata reports `totalSkills: 51`, `executionHandlerCount: 0`, `capabilityHandlerCount: 0`, and `handlerRatio: 0`. Separately, `packages/engine/src/generated/skill-registry.generated.ts` is now only the residual compositional TypeScript registry and currently contains 2 skills.

Biome note: the arcade proof now splits applied biome from authored content. `themeId` selects the rendered biome/hazard flavor (`inferno` or `void`), while `contentThemeId` keeps the authored 10-floor arcade family on `inferno` content so Vanguard and Hunter share the same floor structure and enemy/layout plan.

---

## 1. Registry Summary

| Metric | Count |
|---|---|
| Source files in `src/skills/` | 52 |
| Residual compositional skills (`skill-registry.generated.ts`) | 2 |
| Live runtime skills (`skill-library.metadata.json`) | 51 |
| Slot: offensive | 15 |
| Slot: defensive | 3 |
| Slot: utility | 14 |
| Slot: passive | 19 |
| Skills with non-empty upgrade trees | 11 |
| Total upgrade definitions | 37 |
| Capability-provider passives | 11 |
| Skills with summon/companion interaction | 8 |
| Companion types | 2 |
| Loadout definitions | 6 |

---

## 2. Combat Damage Taxonomy

```json
{
  "damageClasses": ["physical", "magical", "true"],
  "damageSubClasses": ["melee", "strike", "slash", "piercing", "shot", "blast", "spell", "touch", "status", "neutral"],
  "damageElements": ["neutral", "fire", "ice", "void", "shadow", "arcane", "holy", "death", "kinetic", "poison", "wet"],
  "attackProfiles": ["melee", "projectile", "spell", "status"],
  "defaults": {
    "damageClass": "physical",
    "damageSubClass": "melee",
    "damageElement": "neutral"
  }
}
```

---

## 3. Full Skill Definitions (JSON)

### 3.1 Offensive Skills (15)

```json
[
  {
    "id": "ARCHER_SHOT",
    "name": "Archer Shot",
    "description": "Fire an arrow in a straight line at a hostile target.",
    "slot": "offensive",
    "icon": "🏹",
    "baseVariables": { "range": 4, "cost": 0, "cooldown": 0, "damage": 3 },
    "combat": { "damageClass": "physical", "damageSubClass": "shot", "damageElement": "neutral", "attackProfile": "projectile", "trackingSignature": "projectile", "weights": { "instinct": 1 } },
    "targeting": { "mode": "single", "pattern": "axial", "minRange": 2, "maxRange": 4, "requiresLos": true, "requiresEnemy": true },
    "upgrades": {}
  },
  {
    "id": "BOMB_TOSS",
    "name": "Bomb Toss",
    "description": "Throw a bomb to a nearby tile.",
    "slot": "offensive",
    "icon": "💣",
    "baseVariables": { "range": 3, "cost": 0, "cooldown": 2 },
    "targeting": { "mode": "single", "pattern": "area", "range": 3, "requiresEmpty": true, "requiresWalkable": true },
    "upgrades": {}
  },
  {
    "id": "BULWARK_CHARGE",
    "name": "Bulwark Charge",
    "description": "Charge into an adjacent enemy, pushing a chain. Wall hard-stop stuns the chain.",
    "slot": "offensive",
    "icon": "🛡️▶️",
    "baseVariables": { "range": 1, "cost": 0, "cooldown": 3 },
    "targeting": { "mode": "single", "pattern": "neighbors", "range": 1, "requiresEnemy": true },
    "executionHandler": "bulwark_charge",
    "upgrades": {}
  },
  {
    "id": "CORPSE_EXPLOSION",
    "name": "Corpse Explosion",
    "description": "Detonate a target corpse, dealing damage in a 1-tile radius.",
    "slot": "offensive",
    "icon": "🧨💀",
    "baseVariables": { "range": 4, "cost": 1, "cooldown": 2, "basePower": 2, "damage": 1 },
    "combat": { "damageClass": "magical", "attackProfile": "spell", "trackingSignature": "magic", "weights": { "mind": 1 } },
    "targeting": { "mode": "single", "pattern": "area", "range": 4, "requiresCorpse": true, "aoeRadius": 1 },
    "upgrades": {}
  },
  {
    "id": "DEATH_TOUCH",
    "name": "Death Touch",
    "description": "Touch a target and deal death elemental damage. Range 1.",
    "slot": "offensive",
    "icon": "☠️",
    "baseVariables": { "range": 1, "cost": 1, "cooldown": 1, "basePower": 2, "damage": 4 },
    "combat": { "damageClass": "magical", "damageSubClass": "touch", "damageElement": "death", "attackProfile": "spell", "trackingSignature": "magic", "weights": { "mind": 1 } },
    "targeting": { "mode": "single", "pattern": "neighbors", "range": 1, "requiresEnemy": true },
    "resourceProfile": { "primaryResource": "mana", "primaryCost": 10, "baseStrain": 15, "countsAsAction": true },
    "upgrades": {}
  },
  {
    "id": "FALCON_APEX_STRIKE",
    "name": "Apex Strike",
    "description": "The falcon dives into a target for lethal damage.",
    "slot": "offensive",
    "icon": "⚡",
    "baseVariables": { "range": 4, "cost": 0, "cooldown": 2, "damage": 40 },
    "combat": { "damageClass": "physical", "attackProfile": "melee", "trackingSignature": "melee", "weights": { "instinct": 1 } },
    "targeting": { "mode": "single", "pattern": "area", "range": 4, "requiresEnemy": true },
    "companionOnly": true,
    "upgrades": {}
  },
  {
    "id": "FALCON_COMMAND",
    "name": "Falcon Command",
    "description": "Summon and command your hunting falcon.",
    "slot": "offensive",
    "icon": "🦅",
    "baseVariables": { "range": 4, "cost": 0, "cooldown": 0 },
    "targeting": { "mode": "modal", "modes": ["summon", "roost", "scout", "predator"] },
    "companionLink": "falcon",
    "upgrades": {
      "KEEN_SIGHT": { "id": "KEEN_SIGHT", "name": "Keen Sight", "description": "Falcon reveals hidden enemies within 3 tiles." },
      "FALCON_TWIN_TALONS": { "id": "FALCON_TWIN_TALONS", "name": "Twin Talons", "description": "Peck hits 2 adjacent targets." },
      "APEX_PREDATOR": { "id": "APEX_PREDATOR", "name": "Apex Predator", "description": "Apex Strike cooldown reduced by 1." }
    }
  },
  {
    "id": "FALCON_PECK",
    "name": "Peck",
    "description": "The falcon pecks an adjacent enemy for 1 damage.",
    "slot": "offensive",
    "icon": "🦅",
    "baseVariables": { "range": 1, "cost": 0, "cooldown": 0, "damage": 1 },
    "combat": { "damageClass": "physical", "attackProfile": "melee", "trackingSignature": "melee", "weights": { "instinct": 1 } },
    "targeting": { "mode": "single", "pattern": "neighbors", "range": 1, "requiresEnemy": true },
    "companionOnly": true,
    "upgrades": {
      "TWIN_TALONS": { "id": "TWIN_TALONS", "name": "Twin Talons", "description": "Peck hits 2 adjacent targets instead of 1." }
    }
  },
  {
    "id": "FIREBALL",
    "name": "Fireball",
    "description": "Hurl a ball of fire. Deals fire damage and ignites the ground.",
    "slot": "offensive",
    "icon": "🔥",
    "baseVariables": { "range": 3, "cost": 1, "cooldown": 2, "basePower": 2, "damage": 3 },
    "combat": { "damageClass": "magical", "damageSubClass": "blast", "damageElement": "fire", "attackProfile": "spell", "trackingSignature": "magic", "weights": { "mind": 1 } },
    "targeting": { "mode": "single", "pattern": "axial", "range": 3, "aoeRadius": 1 },
    "upgrades": {}
  },
  {
    "id": "GRAPPLE_HOOK",
    "name": "Grapple Hook",
    "description": "Pull/Zip mechanism with multi-phase kinetic resolution.",
    "slot": "offensive",
    "icon": "🪝",
    "baseVariables": { "range": 4, "cost": 0, "cooldown": 2, "momentum": 4 },
    "targeting": { "mode": "single", "pattern": "axial", "range": 4, "requiresLos": true, "includeWalls": true },
    "executionHandler": "grapple_hook",
    "upgrades": {}
  },
  {
    "id": "MULTI_SHOOT",
    "name": "Multi-Shoot",
    "description": "A spread of arrows. Axial range 4. Deals damage to target and neighbors.",
    "slot": "offensive",
    "icon": "🏹",
    "baseVariables": { "range": 4, "cost": 1, "cooldown": 1, "damage": 1 },
    "combat": { "damageClass": "physical", "attackProfile": "projectile", "trackingSignature": "projectile", "weights": { "instinct": 1, "mind": 1 } },
    "targeting": { "mode": "single", "pattern": "axial", "range": 4, "aoeRadius": 1 },
    "upgrades": {}
  },
  {
    "id": "SENTINEL_BLAST",
    "name": "Sentinel Blast",
    "description": "A massive energy surge from the Sentinel.",
    "slot": "offensive",
    "icon": "💥",
    "baseVariables": { "range": 3, "cost": 0, "cooldown": 0, "basePower": 2, "damage": 1 },
    "combat": { "damageClass": "magical", "attackProfile": "spell", "trackingSignature": "magic", "weights": { "mind": 1 } },
    "targeting": { "mode": "single", "pattern": "area", "range": 3, "aoeRadius": 1 },
    "upgrades": {}
  },
  {
    "id": "SENTINEL_TELEGRAPH",
    "name": "Sentinel Telegraph",
    "description": "The Sentinel marks an impact zone for a delayed blast.",
    "slot": "offensive",
    "icon": "⚠",
    "baseVariables": { "range": 3, "cost": 0, "cooldown": 0 },
    "targeting": { "mode": "single", "pattern": "area", "range": 3 },
    "upgrades": {}
  },
  {
    "id": "SNEAK_ATTACK",
    "name": "Sneak Attack",
    "description": "Attack an adjacent enemy. Deals massive damage if executed from stealth.",
    "slot": "offensive",
    "icon": "🗡️👤",
    "baseVariables": { "range": 1, "cost": 0, "cooldown": 0, "damage": 3 },
    "combat": { "damageClass": "physical", "attackProfile": "melee", "trackingSignature": "melee", "weights": { "instinct": 1 } },
    "targeting": { "mode": "single", "pattern": "neighbors", "range": 1, "requiresEnemy": true },
    "conditionalBonusDamage": { "condition": "stealthCounter > 0", "bonus": 2 },
    "upgrades": {}
  },
  {
    "id": "SPEAR_THROW",
    "name": "Spear Throw",
    "description": "Throw your spear in a straight line. Pickup to retrieve.",
    "slot": "offensive",
    "icon": "🗡️",
    "baseVariables": { "range": 3, "cost": 0, "cooldown": 0, "basePower": 2, "damage": 3, "momentum": 4 },
    "combat": { "damageClass": "physical", "damageSubClass": "piercing", "damageElement": "neutral", "attackProfile": "projectile", "trackingSignature": "projectile", "weights": { "body": 1 } },
    "targeting": { "mode": "single", "pattern": "axial", "range": 3, "requiresLos": true },
    "executionHandler": "spear_throw",
    "upgrades": {
      "LONG_THROW": { "id": "LONG_THROW", "name": "Long Throw", "description": "+1 Range", "patches": [{ "field": "range", "op": "add", "value": 1 }] },
      "HEAVY_THROW": { "id": "HEAVY_THROW", "name": "Heavy Throw", "description": "+5 momentum", "patches": [{ "field": "momentum", "op": "add", "value": 5 }] },
      "SHARPENED_TIP": { "id": "SHARPENED_TIP", "name": "Sharpened Tip", "description": "+1 Damage", "patches": [{ "field": "damage", "op": "add", "value": 1 }] },
      "DEEP_BREATH": { "id": "DEEP_BREATH", "name": "Deep Breath", "description": "-1 Cooldown", "patches": [{ "field": "cooldown", "op": "add", "value": -1 }] },
      "BLEED_EDGE": { "id": "BLEED_EDGE", "name": "Bleed Edge", "description": "Applies bleed ailment on hit" },
      "MOMENTUM_STRIKE": { "id": "MOMENTUM_STRIKE", "name": "Momentum Strike", "description": "Momentum +2 when retrieving spear from adjacent hex" },
      "PINNING_THROW": { "id": "PINNING_THROW", "name": "Pinning Throw", "description": "Spear pins first target, rooting them for 1 turn" }
    }
  }
]
```

### 3.2 Defensive Skills (3)

```json
[
  {
    "id": "KINETIC_TRI_TRAP",
    "name": "Kinetic Tri-Trap",
    "description": "Deploy 3 hidden traps on axial tiles. Triggered enemies are flung away.",
    "slot": "defensive",
    "icon": "🪤",
    "baseVariables": { "range": 2, "cost": 0, "cooldown": 3 },
    "targeting": { "mode": "self", "autoPlace": true },
    "constants": { "trapCount": 3, "flingMagnitude": 3, "trapResetCooldown": 2 },
    "upgrades": {
      "VOLATILE_CORE": { "id": "VOLATILE_CORE", "name": "Volatile Core", "description": "Traps deal 1 damage when triggered." },
      "TRAP_CHAIN_REACTION": { "id": "TRAP_CHAIN_REACTION", "name": "Chain Reaction", "description": "When a trap triggers, adjacent traps also activate." },
      "QUICK_RELOAD": { "id": "QUICK_RELOAD", "name": "Quick Reload", "description": "Individual trap reset cooldown reduced to 1." }
    }
  },
  {
    "id": "SHIELD_BASH",
    "name": "Shield Bash",
    "description": "Bash an adjacent enemy with your shield.",
    "slot": "defensive",
    "icon": "🛡️",
    "baseVariables": { "range": 1, "cost": 0, "cooldown": 2, "basePower": 99, "damage": 1 },
    "targeting": { "mode": "single", "pattern": "neighbors", "range": 1, "requiresEnemy": true },
    "executionHandler": "shield_bash",
    "upgrades": {
      "SHIELD_RANGE": { "id": "SHIELD_RANGE", "name": "Extended Bash", "description": "Range +1", "patches": [{ "field": "range", "op": "add", "value": 1 }] },
      "SHIELD_COOLDOWN": { "id": "SHIELD_COOLDOWN", "name": "Quick Recovery", "description": "Cooldown -1", "patches": [{ "field": "cooldown", "op": "add", "value": -1 }] },
      "SHIELD_SHUNT_DAMAGE": { "id": "SHIELD_SHUNT_DAMAGE", "name": "Shunt Damage", "description": "+1 shield bash damage", "patches": [{ "field": "damage", "op": "add", "value": 1 }] },
      "ARC_BASH": { "id": "ARC_BASH", "name": "Arc Bash", "description": "Bash hits 3-hex frontal arc (+1 CD)", "groupId": "bash_shape", "incompatibleWith": ["BASH_360"] },
      "BASH_360": { "id": "BASH_360", "name": "360° Bash", "description": "Bash hits all neighbors (+1 CD)", "groupId": "bash_shape", "incompatibleWith": ["ARC_BASH"] },
      "PASSIVE_PROTECTION": { "id": "PASSIVE_PROTECTION", "name": "Passive Protection", "description": "+1 temp armor when shield not on cooldown" }
    }
  },
  {
    "id": "SHIELD_THROW",
    "name": "Shield Throw",
    "description": "Hurl your shield in a straight line.",
    "slot": "defensive",
    "icon": "🛡️🔄",
    "baseVariables": { "range": 3, "cost": 0, "cooldown": 2, "momentum": 3 },
    "targeting": { "mode": "single", "pattern": "axial", "range": 3, "requiresLos": true },
    "executionHandler": "shield_throw",
    "upgrades": {}
  }
]
```

### 3.3 Utility Skills (14)

```json
[
  {
    "id": "FALCON_AUTO_ROOST",
    "name": "Auto Roost",
    "description": "Automatically returns the falcon to roost mode when mark is lost.",
    "slot": "utility",
    "icon": "R",
    "baseVariables": { "range": 0, "cost": 0, "cooldown": 0 },
    "companionOnly": true,
    "upgrades": {}
  },
  {
    "id": "FALCON_HEAL",
    "name": "Roost Heal",
    "description": "The falcon roosts and restores health to its companion.",
    "slot": "utility",
    "icon": "✨",
    "baseVariables": { "range": 1, "cost": 0, "cooldown": 1 },
    "companionOnly": true,
    "effects": [{ "kind": "HEAL", "target": "owner", "amount": 1 }],
    "upgrades": {}
  },
  {
    "id": "FALCON_SCOUT",
    "name": "Scout Orbit",
    "description": "The actor orbits a target point in a hexagonal ring.",
    "slot": "utility",
    "icon": "👁️",
    "baseVariables": { "range": 1, "cost": 0, "cooldown": 0 },
    "companionOnly": true,
    "upgrades": {}
  },
  {
    "id": "FIREWALK",
    "name": "Firewalk",
    "description": "Teleport to a fire or lava tile. Grants 2 turns of Fire Immunity.",
    "slot": "utility",
    "icon": "🏃🔥",
    "baseVariables": { "range": 4, "cost": 1, "cooldown": 3 },
    "targeting": { "mode": "single", "pattern": "area", "range": 4, "requiresSurface": ["fire", "lava"], "movementKind": "teleport" },
    "effects": [
      { "kind": "DISPLACEMENT", "movementKind": "teleport" },
      { "kind": "APPLY_STATUS", "statusId": "fire_immunity", "duration": 2 }
    ],
    "upgrades": {}
  },
  {
    "id": "FIREWALL",
    "name": "Firewall",
    "description": "Create a wall of flames 5 tiles wide. Area denial.",
    "slot": "utility",
    "icon": "🧱",
    "baseVariables": { "range": 4, "cost": 1, "cooldown": 4, "basePower": 1, "damage": 1 },
    "combat": { "damageClass": "magical", "damageSubClass": "blast", "damageElement": "fire", "attackProfile": "spell", "trackingSignature": "magic", "weights": { "mind": 1 } },
    "targeting": { "mode": "single", "pattern": "axial", "range": 4, "aoeShape": "perpLine5" },
    "effects": [
      { "kind": "PLACE_SURFACE", "surfaceType": "fire", "duration": 3, "shape": "perpLine5" },
      { "kind": "DEAL_DAMAGE", "toActorsOnSurface": true }
    ],
    "upgrades": {}
  },
  {
    "id": "JUMP",
    "name": "Jump",
    "description": "Leap to an empty tile within range. Can cross lava but not walls.",
    "slot": "utility",
    "icon": "🦘",
    "baseVariables": { "range": 2, "cost": 0, "cooldown": 2, "basePower": 99, "damage": 1 },
    "combat": { "damageClass": "physical", "attackProfile": "melee", "trackingSignature": "melee", "weights": { "body": 1 } },
    "targeting": { "mode": "single", "pattern": "area", "range": 2, "movementKind": "flight", "ignoreGroundHazards": true },
    "upgrades": {
      "JUMP_RANGE": { "id": "JUMP_RANGE", "name": "Extended Jump", "description": "Jump range +1" },
      "JUMP_COOLDOWN": { "id": "JUMP_COOLDOWN", "name": "Nimble", "description": "Jump cooldown -1", "patches": [{ "field": "cooldown", "op": "add", "value": -1 }] },
      "STUNNING_LANDING": { "id": "STUNNING_LANDING", "name": "Stunning Landing", "description": "All enemies within 1 hex of landing are stunned" },
      "METEOR_IMPACT": { "id": "METEOR_IMPACT", "name": "Meteor Impact", "description": "Can land on enemies to kill them" },
      "FREE_JUMP": { "id": "FREE_JUMP", "name": "Free Jump", "description": "Can move after jumping" }
    }
  },
  {
    "id": "RAISE_DEAD",
    "name": "Raise Dead",
    "description": "Reanimate a target corpse into an owner-aligned Skeleton minion.",
    "slot": "utility",
    "icon": "💀✨",
    "baseVariables": { "range": 4, "cost": 1, "cooldown": 3 },
    "targeting": { "mode": "single", "pattern": "area", "range": 4, "requiresCorpse": true },
    "summon": {
      "companionType": "skeleton",
      "visualAssetRef": "/Hop/assets/bestiary/unit.skeleton.basic.01.webp",
      "trinity": { "body": 12, "mind": 2, "instinct": 4 },
      "skills": ["BASIC_MOVE", "BASIC_ATTACK", "AUTO_ATTACK"],
      "behavior": { "controller": "generic_ai", "anchorActorId": "owner" }
    },
    "upgrades": {}
  },
  {
    "id": "SET_TRAP",
    "name": "Set Trap",
    "description": "Place a hidden trap. Roots units for 3 turns.",
    "slot": "utility",
    "icon": "🪤",
    "baseVariables": { "range": 1, "cost": 1, "cooldown": 2 },
    "targeting": { "mode": "single", "pattern": "neighbors", "range": 1, "requiresWalkable": true },
    "effects": [{ "kind": "PLACE_TRAP", "rootDuration": 3 }],
    "upgrades": {}
  },
  {
    "id": "SHADOW_STEP",
    "name": "Shadow Step",
    "description": "Teleport through the shadows. Only works while invisible. Extends stealth.",
    "slot": "utility",
    "icon": "👤✨",
    "baseVariables": { "range": 2, "cost": 0, "cooldown": 2 },
    "targeting": { "mode": "single", "pattern": "area", "range": 2, "movementKind": "teleport", "requiresStealth": true },
    "effects": [
      { "kind": "DISPLACEMENT", "movementKind": "teleport" },
      { "kind": "SET_STEALTH", "amount": 2 }
    ],
    "upgrades": {}
  },
  {
    "id": "SMOKE_SCREEN",
    "name": "Smoke Screen",
    "description": "Vanish into a cloud of smoke. Adds +2 to stealth counter.",
    "slot": "utility",
    "icon": "💨👤",
    "baseVariables": { "range": 0, "cost": 0, "cooldown": 2 },
    "targeting": { "mode": "self" },
    "effects": [{ "kind": "SET_STEALTH", "amount": 2 }],
    "upgrades": {
      "BLINDING_SMOKE": { "id": "BLINDING_SMOKE", "name": "Blinding Smoke", "description": "Adjacent hostile units are blinded for 1 turn." }
    }
  },
  {
    "id": "SOUL_SWAP",
    "name": "Soul Swap",
    "description": "Instantly swap positions with a player-aligned minion.",
    "slot": "utility",
    "icon": "🔁👻",
    "baseVariables": { "range": 6, "cost": 0, "cooldown": 3 },
    "targeting": { "mode": "single", "pattern": "area", "range": 6, "requiresAllyMinion": true },
    "effects": [{ "kind": "SWAP_POSITIONS", "target": "selectedMinion" }],
    "upgrades": {}
  },
  {
    "id": "SWIFT_ROLL",
    "name": "Swift Roll",
    "description": "Quickly dodge 2 tiles.",
    "slot": "utility",
    "icon": "🤸",
    "baseVariables": { "range": 2, "cost": 0, "cooldown": 2 },
    "targeting": { "mode": "single", "pattern": "area", "range": 2, "requiresEmpty": true },
    "effects": [{ "kind": "DISPLACEMENT", "movementKind": "dash" }],
    "upgrades": {}
  },
  {
    "id": "VAULT",
    "name": "Vault",
    "description": "Leap to an empty tile. Alternates between normal and stun landing each turn.",
    "slot": "utility",
    "icon": "🏃",
    "baseVariables": { "range": 3, "cost": 0, "cooldown": 0 },
    "targeting": { "mode": "single", "pattern": "area", "range": 3, "movementKind": "flight", "ignoreGroundHazards": true },
    "stateShifting": { "condition": "turnNumber % 2 !== 0", "trueVariant": "Stun Vault", "falseVariant": "Vault" },
    "upgrades": {}
  },
  {
    "id": "WITHDRAWAL",
    "name": "Withdrawal",
    "description": "Quick shot + tactical backroll. Auto-triggers when enemies close in.",
    "slot": "utility",
    "icon": "↩️",
    "baseVariables": { "range": 1, "cost": 0, "cooldown": 2, "basePower": 4, "damage": 4 },
    "combat": { "damageClass": "physical", "attackProfile": "projectile", "trackingSignature": "projectile", "weights": { "instinct": 1 } },
    "targeting": { "mode": "single", "pattern": "neighbors", "range": 1, "requiresEnemy": true },
    "passiveReaction": { "trigger": "enemyEntersAdjacentHex", "consumesCooldown": true },
    "upgrades": {
      "PARTING_SHOT": { "id": "PARTING_SHOT", "name": "Parting Shot", "description": "Withdrawal deals +1 damage." },
      "NIMBLE_FEET": { "id": "NIMBLE_FEET", "name": "Nimble Feet", "description": "Backroll distance increased to 3 hexes." },
      "HAIR_TRIGGER": { "id": "HAIR_TRIGGER", "name": "Hair Trigger", "description": "Passive reaction does not consume cooldown." }
    }
  }
]
```

### 3.4 Passive Skills (19)

```json
[
  {
    "id": "ABSORB_FIRE",
    "name": "Absorb Fire",
    "description": "Convert fire damage into healing.",
    "slot": "passive",
    "icon": "🔥→❤️",
    "baseVariables": { "range": 0, "cost": 0, "cooldown": 0 },
    "upgrades": {}
  },
  {
    "id": "AUTO_ATTACK",
    "name": "Auto Attack",
    "description": "Automatically strike adjacent enemies that started the turn adjacent to you.",
    "slot": "passive",
    "icon": "👊",
    "baseVariables": { "range": 1, "cost": 0, "cooldown": 0, "damage": 1 },
    "combat": { "damageClass": "physical", "attackProfile": "melee", "trackingSignature": "melee", "weights": { "body": 1 } },
    "passiveTrigger": "endOfTurn",
    "upgrades": {
      "HEAVY_HANDS": { "id": "HEAVY_HANDS", "name": "Heavy Hands", "description": "Auto-attack damage +1" },
      "CLEAVE": { "id": "CLEAVE", "name": "Cleave", "description": "When auto-attack triggers, hit ALL adjacent enemies" }
    }
  },
  {
    "id": "BASIC_ATTACK",
    "name": "Basic Attack",
    "description": "Strike an adjacent enemy for 1 damage.",
    "slot": "passive",
    "icon": "⚔️",
    "baseVariables": { "range": 1, "cost": 0, "cooldown": 0, "damage": 1 },
    "combat": { "damageClass": "physical", "damageSubClass": "melee", "damageElement": "neutral", "attackProfile": "melee", "trackingSignature": "melee", "weights": { "body": 1 } },
    "targeting": { "mode": "single", "pattern": "neighbors", "range": 1, "requiresEnemy": true },
    "upgrades": {
      "EXTENDED_REACH": { "id": "EXTENDED_REACH", "name": "Disciplined Stance", "description": "+1 damage when attacking without moving first.", "requiresStationary": true, "patches": [{ "field": "damage", "op": "add", "value": 1 }] },
      "POWER_STRIKE": { "id": "POWER_STRIKE", "name": "Power Strike", "description": "Damage +2", "patches": [{ "field": "damage", "op": "add", "value": 2 }] },
      "VAMPIRIC": { "id": "VAMPIRIC", "name": "Vampiric", "description": "Leech life from damage dealt", "patches": [{ "field": "leechRatio", "op": "set", "scaledValue": 10000 }] }
    }
  },
  {
    "id": "BASIC_AWARENESS",
    "name": "Basic Awareness",
    "description": "Provide basic information about the current environment.",
    "slot": "passive",
    "icon": "BA",
    "baseVariables": { "range": 0, "cost": 0, "cooldown": 0 },
    "capabilities": { "information": [{ "providerId": "basic_awareness.info", "priority": 1 }] },
    "upgrades": {}
  },
  {
    "id": "BASIC_MOVE",
    "name": "Walk",
    "description": "Move to an adjacent or nearby tile within your speed range.",
    "slot": "passive",
    "icon": "👣",
    "baseVariables": { "range": 1, "cost": 0, "cooldown": 0 },
    "targeting": { "mode": "single", "generator": "movement_reachable", "rangeSource": "actor_speed" },
    "movementPolicy": { "rangeSource": "actor_speed", "freeMoveRangeOverride": 20 },
    "executionHandler": "basic_move",
    "upgrades": {}
  },
  {
    "id": "BLIND_FIGHTING",
    "name": "Blind Fighting",
    "description": "Mitigate unseen-target penalties in close combat.",
    "slot": "passive",
    "icon": "BF",
    "baseVariables": { "range": 0, "cost": 0, "cooldown": 0 },
    "capabilities": { "movement": [{ "providerId": "blind_fighting.unseen_penalty", "priority": 5, "resolutionMode": "EXTEND", "model": { "unseenAttackPenaltyMultiplier": 0.5 } }] },
    "upgrades": {}
  },
  {
    "id": "BURROW",
    "name": "Burrow",
    "description": "Extend movement to tunnel through walls and hazards.",
    "slot": "passive",
    "icon": "BU",
    "baseVariables": { "range": 0, "cost": 0, "cooldown": 0 },
    "capabilities": { "movement": [{ "providerId": "burrow.movement", "priority": 20, "resolutionMode": "EXTEND", "model": { "ignoreGroundHazards": true, "ignoreWalls": true } }] },
    "upgrades": {}
  },
  {
    "id": "COMBAT_ANALYSIS",
    "name": "Combat Analysis",
    "description": "Reveal enemy trinity stats with sufficient Mind.",
    "slot": "passive",
    "icon": "CA",
    "baseVariables": { "range": 0, "cost": 0, "cooldown": 0 },
    "capabilities": { "information": [{ "providerId": "combat_analysis.stats", "priority": 20, "condition": "mind >= 10", "reveal": { "trinityStats": true } }] },
    "upgrades": {}
  },
  {
    "id": "DASH",
    "name": "Kinetic Dash",
    "description": "Dash in a straight line. With a shield, slam into enemies and send them flying!",
    "slot": "passive",
    "icon": "💨",
    "baseVariables": { "range": 4, "cost": 0, "cooldown": 0 },
    "targeting": { "mode": "single", "pattern": "axial", "range": 4 },
    "executionHandler": "dash",
    "upgrades": {
      "MOMENTUM_SURGE": { "id": "MOMENTUM_SURGE", "name": "Momentum Surge", "description": "+2 Momentum when dashing with shield" },
      "DASH_CHAIN_REACTION": { "id": "DASH_CHAIN_REACTION", "name": "Chain Reaction", "description": "Enemies pushed into other enemies transfer momentum" }
    }
  },
  {
    "id": "ENEMY_AWARENESS",
    "name": "Enemy Awareness",
    "description": "Hostile perception package for detection, chase memory, and butcher pressure.",
    "slot": "passive",
    "icon": "EA",
    "baseVariables": { "range": 4, "cost": 0, "cooldown": 0 },
    "capabilities": { "senses": [{ "providerId": "enemy_awareness.los", "priority": 10, "statScaling": "instinct*0.060 + mind*0.025 + body*0.015" }] },
    "upgrades": {}
  },
  {
    "id": "FLIGHT",
    "name": "Flight",
    "description": "Replace walking movement with aerial traversal.",
    "slot": "passive",
    "icon": "FL",
    "baseVariables": { "range": 0, "cost": 0, "cooldown": 0 },
    "capabilities": { "movement": [{ "providerId": "flight.movement", "priority": 30, "resolutionMode": "REPLACE", "model": { "pathing": "flight", "ignoreGroundHazards": true } }] },
    "upgrades": {}
  },
  {
    "id": "ORACLE_SIGHT",
    "name": "Oracle's Sight",
    "description": "Reveal top enemy action utilities when provided by caller context.",
    "slot": "passive",
    "icon": "OS",
    "baseVariables": { "range": 0, "cost": 0, "cooldown": 0 },
    "capabilities": { "information": [{ "providerId": "oracle_sight.utilities", "priority": 30, "reveal": { "topActionUtilities": true } }] },
    "upgrades": {}
  },
  {
    "id": "PHASE_STEP",
    "name": "Phase Step",
    "description": "Replace movement with short-range phasing teleports.",
    "slot": "passive",
    "icon": "PS",
    "baseVariables": { "range": 0, "cost": 0, "cooldown": 0 },
    "capabilities": { "movement": [{ "providerId": "phase_step.movement", "priority": 35, "resolutionMode": "REPLACE", "model": { "pathing": "teleport", "ignoreGroundHazards": true, "ignoreWalls": true, "allowPassThroughActors": true, "rangeModifier": -1 } }] },
    "upgrades": {}
  },
  {
    "id": "STANDARD_VISION",
    "name": "Standard Vision",
    "description": "Visual line-of-sight for fog reveal. Range scales by vision tier and total core stats.",
    "slot": "passive",
    "icon": "SV",
    "baseVariables": { "range": 3, "cost": 0, "cooldown": 0 },
    "capabilities": { "senses": [{ "providerId": "standard_vision.los", "priority": 10, "rangeFormula": "clamp(3 + tier + floor(statPool/100), 3, 11)" }] },
    "upgrades": {
      "VISION_TIER_2": { "id": "VISION_TIER_2", "name": "Vision Tier II", "description": "Increase visual tier by 1." },
      "VISION_TIER_3": { "id": "VISION_TIER_3", "name": "Vision Tier III", "description": "Increase visual tier by 1." },
      "VISION_TIER_4": { "id": "VISION_TIER_4", "name": "Vision Tier IV", "description": "Increase visual tier by 1." }
    }
  },
  {
    "id": "TACTICAL_INSIGHT",
    "name": "Tactical Insight",
    "description": "Reveal enemy intent and planned actions.",
    "slot": "passive",
    "icon": "TI",
    "baseVariables": { "range": 0, "cost": 0, "cooldown": 0 },
    "capabilities": { "information": [{ "providerId": "tactical_insight.intents", "priority": 25, "reveal": { "enemyIntent": true } }] },
    "upgrades": {}
  },
  {
    "id": "THEME_HAZARDS",
    "name": "Theme Hazards",
    "description": "Environmental hazard driver for themed floors.",
    "slot": "passive",
    "icon": "ENV",
    "baseVariables": { "range": 0, "cost": 0, "cooldown": 0 },
    "upgrades": {}
  },
  {
    "id": "TIME_BOMB",
    "name": "Time Bomb",
    "description": "Detonates when the fuse reaches zero.",
    "slot": "passive",
    "icon": "💥",
    "baseVariables": { "range": 0, "cost": 0, "cooldown": 0, "damage": 1 },
    "passiveTrigger": "fuseExpiry",
    "upgrades": {}
  },
  {
    "id": "VIBRATION_SENSE",
    "name": "Vibration Sense",
    "description": "Detect nearby hidden entities through ground vibrations.",
    "slot": "passive",
    "icon": "VS",
    "baseVariables": { "range": 0, "cost": 0, "cooldown": 0 },
    "capabilities": { "senses": [{ "providerId": "vibration_sense.tremor", "priority": 15, "range": 3, "detectsStealth": true }] },
    "upgrades": {}
  },
  {
    "id": "VOLATILE_PAYLOAD",
    "name": "Volatile Payload",
    "description": "Explode on death.",
    "slot": "passive",
    "icon": "💣",
    "baseVariables": { "range": 0, "cost": 0, "cooldown": 0 },
    "passiveTrigger": "onDeath",
    "upgrades": {}
  }
]
```

---

## 4. Companion Definitions (JSON)

```json
{
  "companions": {
    "falcon": {
      "subtype": "falcon",
      "name": "Falcon",
      "role": "utility_predator",
      "powerBudgetClass": "utility_light",
      "weightClass": "Light",
      "armorBurdenTier": "None",
      "trinity": { "body": 4, "mind": 6, "instinct": 18 },
      "speed": 95,
      "hp": 84,
      "maxHp": 84,
      "skills": ["BASIC_MOVE", "FALCON_PECK", "FALCON_APEX_STRIKE", "FALCON_HEAL", "FALCON_SCOUT", "FALCON_AUTO_ROOST"],
      "combatProfile": {
        "outgoingPhysical": 1.2,
        "outgoingMagical": 1,
        "incomingPhysical": 1,
        "incomingMagical": 1
      },
      "evaluationExcludedFromEnemyBudget": true,
      "summonedBy": "FALCON_COMMAND",
      "modes": {
        "roost": {
          "id": "roost",
          "commandName": "Falcon: Roost",
          "commandDescription": "Falcon returns to you. Heals and cleanses 1 debuff on arrival.",
          "overlay": {
            "id": "falcon_roost",
            "source": "command",
            "sourceId": "falcon_roost",
            "rangeModel": "owner_proximity",
            "selfPreservationBias": 0.35,
            "controlBias": 0.2,
            "commitBias": -0.3
          },
          "anchor": "owner"
        },
        "scout": {
          "id": "scout",
          "commandName": "Falcon: Scout",
          "commandDescription": "Click tile to set patrol zone. Falcon orbits and attacks nearby enemies.",
          "overlay": {
            "id": "falcon_scout",
            "source": "command",
            "sourceId": "falcon_scout",
            "rangeModel": "anchor_proximity",
            "controlBias": 0.35,
            "selfPreservationBias": 0.15,
            "commitBias": -0.1
          },
          "anchor": "point"
        },
        "predator": {
          "id": "predator",
          "commandName": "Falcon: Hunt",
          "commandDescription": "Click enemy to mark as prey. Falcon pursues and uses Apex Strike.",
          "overlay": {
            "id": "falcon_predator",
            "source": "command",
            "sourceId": "falcon_predator",
            "desiredRange": [1, 2],
            "offenseBias": 0.35,
            "commitBias": 0.3,
            "preferDamageOverPositioning": true
          },
          "anchor": "actor"
        }
      }
    },
    "skeleton": {
      "subtype": "skeleton",
      "name": "Skeleton",
      "role": "attrition_body",
      "powerBudgetClass": "summon_swarm",
      "weightClass": "Standard",
      "armorBurdenTier": "Medium",
      "trinity": { "body": 12, "mind": 2, "instinct": 6 },
      "speed": 50,
      "hp": 86,
      "maxHp": 86,
      "skills": ["BASIC_MOVE", "BASIC_ATTACK"],
      "combatProfile": {
        "outgoingPhysical": 1.1,
        "outgoingMagical": 1,
        "incomingPhysical": 1,
        "incomingMagical": 1
      },
      "evaluationExcludedFromEnemyBudget": true,
      "summonedBy": "RAISE_DEAD",
      "modes": null
    }
  }
}
```

---

## 5. Loadout Definitions (JSON)

```json
{
  "loadouts": {
    "VANGUARD": {
      "id": "VANGUARD",
      "name": "Vanguard",
      "description": "Direct damage, brawling, and area denial.",
      "startingSkills": ["BASIC_MOVE", "BASIC_ATTACK", "AUTO_ATTACK", "SPEAR_THROW", "SHIELD_BASH", "JUMP"]
    },
    "SKIRMISHER": {
      "id": "SKIRMISHER",
      "name": "Skirmisher",
      "description": "Zero direct damage. Kinetic momentum and environmental lethality.",
      "startingSkills": ["DASH", "GRAPPLE_HOOK", "SHIELD_THROW", "VAULT"]
    },
    "FIREMAGE": {
      "id": "FIREMAGE",
      "name": "Fire Mage",
      "description": "Area control with fire and high-damage spells.",
      "startingSkills": ["BASIC_MOVE", "BASIC_ATTACK", "ABSORB_FIRE", "FIREBALL", "FIREWALL", "FIREWALK"]
    },
    "NECROMANCER": {
      "id": "NECROMANCER",
      "name": "Necromancer",
      "description": "Utilize death and reanimation.",
      "startingSkills": ["BASIC_MOVE", "BASIC_ATTACK", "DEATH_TOUCH", "RAISE_DEAD", "SOUL_SWAP"]
    },
    "HUNTER": {
      "id": "HUNTER",
      "name": "Hunter",
      "description": "Ranged precision and traps.",
      "startingSkills": ["BASIC_MOVE", "BASIC_ATTACK", "FALCON_COMMAND", "KINETIC_TRI_TRAP", "WITHDRAWAL"]
    },
    "ASSASSIN": {
      "id": "ASSASSIN",
      "name": "Assassin",
      "description": "Stealth and high burst damage.",
      "startingSkills": ["BASIC_MOVE", "BASIC_ATTACK", "SNEAK_ATTACK", "SMOKE_SCREEN", "SHADOW_STEP"]
    }
  }
}
```

---

## 6. Upgrade Resolution System

The upgrade system in `packages/engine/src/systems/skill-upgrade-resolution.ts` provides deterministic patch-based skill mutation:

### Patchable fields (10)

| Field | Operations | Used by |
|---|---|---|
| `range` | add, multiply, set | SHIELD_BASH, SPEAR_THROW |
| `cooldown` | add, multiply, set | SHIELD_BASH, SPEAR_THROW, JUMP |
| `damage` | add, multiply, set | BASIC_ATTACK, SPEAR_THROW, SHIELD_BASH |
| `basePower` | add, multiply, set | — |
| `momentum` | add, multiply, set | SPEAR_THROW |
| `leechRatio` | set | BASIC_ATTACK (Vampiric) |
| `damageClass` | set (string) | — |
| `damageSubClass` | set (string) | — |
| `damageElement` | set (string) | — |
| `attackProfile` | set (string) | — |

### Resolution constraints

| Feature | Description |
|---|---|
| `maxRanks` | Cap how many times an upgrade can be applied |
| `tier` | Ordering priority for application |
| `priority` | Secondary sort key |
| `groupId` / `exclusiveGroup` | Mutual exclusion within a group |
| `requires` | Prerequisite upgrades with optional `minRank` |
| `requiredUpgrades` | Simple prerequisite list |
| `requiresPointsInSkill` | Minimum total invested upgrade ranks |
| `incompatibleWith` | Blacklist specific other upgrades |
| `requiresStationary` | Only active if actor didn't move this turn |
| `rankMode: 'linear'` | Scale patch value linearly with rank |

---

## 7. Architecture Assessment

### What is fully data-driven today

- `baseVariables` on all 51 skills
- `combat` taxonomy on 20 skills with combat profiles
- Upgrade tree structure with 10 patchable fields
- Companion stats, roles, modes, and behavior overlays
- Loadout definitions
- Intent profile auto-hydration from skill metadata

### What still has legacy or compatibility surfaces

| Skill count | Category | Examples |
|---|---|---|
| 15 | Movement/displacement parity complexity | BASIC_MOVE, DASH, JUMP, VAULT, GRAPPLE_HOOK |
| 11 | Upgrade-heavy semantic coverage | SPEAR_THROW, SHIELD_BASH, JUMP, DASH, WITHDRAWAL |
| 11 | Capability compatibility bridge surface | STANDARD_VISION, ENEMY_AWARENESS, FLIGHT |
| 8 | Companion/modal parity surface | FALCON_COMMAND mode switching |
| 9 | Near-ready data patterns | FIREBALL, DEATH_TOUCH |
| 8 | Trivial or passive surfaces | ABSORB_FIRE, VOLATILE_PAYLOAD |

### Migration readiness

| Cohort | Count | Description |
|---|---|---|
| Data-ready | 8 | No execute logic needed: ABSORB_FIRE, BASIC_AWARENESS, BLIND_FIGHTING, COMBAT_ANALYSIS, ENEMY_AWARENESS, ORACLE_SIGHT, TACTICAL_INSIGHT, VOLATILE_PAYLOAD |
| Near-ready | 9 | Simple effect composition: DEATH_TOUCH, FIREBALL, FIREWALL, FIREWALK, BOMB_TOSS, CORPSE_EXPLOSION, SENTINEL_BLAST, SENTINEL_TELEGRAPH, THEME_HAZARDS |
| Upgrade-heavy | 11 | Require keyword decoupling: SHIELD_BASH, SPEAR_THROW, BASIC_ATTACK, FALCON_COMMAND, FALCON_PECK, JUMP, KINETIC_TRI_TRAP, DASH, WITHDRAWAL, SMOKE_SCREEN, STANDARD_VISION |
| Modal/summon | 8 | Companion spawning and mode switching: FALCON_COMMAND + falcon skills, RAISE_DEAD, SOUL_SWAP |
| Movement-heavy | 15 | Complex spatial logic: BASIC_MOVE, AUTO_ATTACK, JUMP, DASH, GRAPPLE_HOOK, VAULT, SHADOW_STEP, SWIFT_ROLL, WITHDRAWAL, BULWARK_CHARGE, SHIELD_THROW, SNEAK_ATTACK, MULTI_SHOOT, ARCHER_SHOT, SET_TRAP |
