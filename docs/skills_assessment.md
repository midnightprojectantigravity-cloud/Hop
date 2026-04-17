# Skills System: Data-Driven Roadmap

**Date:** April 8, 2026

**Scope:** `packages/engine/src/skills`, `packages/engine/src/types.ts`, `packages/engine/src/data/companions`, `packages/engine/src/data/contracts.ts`

This document is a **repo-truth roadmap** for migrating the skill system toward fully data-driven JSON definitions covering skills, compositional upgrades, and companion/summon authoring. It replaces earlier assessment drafts with an implementation-grounded structure: current-state truth, architecture gaps, migration cohorts, and a phased roadmap.

## Why This Matters

The skill system is the authoring boundary for three audiences:
1. **Balance iteration** — tuning numbers without touching execute logic.
2. **Dungeon Lab / content tools** — authoring new skills, enemies, and loadouts via structured data.
3. **AI evaluation** — the UPA, IRES, and intent-profile pipelines already consume skill metadata; a JSON-first source of truth removes the scraping layer.

---

## Repo Truth Snapshot

### Current source of truth

The engine still exposes skills through `SkillDefinition`, but the live authoring model is now mixed: most runtime-authored skills are backed by JSON sidecars and the generated runtime registry, while a shrinking set of legacy TypeScript exports remain as parity fixtures or compatibility adapters. The generated metadata (`packages/engine/src/generated/skill-registry.generated.ts` and `artifacts/skills/skill-library.metadata.json`) is the practical source of truth for what is live.

### Live counts (from generated registry)

| Metric | Count |
|---|---|
| Source files in `src/skills/` | 52 |
| Registered skills in generated registry | 51 |
| Runtime-authored skills in metadata | 51 |
| Handler ratio | 0 |
| Slot: offensive | 15 |
| Slot: defensive | 3 |
| Slot: utility | 14 |
| Slot: passive | 19 |
| Skills with non-empty upgrade trees | 11 |
| Capability-provider skills (senses / information / movement) | 11 |
| Companion types | 2 (falcon, skeleton) |
| Loadout definitions | 6 |
| Enemy subtypes using skills | 10 |

### Current strengths

- `baseVariables` (range, cost, cooldown, basePower, damage, momentum) is already pure data on every skill.
- `combat` block (damageClass, damageSubClass, damageElement, attackProfile, trackingSignature, weights) is already pure data where present.
- `SkillModifier` upgrade definitions support tiers, ranks, groups, exclusive groups, prerequisites (`requires`, `requiredUpgrades`, `requiresPointsInSkill`), incompatibilities, stationary conditions, and `SkillUpgradePatchDefinition` numeric patches across 10 fields.
- `resolveVirtualSkillDefinition` in `packages/engine/src/systems/skill-upgrade-resolution.ts` already applies upgrade patches deterministically via clone-and-patch, supporting `set`, `add`, `multiply` operations with `rankMode: 'linear'` scaling.
- `SkillIntentProfile` auto-hydration (`packages/engine/src/systems/skill-intent-profile.ts`) derives intent tags, AI targeting rules, estimates, economy, and risk from skill definitions at registry boot.
- `SkillSummonDefinition` already declares companion type, trinity stats, skills, behavior controller, and overlay anchoring as pure data.
- `COMPANION_BALANCE_CONTENT` in `packages/engine/src/data/companions/content.ts` defines companion stats, roles, power budget classes, skills, and combat profiles as structured data.
- `CompositeSkillDefinition` in `packages/engine/src/data/contracts.ts` provides a parallel data-driven schema with stack-based effects, reaction windows, and upgrade modifiers — but is not yet the universal runtime.

### Current gaps

