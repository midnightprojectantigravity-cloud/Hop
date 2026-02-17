# Biome, Bestiary, and Trinity Contract

## Purpose
Capture one implementation-true contract for:
1. Biome visual runtime strategy.
2. Emergent bestiary hardship simulation across Body, Mind, and Instinct.
3. Formula-driven triangle of power.

This document is authoritative for architecture-level decisions touching these systems.

## Scope
- Web runtime: `apps/web/src/components/GameBoard.tsx`, `apps/web/src/components/Entity.tsx`, `apps/web/src/visual/*`.
- Engine runtime: `packages/engine/src/systems/surface-status.ts`, `packages/engine/src/systems/combat-calculator.ts`, `packages/engine/src/systems/trinity-resolver.ts`, `packages/engine/src/systems/emergent-bestiary.ts`.

## 1) Biome Runtime Strategy

### 1.1 Conceptual Render Stack (authoritative)
1. Layer 0, Undercurrent:
- Global raster hazard substrate.
- Independent UV scrolling.
- Does not own interaction logic.

2. Layer 1, Crust:
- Global floor texture sheet.
- Deterministic seed shift per run/floor/theme.
- Masked holes reveal Layer 0 at hazard/fire pockets.

3. Layer 2, Clutter and Obstacles:
- Sprites anchored to hex centers.
- Bleed allowed up to 200 percent scale.
- Deterministic Y-depth sort.

4. Layer 3, Interaction and UI:
- SVG grid, target highlights, objective markers.
- Unit readability overlays (team rings, rim light).

### 1.2 Data and Control
- Manifest source: `apps/web/public/assets/manifest.json`.
- Runtime schema and validation: `apps/web/src/visual/asset-manifest.ts`.
- Biome layer config keys:
  - `biomeLayers.undercurrent`
  - `biomeLayers.crust`
  - `biomeLayers.clutter`

### 1.3 Determinism Rules
- No non-deterministic placement for clutter or crust offsets.
- Seed shift is derived from stable run/floor/theme identity.
- Clutter presence, asset pick, scale, and depth offsets are hash-derived.
- Hazard punch-through masks are deterministic from tile flags + seed.

### 1.4 Readability Contract
- Team base rings:
  - Player: cyan.
  - Enemy: magenta.
- Units receive rim-light silhouette separation.
- Unit-to-floor readability target is minimum 4.5:1 contrast.
- Low-contrast floors must apply compensating silhouette/contrast treatment.

### 1.5 Fallback Protocol
- Units:
  - Preferred high-res unit asset.
  - Fallback low-poly SVG asset.
  - Final fallback runtime glyph/shape rendering.
- Tiles:
  - Preferred textured tile.
  - Fallback flat hex fill when image asset fails.

### 1.6 Surface Status Hook
- Engine query: `getSurfaceStatus(state, hexCoord)`.
- Current statuses:
  - `STABLE`
  - `MELTED`
  - `SOAKED`
  - `FROZEN`
  - `VOID_TOUCHED`
- Current example modifier:
  - Fire skill power multiplier = `1.15` on `MELTED`.

## 2) Emergent Bestiary Hardships (Body, Mind, Instinct)

### 2.1 Simulation Purpose
Evaluate ecosystem viability by biome under deterministic hardship:
- Survival under environmental pressure.
- Operational mobility under movement tax.
- Cross-biome stress transfer.
- Predation arc alignment with triangle combat rules.

### 2.2 Spawn and Lineage
- Biome universe: `red`, `blue`, `green`, `white`, `black`.
- Lineages:
  - `native`
  - `hybrid`
  - `inversion`
- Default target propensity:
  - native = `0.6`
  - hybrid = `0.3`
  - inversion = `0.1`

### 2.3 Trinity-to-Hardship Pipeline
For each unit:
1. Trinity is rolled from biome + lineage template ranges.
2. Max HP is derived from the shared trinity HP formula.
3. Hazard trial runs for configured rounds.
4. Movement budget is computed against biome movement tax.
5. Unit is classified as:
   - survived or casualty,
   - operational or not,
   - can traverse three hexes or not.

