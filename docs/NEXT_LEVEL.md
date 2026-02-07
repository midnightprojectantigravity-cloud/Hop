# Next Level: Arcade Tactical RPG Expansion (Updated)

## Vision (High-Level)
Turn Hop into a deep, replayable arcade tactical RPG. The engine stays deterministic and headless; the client amplifies intent and impact. This version prioritizes a lean architecture so the scope remains manageable and testable.

## Guiding Constraints
- Golden Standard: determinism and headless-first simulation are non-negotiable.
- Enemy parity: enemies use the same skill system as players.
- Simplified logic: consolidate mechanics into a unified effect system.

## Core Technical Architecture
### 1) Trinity of Stats (Attributes)
Use Body, Mind, and Instinct as raw scalers. Avoid secondary stats on base entities; model those via effects.
Code fit: `packages/engine/src/types.ts`, `packages/engine/src/systems/combat.ts`, `packages/engine/src/systems/status.ts`.

### 2) Unified Effect System
Use a single `Effect` structure where Traits are permanent, Statuses are temporary, and Counters are stackable.
Implementation pattern:
- Trait: effect with `duration: -1`.
- Status: effect with `duration: >0`.
- Counter: effect with `stacks: number`.
Code fit: `packages/engine/src/types.ts`, `packages/engine/src/systems/status.ts`, `packages/engine/src/systems/effect-engine.ts`.

### 3) Archetypes as Skill Tags (Soft Gate)
Archetypes are defined by skill tags and playstyle loops, not hard classes.
- First pick grants a small core set of signature skills.
- Off-archetype skills remain available but limited by slots, cost, or rarity.
- UI surfaces when a build drifts into a new archetype identity.
Examples: Vanguard (Body + Shield counters), Skirmisher (Momentum), Fire Mage (Tile hazards), Necromancer (Summons).
Code fit: `packages/engine/src/skills/`, `packages/engine/src/systems/loadout.ts`, `packages/engine/src/types.ts`, `apps/web/src/components/UpgradeOverlay.tsx`.

### 4) Logic-Light Entities (Parity)
Players and enemies are containers for Attributes and Effects. Behavior is driven by skills and effects, not entity type.
Code fit: `packages/engine/src/systems/entity-factory.ts`, `packages/engine/src/systems/ai.ts`, `packages/engine/src/types.ts`.

### 5) Testing Advantage
Use headless simulation to stress test combinations and counter thresholds (e.g., 3-stack Freeze).
Code fit: `packages/engine/src/__tests__`, `packages/engine/scripts/validateReplay.ts`.

## Pillars to Improve Playability
### 1) Enemy Parity and Skill Reuse
Enemies should use the same skills as players to create fair, learnable threats.
Examples: Shield Bearer uses `SHIELD_BASH`, Bomber uses `BOMB_TOSS`, Archer uses `SPEAR_THROW`.
Code fit: `packages/engine/src/systems/ai.ts`, `packages/engine/src/strategy/wild.ts`, `packages/engine/src/skillRegistry.ts`.

### 2) Bosses with Multi-Turn Patterns
Prefer defining boss patterns as multi-turn skill sequences (telegraph + execution) so intent is dictated by skill patterns. AI selects the pattern/skill, then the skill drives telegraph and execution. Validate with a multi-turn scenario.
Code fit: `packages/engine/src/systems/ai.ts`, `packages/engine/src/systems/combat.ts`, `packages/engine/src/scenarios/`.

### 3) Tactical Terrain and Traps
Add terrain that rewards positioning and risk.
Examples: Ice slide, snare trap, shrines with temporary buffs.
Code fit: `packages/engine/src/systems/tile-effects.ts`, `packages/engine/src/systems/tile-registry.ts`, `packages/engine/src/systems/unified-tile-service.ts`.

### 4) Loot, Treasures, and Loadout Evolution
Run-defining choices that alter tactical identity.
Examples: Relics that add range or ignite, one-off items like teleport scrolls, skill shards as upgrades.
Code fit: `packages/engine/src/systems/serialization.ts`, `packages/engine/src/systems/loadout.ts`, `apps/web/src/components/UpgradeOverlay.tsx`.

### 5) Quests and Run Objectives
Light objectives add decision variety and replay value.
Examples: "Defeat 3 elites without taking lava damage", "Clear floor in under 10 turns".
Code fit: `packages/engine/src/types.ts`, `packages/engine/src/logic.ts`, `apps/web/src/components/UI.tsx`.