- `execute()` functions are imperative TypeScript per-skill. They embed targeting validation, upgrade branching (`activeUpgrades.includes('...')`), effect construction, and juice emission inline.
- `getValidTargets()` functions are imperative, with per-skill targeting rules (axial, LOS, corpse-only, range gating).
- Upgrade behavior in complex skills reads upgrade IDs directly rather than reacting to resolved patches or keywords.
- Capability providers (senses, information, movement) use callback-based `resolve()` functions that cannot be expressed as JSON.
- `CompositeSkillDefinition` and `CompositeAtomicEffectDefinition` in `contracts.ts` still define a richer model, but the runtime now already uses the JSON skill bridge for the bulk of the live skill set.
- Companion mode definitions (falcon roost/scout/predator behavior overlays) have been moved into the companion/runtime data path; any remaining work there is parity or cleanup, not foundational migration.

---

## What Is Already Data-Driven

| Surface | Location | Status |
|---|---|---|
| Base variables | `SkillDefinition.baseVariables` | Fully data |
| Combat taxonomy | `SkillDefinition.combat` | Fully data |
| Upgrade tree structure | `SkillDefinition.upgrades` (as `SkillModifier`) | Fully data |
| Upgrade numeric patching | `SkillUpgradePatchDefinition` | 10 patchable fields |
| Upgrade constraints | tiers, groups, ranks, prerequisites, incompatibilities | Fully data |
| Intent profiles | `SkillIntentProfile` | Auto-hydrated |
| Resource / metabolic profiles | `SkillResourceProfile`, `SkillMetabolicBandProfile` | Resolved at merge |
| Summon definitions | `SkillSummonDefinition` | Fully data |
| Companion balance | `COMPANION_BALANCE_CONTENT` | Fully data |
| Enemy bestiary / skill loadouts | `MVP_ENEMY_CONTENT` | Fully data |
| Loadouts | `DEFAULT_LOADOUT_DEFINITIONS` | Fully data |
| Runtime-authored live skills | JSON sidecars + generated runtime metadata | Fully data |

## What Still Requires Imperative Handlers

| Surface | Reason |
|---|---|
| `execute()` | Remaining legacy parity fixtures still carry per-skill mechanics such as pathing, force resolution, and summon edge cases |
| `getValidTargets()` | Per-skill targeting remains imperative on legacy fixtures where the runtime VM has not yet absorbed the full contract |
| Upgrade branching in execute | A small number of legacy execute paths still read `activeUpgrades.includes(...)` directly |
| Capability `resolve()` | Legacy compatibility adapters still translate the declarative runtime capability data into the existing resolver surface |
| Falcon mode switching | Compatibility behavior remains in the falcon command path for old fixtures/tests, even though the live runtime now owns the data |

---

## Migration Cohorts

Skills are grouped by how much work they need to become fully data-authored.

### Cohort 1: Declarative-ready (8 skills)

No meaningful execute logic, no upgrades, no targeting beyond trivial. Can move to JSON-first definitions immediately.

`ABSORB_FIRE`, `BASIC_AWARENESS`, `BLIND_FIGHTING`, `COMBAT_ANALYSIS`, `ENEMY_AWARENESS`, `ORACLE_SIGHT`, `TACTICAL_INSIGHT`, `VOLATILE_PAYLOAD`

### Cohort 2: Near-ready (9 skills)

Simple damage/status/surface effects with standard targeting. No upgrade branching. Require only effect composition vocabulary to become data-driven.

`DEATH_TOUCH`, `FIREBALL`, `FIREWALL`, `FIREWALK`, `BOMB_TOSS`, `CORPSE_EXPLOSION`, `SENTINEL_BLAST`, `SENTINEL_TELEGRAPH`, `THEME_HAZARDS`

### Cohort 3: Upgrade-heavy (11 skills)

Have non-empty upgrade trees that affect execute behavior via `activeUpgrades.includes(...)`. Require the upgrade-to-keyword decoupling pass before their execution can be data-driven.

`SHIELD_BASH` (6 upgrades), `SPEAR_THROW` (7 upgrades), `BASIC_ATTACK`, `FALCON_COMMAND` (3 upgrades), `FALCON_PECK`, `JUMP`, `KINETIC_TRI_TRAP`, `DASH`, `WITHDRAWAL`, `SMOKE_SCREEN`, `STANDARD_VISION`