### 2.4 Core Hardship Equations
Hazard pressure:
- `pressure = biomePressure(trinity, biome)`

Mitigation:
- `mitigation = body * bodyMitigation + instinct * instinctMitigation + mind * mindMitigation + inversionShield`

Per-round damage:
- `damage = max(0, round((baseDamage + pressure + jitter) - mitigation))`
- Black-decay clause adds `decayClock` damage per round when active.

Movement budget:
- `mobility = 1 + instinct * 0.45 + body * 0.2 + mind * 0.1 - movementTax`
- Biome penalties apply when key stat is under threshold.
- `movementBudget = max(0, floor(mobility))`

Operational criterion:
- `operational = survived && movementBudget >= movementFloor`

### 2.5 Report Outputs
- Home-biome stress report:
  - survivalRate
  - operationalRate
  - traverseThreeHexesRate
  - avgRemainingHpRatio
  - avgMovementBudget
- Cross-biome stress reports for target biomes.
- Propensity actual vs target and deltas.
- Predation arc report.

## 3) Triangle of Power (Formula-Driven)

### 3.1 Trinity Lever Formulas
From `resolveTrinityLevers(trinity)`:
- `bodyDamageMultiplier = 1 + body / 20`
- `bodyMitigation = clamp(body * 0.01, 0, 0.5)`
- `mindStatusDurationBonus = floor(mind / 15)`
- `mindMagicMultiplier = 1 + mind / 20`
- `instinctInitiativeBonus = instinct * 2`
- `instinctCriticalMultiplier = 1 + clamp(instinct, 0, 10) * 0.02`
- `instinctSparkDiscountMultiplier = 1 - clamp(instinct, 0, 100) / 100`

### 3.2 Combat Resolution Formula
In `calculateCombat(intent)`:
- `primaryClassMultiplier = magical ? mindMagicMultiplier : bodyDamageMultiplier`
- `baseClassPower = basePower * primaryClassMultiplier`
- `scalingPower = sum(stat(attribute) * coefficient)`
- `statusMultiplier = product(statusMultipliers)`
- `riskMultiplier = 1 + dangerBonus + proximityBonus`
- `finalPower = floor((baseClassPower + scalingPower) * statusMultiplier * riskMultiplier * hitMultiplier * mitigationMultiplier * critExpectedMultiplier * attackPowerMultiplier * targetDamageTakenMultiplier)`

### 3.3 Triangle Interaction Terms
Enabled with `interactionModel = triangle`.

Hit pressure:
- Physical accuracy scales with Instinct and Body.
- Magical accuracy scales with Mind and Instinct.
- Defender evasion/resistance terms counter by class.

Mitigation pressure:
- Physical mitigation scales with Body and Instinct.
- Magical mitigation scales with Mind and Instinct.

Crit pressure:
- Physical crit chance scales from Instinct.
- Magical crit chance scales from Mind.
- Defender resilience scales from class-appropriate defensive stats.

Range pressure:
- Engagement range vs attacker/defender preferred bands modifies hit outcome.

### 3.4 Dominance Loop Expectation
The triangle is emergent from formulas, not hard-coded multipliers:
- Body pressure tends to beat Instinct-heavy targets in physical exchanges.
- Instinct pressure tends to beat Mind-heavy targets in engagement/hit regimes.
- Mind pressure tends to beat Body-heavy targets in magical exchanges.

Validation anchor:
- `packages/engine/src/__tests__/triangle_emergence.test.ts`

## 4) Non-Negotiables
1. Keep visual and combat behavior deterministic for identical seed and input logs.
2. Never fork alternate combat formulas outside calculator/resolver pipelines.
3. Keep biome readability rules as hard requirements, not art-only guidance.
4. Keep bestiary hardship simulation formula-driven and reproducible.
5. Keep this contract synchronized with runtime code when formulas or layer semantics change.