### 6) Action Economy and Momentum Systems
Reward smart sequencing with chained effects and initiative play.
Examples: kill resets dash cooldown, momentum carryover into shove, stun breaks telegraphs.
Code fit: `packages/engine/src/systems/status.ts`, `packages/engine/src/systems/tactical-engine.ts`, `packages/engine/src/skills/`.

### 7) Replay and Meta Challenges
Make the arcade loop competitive and shareable.
Examples: daily seeds with leaderboards, challenge modifiers, replay gallery.
Code fit: `apps/web/src/components/ReplayManager.tsx`, `apps/server/index.js`, `packages/engine/scripts/validateReplay.ts`.

## Expanded Systems from Brainstorm
### A) Five-Color Hex Topology (Domain-Driven Map Gen)
Each "color" controls tile traits, hazards, and tactical patterns.
Examples: White (snare, hallowed heals), Blue (ice, fog LoS breaks), Black (poison, corpse economy), Red (lava, crumble), Green (vines, overgrowth).
Code fit: `packages/engine/src/systems/map.ts`, `packages/engine/src/systems/tile-registry.ts`, `packages/engine/src/scenarios/hazards.ts`.

MTG keyword integration:
- Define each keyword in Hop terms, then map it to colors and concrete mechanics.
- Implement keywords as reusable effects, then map colors and skills to them.
Code fit: `packages/engine/src/systems/status.ts`, `packages/engine/src/types.ts`, `packages/engine/src/skills/`, `packages/engine/src/scenarios/`.

Keyword definition exercise (Hop-appropriate semantics):
- Flying: ignores ground hazards and ground-only blockers for pass/land; still blocked by walls or anti-air traits.
- Trample: excess damage carries to the next target in the same line, or spills into a trailing AoE.
- Haste: act immediately on spawn or reduce cooldown/initiative cost this turn.
- First Strike: resolves damage before the target in the same combat exchange.
- Vigilance: can act and still retain a defensive reaction or overwatch posture.
- Lifelink: converts a portion of damage dealt to healing or shield.
- Regenerate: prevents lethal damage once per turn and applies a debuff.
- Hexproof: immune to targeted skills but not AoE or ground effects.
- Menace: requires two adjacent blockers to stop movement or targeting.

Color mapping (draft, adjust per balance):
- White: Vigilance, First Strike, Lifelink, protection auras.
- Blue: Flying, Hexproof, control and LoS manipulation.
- Black: Lifelink, Regenerate, Menace, sacrifice/corpse economy.
- Red: Haste, Trample, burst damage, self-risk.
- Green: Regenerate, Trample, high HP, terrain mastery.

### B) Trinity of Stats (Body, Mind, Instinct)
Three universal scalers reduce RPG bloat and map cleanly to skills.
Examples: Body affects displacement resistance, Mind affects range and elemental damage, Instinct affects initiative and reactions.
Code fit: `packages/engine/src/types.ts`, `packages/engine/src/systems/combat.ts`, `packages/engine/src/systems/status.ts`.

### C) Tension Gauge and Organic Growth
Growth based on high-pressure moments rather than XP.
Examples: surviving at low HP increases Tension; when full, grant a stat point in the most used category.
Code fit: `packages/engine/src/logic.ts`, `packages/engine/src/systems/status.ts`, `packages/engine/src/systems/telemetry.ts`.

### D) Legacy and Guilds (Meta Progression)
Determinism makes legacy and sharing powerful.
Examples: past run "Ghost Strategy" appears as ally or mentor, player-written quests via seed sharing.
Code fit: `packages/engine/src/strategy/ghost.ts`, `packages/engine/src/systems/serialization.ts`, `apps/server/index.js`.

## Mode Split: Arcade and Persistent World
### Arcade Mode: The Crucible
Deterministic proving ground with precise positioning and replay validation.
Examples: leaderboards via replay IDs, perfect-execution rewards, procedural combat puzzle rooms.
Code fit: `packages/engine/scripts/validateReplay.ts`, `apps/server/index.js`, `apps/web/src/components/ReplayManager.tsx`.

### Persistent World: The MMO Layer
Shared world that builds on the same rules but uses persistent storage.
Examples: crafting and trading, territory influence, shared relic economy.
Code fit: `apps/server/index.js`, database layer, scheduled validation tasks.

## Unified Power Assessment (UPA)
A single power formula to balance encounters across Arcade and MMO.
Arcade: score multiplier from power vs success. MMO: tiering for access and economy.
Code fit: `packages/engine/src/systems/combat.ts`, `packages/engine/src/types.ts`, `packages/engine/src/logic.ts`.