### Cohort 4: Summon and modal (8 skills)

Involve companion spawning, mode switching, or owner-aligned companion behaviors within execute. Require summon parity and companion authoring support.

`FALCON_COMMAND`, `FALCON_PECK`, `FALCON_APEX_STRIKE`, `FALCON_HEAL`, `FALCON_SCOUT`, `FALCON_AUTO_ROOST`, `RAISE_DEAD`, `SOUL_SWAP`

### Cohort 5: Movement and pathing (15 skills)

Involve displacement, pathfinding, collision resolution, or non-trivial spatial logic in execute. Will require the broadest effect vocabulary expansion.

`BASIC_MOVE`, `AUTO_ATTACK`, `JUMP`, `DASH`, `GRAPPLE_HOOK`, `VAULT`, `SHADOW_STEP`, `SWIFT_ROLL`, `WITHDRAWAL`, `BULWARK_CHARGE`, `SHIELD_THROW`, `SNEAK_ATTACK`, `MULTI_SHOOT`, `ARCHER_SHOT`, `SET_TRAP`

### Cohort overlap

Some skills appear in multiple cohorts (e.g. `DASH` is both upgrade-heavy and movement-heavy). The migration sequence should process them when all their prerequisites are met.

### Capability-provider passive skills (11 skills)

These define `capabilities.senses`, `capabilities.information`, or `capabilities.movement` via callback-based `resolve()` functions. A separate data-driven capability schema is needed before these can leave TypeScript.

`BASIC_AWARENESS`, `BLIND_FIGHTING`, `BURROW`, `COMBAT_ANALYSIS`, `ENEMY_AWARENESS`, `FLIGHT`, `ORACLE_SIGHT`, `PHASE_STEP`, `STANDARD_VISION`, `TACTICAL_INSIGHT`, `VIBRATION_SENSE`

---

## Summons and Companions

### Current implementation

| Companion | Summoned by | Controller | Skills | Mode switching |
|---|---|---|---|---|
| Falcon | `FALCON_COMMAND` (via `createFalcon`) | `generic_ai` | `BASIC_MOVE`, `FALCON_PECK`, `FALCON_APEX_STRIKE`, `FALCON_HEAL`, `FALCON_SCOUT`, `FALCON_AUTO_ROOST` | roost / scout / predator (hardcoded in execute) |
| Skeleton | `RAISE_DEAD` (via `createCompanion`) | `generic_ai` | `BASIC_MOVE`, `BASIC_ATTACK`, `AUTO_ATTACK` | None |

### What is already data-driven

- `SkillSummonDefinition` on `RAISE_DEAD` declares `companionType`, `visualAssetRef`, `trinity`, `skills`, and `behavior` (controller, overlays, anchor).
- `COMPANION_BALANCE_CONTENT` declares stats, roles, power budget classification, combat profiles, and skill loadouts for both falcon and skeleton.
- Behavior overlays on companion modes are already pure-data objects with numeric biases.

### What needs migration

- Falcon mode definitions (roost/scout/predator) are inline in `falcon_command.ts` execute logic. They should move to the companion data layer as declared modes with per-mode overlay configs, anchor rules, and UI text.
- `FALCON_COMMAND` execute becomes a thin dispatcher that reads the mode set and applies the declared effects from the mode definition.
- Add a `modes` field to `CompanionBalanceEntry` (or a new `CompanionDefinition` type) that stores per-mode behavior overlay, anchor rule, and description.

---

## Roadmap

### Phase 0: Document correction (this document)

Replace stale assessment with repo-truth roadmap. No code changes.

**Status:** Complete.

### Phase 1: Metadata sidecar extraction

Extract all non-functional metadata from each skill's TypeScript file into a `.json` sidecar that the registry generator reads. This phase has effectively landed for the current runtime-owned cohort; the remaining work is keeping legacy fixtures and generated runtime metadata in sync.

Sidecar covers: `id`, `name`, `description`, `slot`, `icon`, `tags`, `baseVariables`, `combat`, targeting metadata, `intentProfile` overrides, `resourceProfile`, summon definitions, and the full upgrade tree.

**Work:**
- Define the JSON sidecar schema (extending `CompositeSkillDefinition` from `contracts.ts` where aligned).
- Add sidecar loading to `generateSkillRegistry.ts`.
- Extract metadata from Cohort 1 and Cohort 2 skills first.
- Validate extracted sidecars against live TypeScript definitions in CI.

### Phase 2: Upgrade-to-keyword decoupling

Replace `activeUpgrades.includes('UPGRADE_ID')` branching in execute functions with a keyword-driven model. Each upgrade adds/removes keywords on the resolved skill; execute reads `resolvedKeywords` instead of raw upgrade IDs.

This allows the upgrade tree and its behavioral effects to be 100% JSON-defined. The imperative handler only needs to check keywords.

**Work:**
- Add `resolvedKeywords: Set<string>` to the virtual skill resolution output.
- Migrate Cohort 3 skills one at a time, converting includes-checks to keyword reads.
- Validate via existing scenario tests.

### Phase 3: Effect composition vocabulary

Extend `CompositeAtomicEffectDefinition` in contracts with missing effect kinds needed for Cohort 2 and beyond:

| New effect kind | Needed for |
|---|---|
| `PLACE_SURFACE` | `FIREBALL`, `FIREWALL`, `FIREWALK` |
| `DISPLACEMENT` | `SHIELD_BASH`, `GRAPPLE_HOOK`, `DASH` |
| `SPAWN_ACTOR` | `RAISE_DEAD`, `FALCON_COMMAND` |
| `PICKUP_ITEM` | `SPEAR_THROW` recall |
| `MODIFY_COOLDOWN` | `SPEAR_THROW` Deep Breath |
| `APPLY_AILMENT` | `SPEAR_THROW` bleed |
| `REMOVE_CORPSE` | `RAISE_DEAD` |

Build a generic targeting resolver that reads `targeting.mode` and `targeting.pattern` from the JSON sidecar.

### Phase 4: Companion mode authoring

Move falcon mode definitions to `packages/engine/src/data/companions/`:
- Declare each mode (roost, scout, predator) as a JSON object with overlay config, anchor rule, trigger condition, and UI text.
- `FALCON_COMMAND` execute becomes a thin dispatcher that reads the mode set and applies the declared effects.
- Add `modes` field to `CompanionBalanceEntry` (or a new `CompanionDefinition` type).

### Phase 5: Imperative handler escape hatch

For the ~35 skills that will remain partially imperative after Phases 1-4, formalize the `executionHandler` pattern:
- The JSON sidecar declares all metadata, upgrades, and targeting rules.
- A named handler function (string reference, e.g. `"executionHandler": "spear_throw"`) implements the imperative execution logic.
- The registry generator wires handler references to the appropriate TypeScript exports.
- Over time, handler code shrinks as the effect vocabulary grows.

### Phase 6: Capability provider schema

Design a declarative capability-provider schema for senses, information, and movement. This is the longest-term item for the remaining legacy compatibility layer, even though the live runtime already consumes declarative capability data for the migrated skills.

Likely shape: a JSON declaration of provider type, priority, conditions, and reveal/decision rules, with the runtime interpreting them instead of calling arbitrary `resolve()` functions.

---

## Acceptance

This document is valid when:
- All claimed counts match `packages/engine/src/generated/skill-registry.generated.ts` and the live `src/skills/` directory.
- Every named type, system, and file path exists in the repo.
- No claims about systems that do not yet exist are presented as current truth.
- Cohort assignments match actual implementation shape when spot-checked.
- Document stays shorter and more maintainable than an exhaustive per-skill table.