## Mini Framework for Adding Content
### New Skill
Implement in `packages/engine/src/skills/`, register in `packages/engine/src/skillRegistry.ts`, add scenarios in `packages/engine/src/scenarios/`, validate determinism with replay tests.

### New Enemy
Define stats in `packages/engine/src/constants.ts`, add loadout in `packages/engine/src/systems/entity-factory.ts`, extend AI in `packages/engine/src/systems/ai.ts`, add scenario coverage.

### New Tile Effect
Define trait in `packages/engine/src/systems/tile-types.ts`, add effect in `packages/engine/src/systems/tile-registry.ts`, hook behavior in `packages/engine/src/systems/tile-effects.ts`, add scenarios for pass and land behavior.

### New Boss Pattern
Prefer defining boss patterns as multi-turn skill sequences (telegraph + execution) so intent is dictated by skill patterns. AI selects the pattern/skill, then the skill drives telegraph and execution. Validate with a multi-turn scenario.

## Concrete Next Steps (The Lean Path)
1. Refactor the effect system into a single structure with traits, statuses, and counters.
2. Add counter thresholds (e.g., 3 stacks of Chill triggers Frozen for 1 turn).
3. Implement a boss as a skill playlist with telegraph and execute turns.
4. Build the 5-minute daily seed loop before expanding meta progression.

## Stretch Ideas
1. Procedural room modifiers (low gravity, fog of war).
2. Synergy systems (burn + oil, ice + shove).
3. Companion archetypes with shared skills and upgrades.
4. Narrative arc in arcade mode with light story beats.

## Decision Hooks for the Next Phase
- Define the UPA formula first to balance both modes.
- Choose a first "color domain" set for map gen to anchor tile variety.
- Pick one boss pattern to establish the multi-turn intent pipeline.

## Difficulty and Simplification Strategy
Goal: keep the Golden Standard intact while reducing scope, coupling, and implementation risk. Difficulty is estimated for the current codebase.

### Core Technical Architecture
- Trinity of Stats: Low. Keep only scaling hooks in combat math, no new subsystems.
- Unified Effect System: Medium-High. Mitigate by doing it in two passes:
  - Pass 1: alias existing traits/statuses/counters into one interface with adapters.
  - Pass 2: migrate callers and remove legacy shapes.
- Archetypes as Skill Tags: Medium. Keep it UI-light and mostly data-driven (tags on skills + soft gate config).
- Logic-Light Entities: Medium. Keep entity shape stable; shift behavior via skill/effect helpers only.
- Testing Advantage: Low. Expand existing scenarios incrementally; avoid new infra.

### Pillars to Improve Playability
- Enemy Parity and Skill Reuse: Medium. Start with 1 enemy using existing player skills end-to-end.
- Bosses with Multi-Turn Patterns: Medium. Implement one boss pattern using two existing skills and a telegraph effect.
- Tactical Terrain and Traps: Medium. Add 1 terrain effect with pass and land rules; reuse hazard checks.
- Loot, Treasures, Loadout Evolution: Medium-High. Start with 3 relics as passive effects only.
- Quests and Run Objectives: Medium. Start with 2 objectives and evaluate via existing event hooks.
- Action Economy and Momentum: Medium. Add 1 chain rule and validate in scenarios.
- Replay and Meta Challenges: High if server-side. Start with local daily seed only; leaderboard later.

### Expanded Systems from Brainstorm
- Five-Color Hex Topology: Medium-High. Start with a single domain (Red) and 1-2 traits.
- MTG Keywords: High if broad. Start with 3 keywords (Flying, Trample, Lifelink) and map to effects.
- Tension Gauge: Medium-High. Start as a single counter with one trigger and one reward.
- Legacy and Guilds: High. Defer until replay validation is stable.

### Mode Split: Arcade and MMO
- Arcade Mode: Medium. Keep it single-player deterministic first.
- MMO Layer: Very High. Defer; keep an interface boundary only.

### UPA (Unified Power Assessment)
- Medium-High. Start with a simple formula used only in tests and tuning, not gameplay.

## Simplification Playbook
- Prefer fewer mechanics with deeper interactions over many shallow systems.
- Use the Unified Effect System as the single axis of complexity, not multiple parallel subsystems.
- Ship one representative example per pillar before expanding.
- Keep everything data-driven (skill tags, effect tags, tile traits).
- Avoid new UI until engine behavior is stable and test-covered.

## Minimal Viable "Next Level" Slice
- Unified Effect System pass 1 (adapters only).
- 1 new terrain trait + 1 new keyword + 1 relic.
- 1 enemy using a player skill end-to-end.
- 1 boss pattern built as a two-turn skill playlist.
- 2 scenarios that validate the above.
