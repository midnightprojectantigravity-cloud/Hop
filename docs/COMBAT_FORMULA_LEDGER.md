# Combat Formula Ledger

## 1. Purpose
This document is the target-state combat and IRES formula contract for Hop.

It exists above the TypeScript implementation. Its job is to lock design intent before implementation and tests are allowed to drift.

Rules for using this ledger:
1. Implementation may temporarily diverge.
2. Tests are downstream verifiers, not the place where formulas are invented.
3. Future combat or IRES tuning should update this ledger first or alongside code.
4. This document is target-state only, not a current-state audit.

## 2. Scope
Included:
1. Trinity stat meaning
2. Combat formulas
3. Tactical pacing formulas
4. IRES / BFI / metabolic formulas
5. Matchup interpretation metrics

Excluded:
1. Per-skill individual balance numbers
2. Enemy-specific tuning tables
3. Gear and relic modifiers
4. Ailment chemistry except where it changes the core combat formula stack

## 3. Formula Hierarchy
Dependency order:
1. Layer 0: notation and units
2. Layer 1: core stat scale anchors
3. Layer 2: derived pools and direct stat outputs
4. Layer 3: hit and damage resolution
5. Layer 4: pacing and throughput metrics
6. Layer 5: IRES / metabolic formulas
7. Layer 6: matchup triangle interpretation
8. Layer 7: test contract mapping

Flow:
`Stats -> Derived Pools -> Resolution Math -> Throughput -> Metabolic Capacity -> Matchup Outcome`

## Layer 0: Notation and Units
Core notation:
1. `B`: Body
2. `I`: Instinct
3. `M`: Mind
4. `HP`: hit points
5. `Atk_phys`: physical attack input
6. `Atk_mag`: magical attack input
7. `Def_phys`: physical defense input
8. `Def_mag`: magical defense input
9. `IR`: instinct ratio
10. `HQ`: hit quality
11. `CE`: critical expectation
12. `BFI`: baseline friction index
13. `APT`: average actions per turn
14. `DPT`: average damage per turn
15. `TTK`: turns to kill

Time / scope units:
1. Per-hit: one landed hit or resolved miss
2. Per-action: one committed attack or skill action
3. Per-turn: one actor turn in initiative order
4. Per-fight: multi-turn aggregate outcome
5. Per-beat: one metabolic accounting window in IRES

### Formula Symbol Glossary
These symbols and placeholders are used throughout the ledger. Every later formula should be read through this glossary.

Core input symbols:
1. `BasePower_phys`: the fixed base value authored directly on a physical skill, attack, or effect before stat scaling is applied
2. `BasePower_mag`: the fixed base value authored directly on a magical skill, attack, or effect before stat scaling is applied
3. `PhysicalScaling`: the total stat-derived additive contribution to a physical attack input
4. `MagicalScaling`: the total stat-derived additive contribution to a magical attack input
5. `B_att`, `I_att`, `M_att`: attacker Body, Instinct, and Mind
6. `B_def`, `I_def`, `M_def`: defender Body, Instinct, and Mind

Derived combat symbols:
1. `Atk_phys`: physical attack input after base power and physical scaling are combined
2. `Atk_mag`: magical attack input after base power and magical scaling are combined
3. `Def_phys`: physical defense denominator input, normally Body-derived
4. `Def_mag`: magical defense denominator input, normally Mind-derived
5. `Damage_phys_base`: raw physical damage before hit-quality and crit layers
6. `Damage_mag_base`: raw magical damage before hit-quality and crit layers
7. `Resilience_body`: Body-derived burst resistance term that reduces crit severity
8. `CritSeverity`: multiplicative crit severity after Body resilience is applied

Hit-quality symbols:
1. `IR`: instinct ratio or ratio-like tracking contest input
2. `HQ`: hit quality, the resolved quality band input for hit resolution
3. `HQ_melee`: close-range hit-quality contest
4. `HQ_projectile`: ranged projectile hit-quality contest
5. `HQ_spell`: targeted spell hit-quality contest
6. `adjacency_lock`: the close-range certainty bonus applied at range 1 to suppress excessive melee evasion
7. `distance`: hex distance between attacker and defender for tracking and telegraph formulas
8. `defender_dodge_from_distance`: the extra dodge opportunity granted to defenders as targeted spell travel time increases
9. `HQ_floor`: the minimum positive denominator floor used to avoid division by zero in hit-quality ratios
10. `MeleePressure_att`: the attacker-side close-combat hit-pressure term
11. `MeleePressure_def`: the defender-side close-combat evasion term
12. `ProjectilePressure_att`: the attacker-side ranged projectile hit-pressure term
13. `ProjectilePressure_def`: the defender-side ranged projectile evasion term
14. `SpellPressure_att`: the attacker-side spell tracking term
15. `SpellPressure_def`: the defender-side spell dodge and telegraph-response term

Critical symbols:
1. `CE`: critical expectation, an analytic or telemetry concept representing expected burst pressure
2. `base_crit`: the baseline crit severity before defensive resilience is applied
3. `crit_tier_extension`: any additional multiplier or tier gain from multi-critical access

Metabolic / IRES symbols:
1. `BFI_base`: stat-derived baseline friction before weight burden is applied
2. `BFI_effective`: post-weight friction value used to index metabolic tax
3. `Weight`: the numeric burden term derived from weight class, armor class, or body-class burden
4. `WeightAdjustment`: the additive weight-derived friction delta applied on top of `BFI_base`
5. `Spark`: the physical throughput reserve used for movement and physical tempo
6. `SparkRecovery`: Spark recovered per beat or turn-equivalent metabolic step
7. `Mana`: the magical throughput reserve used for spellcasting and control tempo
8. `ManaRecovery`: Mana recovered per beat or turn-equivalent metabolic step
9. `SparkRatio`: current Spark divided by max Spark
10. `ManaRatio`: current Mana divided by max Mana
11. `ExhaustionRatio`: current exhaustion divided by the exhaustion cap
12. `ReservePressure`: normalized low-resource pressure derived from Spark and Mana ratios
13. `FatiguePressure`: normalized exhaustion pressure derived from exhaustion state
14. `RecoveryPressure`: normalized pacing pressure used to decide whether another action is worth taking this turn

Coefficient and placeholder symbols:
1. `K_hp_body`, `K_hp_instinct`, `K_hp_mind`: HP contribution coefficients for Body, Instinct, and Mind
2. `K_phys_atk_body`, `K_phys_atk_instinct`, `K_phys_atk_mind`: physical attack contribution coefficients for Body, Instinct, and Mind
3. `K_mag_atk_body`, `K_mag_atk_instinct`, `K_mag_atk_mind`: magical attack contribution coefficients for Body, Instinct, and Mind
4. `K_phys_def_body`, `K_phys_def_instinct`, `K_phys_def_mind`: physical defense contribution coefficients for Body, Instinct, and Mind
5. `K_mag_def_body`, `K_mag_def_instinct`, `K_mag_def_mind`: magical defense contribution coefficients for Body, Instinct, and Mind
6. `K_bfi_ceiling`: baseline friction ceiling before logarithmic relief
7. `K_bfi_scale`: logarithmic gain multiplier in the BFI formula
8. `K_bfi_dampener`: early-investment sensitivity constant in the BFI formula
9. `K_bfi_body_weight`, `K_bfi_instinct_weight`, `K_bfi_mind_weight`: weighted stat coefficients for Body, Instinct, and Mind in the BFI formula
10. `WeightAdjustment`: additive burden delta applied after the logarithmic base BFI is resolved
11. `K_hq_melee_att_instinct`, `K_hq_melee_def_instinct`, `K_hq_melee_adjacency`: melee hit-quality coefficients
12. `K_hq_projectile_att_instinct`, `K_hq_projectile_def_instinct`, `K_hq_projectile_range`: projectile hit-quality coefficients
13. `K_hq_spell_att_mind`, `K_hq_spell_def_instinct`, `K_hq_spell_distance_dodge`: spell hit-quality coefficients
14. `f(...)`: an intentionally unspecified target-state function whose exact closed-form equation is not yet locked, but whose inputs and design role are locked

Interpretation rules:
1. If a formula uses `f(...)`, the ledger is locking the dependency and design intent, but not yet the final exact equation.
2. If a formula uses a named term like `PhysicalScaling`, the term must be interpreted as the sum of all relevant stat-driven scaling contributions for that layer.
3. If a formula uses `Weight` or `WeightAdjustment`, the ledger is referring to a numeric burden term, not a string weight-class label.

## Layer 1: Core Stat Scale Anchors
### Trinity Roles
1. Body: bulk, physical dominance, resilience, impact authority
2. Instinct: timing, tracking, evasion, initiative, precision
3. Mind: magic, status, intentionality, control, casting economy

### Anchor Bands
| Band | Meaning | Fictional Interpretation | Mechanical Interpretation |
| --- | --- | --- | --- |
| `0-9` | Impaired / below standard | weak, slow, unfocused, underdeveloped | poor derived pools and weak matchup agency |
| `10` | Standard human baseline | healthy and competent adult baseline | reference point for all first-pass formulas |
| `20-39` | Trained / elite | professional fighter, veteran, adept | clearly advantaged but not absurd |
| `40-69` | Heroic / exceptional | major specialist or named threat | dominant specialization with visible tradeoffs |
| `70-99` | Apex / mythic | near-legendary specialist | stress zone for matchup tuning |
| `100` | Specialization stress-test anchor | theoretical extreme specialist | used to test formula breakage and cap behavior |

### Standard Human
`10/10/10` is the standard human baseline.

Interpretation:
1. mechanically readable
2. easy for designers to reason about
3. used as the baseline anchor for examples and pacing

### Apex Reference Anchors
The following are reference anchors, not default content assumptions:
1. `100/10/10`: Body apex
2. `10/100/10`: Instinct apex
3. `10/10/100`: Mind apex

Values above `100` are out of first-pass contract scope unless explicitly approved later.

### What 10 Body Means
1. ordinary human durability
2. average physical resilience
3. enough mass and conditioning to contest light hits

### What 100 Body Means
1. extreme bulk specialization
2. overwhelming HP and physical staying power
3. major resistance to crit severity and displacement

### What 10 Instinct Means
1. ordinary human reaction and timing
2. average ability to aim, dodge, and read tempo
3. baseline initiative and metabolic efficiency

### What 100 Instinct Means
1. extreme precision and evasive specialization
2. exceptional initiative and ranged tracking
3. major anti-spell and anti-telegraph pressure

### What 10 Mind Means
1. ordinary human focus and intent
2. baseline magical and status capacity
3. average casting discipline

### What 100 Mind Means
1. extreme magical and status specialization
2. overwhelming spell pressure and rule-breaking utility
3. highly optimized control and mana posture, but not tanky by default

## Layer 2: Derived Pools and Direct Stat Outputs
Each target formula below should be interpreted as target-state, not implementation truth.

### HP
Purpose: raw survivability pool

Target formula:
`HP = (K_hp_body * B) + (K_hp_instinct * I) + (K_hp_mind * M)`

Intuition:
1. Body is the main bulk stat
2. Instinct adds meaningful survivability through mobility/endurance
3. Mind contributes minimal survivability by default

Definitions:
1. `K_hp_body`: Body-to-HP coefficient
2. `K_hp_instinct`: Instinct-to-HP coefficient
3. `K_hp_mind`: Mind-to-HP coefficient

Target coefficient values:
1. `K_hp_body = 6`
2. `K_hp_instinct = 3`
3. `K_hp_mind = 1`

Example:
`10/10/10 -> 100 HP`

### Physical Attack Input
Purpose: physical offense input before mitigation

Target formula:
`Atk_phys = BasePower_phys + (K_phys_atk_body * B_att) + (K_phys_atk_instinct * I_att) + (K_phys_atk_mind * M_att)`

Intuition:
1. melee basics are Body-primary
2. projectile physical skills are Instinct-primary, with optional Body contribution
3. heavy impact skills are Body-primary

Definitions:
1. `BasePower_phys`: the authored fixed base value of the physical action before stat scaling
2. `PhysicalScaling`: the total additive stat-driven contribution to physical attack input
3. `PhysicalScaling = (K_phys_atk_body * B_att) + (K_phys_atk_instinct * I_att) + (K_phys_atk_mind * M_att)`
4. `K_phys_atk_body`: Body-to-physical-attack coefficient
5. `K_phys_atk_instinct`: Instinct-to-physical-attack coefficient
6. `K_phys_atk_mind`: Mind-to-physical-attack coefficient, normally `0` for physical actions

Coefficient policy:
1. `K_phys_atk_body`, `K_phys_atk_instinct`, and `K_phys_atk_mind` are per-skill or per-attack-family coefficients
2. they are intentionally not assigned one global target value in this ledger
3. the ledger locks the formula shape first, then content tuning assigns the coefficient set per attack family

Barehanded baseline target values:
1. `K_phys_atk_body = 1.0`
2. `K_phys_atk_instinct = 0`
3. `K_phys_atk_mind = 0`

Example:
`Atk_phys = BasePower_phys + (K_phys_atk_body * B_att) + (K_phys_atk_instinct * I_att) + (K_phys_atk_mind * M_att)`

### Magical Attack Input
Purpose: magical offense input before mitigation

Target formula:
`Atk_mag = BasePower_mag + (K_mag_atk_body * B_att) + (K_mag_atk_instinct * I_att) + (K_mag_atk_mind * M_att)`

Intuition:
1. targeted spells are Mind-primary
2. AoE spells are Mind-primary
3. status payloads are Mind-primary

Definitions:
1. `BasePower_mag`: the authored fixed base value of the magical action before stat scaling
2. `MagicalScaling`: the total additive stat-driven contribution to magical attack input
3. `MagicalScaling = (K_mag_atk_body * B_att) + (K_mag_atk_instinct * I_att) + (K_mag_atk_mind * M_att)`
4. `K_mag_atk_body`: Body-to-magical-attack coefficient, normally `0`
5. `K_mag_atk_instinct`: Instinct-to-magical-attack coefficient, normally `0`
6. `K_mag_atk_mind`: Mind-to-magical-attack coefficient

Coefficient policy:
1. `K_mag_atk_body`, `K_mag_atk_instinct`, and `K_mag_atk_mind` are per-skill or per-spell-family coefficients
2. they are intentionally not assigned one global target value in this ledger
3. the ledger locks the formula shape first, then content tuning assigns the coefficient set per spell family

Example:
`Atk_mag = BasePower_mag + (K_mag_atk_body * B_att) + (K_mag_atk_instinct * I_att) + (K_mag_atk_mind * M_att)`

### Physical Defense Input
Purpose: raw physical defense denominator input

Target formula:
`Def_phys = (K_phys_def_body * B_def) + (K_phys_def_instinct * I_def) + (K_phys_def_mind * M_def)`

Intuition:
1. Body is the physical mitigation anchor
2. Instinct affects hit cleanliness, not the physical denominator itself

Definitions:
1. `K_phys_def_body`: Body-to-physical-defense coefficient
2. `K_phys_def_instinct`: Instinct-to-physical-defense coefficient, normally `0`
3. `K_phys_def_mind`: Mind-to-physical-defense coefficient, normally `0`
4. `B_def`: defender Body used for physical mitigation
5. `I_def`: defender Instinct used for physical mitigation only if the contract later assigns a non-zero coefficient
6. `M_def`: defender Mind used for physical mitigation only if the contract later assigns a non-zero coefficient

Target coefficient value:
1. `K_phys_def_body = 0.2` for the barehanded baseline defense contract
2. `K_phys_def_instinct = 0` by default unless a later ruleset revision changes the defense model
3. `K_phys_def_mind = 0` by default unless a later ruleset revision changes the defense model

### Magical Defense Input
Purpose: raw magical defense denominator input

Target formula:
`Def_mag = (K_mag_def_body * B_def) + (K_mag_def_instinct * I_def) + (K_mag_def_mind * M_def)`

Intuition:
1. Mind is the magical resistance anchor
2. Body does not directly mitigate magical attack by default

Definitions:
1. `K_mag_def_body`: Body-to-magical-defense coefficient, normally `0`
2. `K_mag_def_instinct`: Instinct-to-magical-defense coefficient, normally `0`
3. `K_mag_def_mind`: Mind-to-magical-defense coefficient
4. `B_def`: defender Body used for magical mitigation only if the contract later assigns a non-zero coefficient
5. `I_def`: defender Instinct used for magical mitigation only if the contract later assigns a non-zero coefficient
6. `M_def`: defender Mind used for magical mitigation

Target coefficient value:
1. `K_mag_def_body = 0` by default unless a later ruleset revision changes the defense model
2. `K_mag_def_instinct = 0` by default unless a later ruleset revision changes the defense model
3. `K_mag_def_mind` remains provisional and must be chosen explicitly during magical defense normalization

### Body Resilience
Purpose: reduce crit severity and reinforce tank identity

Target form:
`Resilience_body = f(B)`

Intuition:
1. high Body should blunt burst lethality
2. Body should not merely add HP, it should also reduce spike quality

Definition:
1. `Resilience_body`: the defensive term derived from Body that reduces critical severity or burst conversion without necessarily changing base damage

### Initiative
Purpose: determine opening tempo

Target form:
`Initiative = f(I, M)`

Intuition:
1. Instinct is primary
2. Mind is secondary
3. Mind contributes foresight, not brute reaction

Definitions:
1. `I`: reaction speed and timing contribution
2. `M`: foresight and tactical anticipation contribution

### Spark Reserve
Purpose: sustain movement and physical tempo

Target form:
`Spark = f(B)`

Intuition:
1. Body is the primary reserve source
2. Spark represents physical system throughput

Definition:
1. `Spark`: the reserve consumed by movement and Spark-bearing physical or hybrid actions

### Mana Reserve
Purpose: sustain spell and control tempo

Target form:
`Mana = f(M)`

Intuition:
1. Mind is the primary reserve source
2. Mana represents magical and cognitive throughput

Definition:
1. `Mana`: the reserve consumed by spell and Mind-bearing control actions

### Base BFI
Purpose: stat-driven baseline metabolic friction

Target formula:
`WeightedSum = (K_bfi_body_weight * B) + (K_bfi_instinct_weight * I) + (K_bfi_mind_weight * M)`

`BFI_base = round(K_bfi_ceiling - (K_bfi_scale * ln(1 + (WeightedSum / K_bfi_dampener))))`

Intuition:
1. lower BFI means lower action friction
2. Instinct is the strongest mobility friction reducer
3. Body and Mind still matter
4. diminishing returns should compress extreme stat stacks

Definitions:
1. `K_bfi_ceiling`: baseline friction ceiling before logarithmic relief
2. `K_bfi_scale`: the logarithmic gain multiplier
3. `K_bfi_dampener`: the early-investment sensitivity constant
4. `K_bfi_body_weight`: Body's contribution to `WeightedSum`
5. `K_bfi_instinct_weight`: Instinct's contribution to `WeightedSum`
6. `K_bfi_mind_weight`: Mind's contribution to `WeightedSum`

Target coefficient values:
1. `K_bfi_ceiling = 14`
2. `K_bfi_scale = 1.87`
3. `K_bfi_dampener = 7`
4. `K_bfi_body_weight = 3`
5. `K_bfi_instinct_weight = 6`
6. `K_bfi_mind_weight = 1`

### Effective BFI
Purpose: apply burden to base friction

Target formula:
`BFI_effective = clamp(BFI_base + WeightAdjustment, 6, 12)`

Intuition:
1. gear burden raises movement friction
2. burden should never erase stat identity, only modulate it

Definitions:
1. `WeightAdjustment`: a numeric burden term derived from equipment burden
2. `WeightAdjustment` maps by tier as `None = 0`, `Light = 1`, `Medium = 2`, `Heavy = 3`

## Layer 3: Combat Resolution Formulas
### 3.1 HP
Target formula:
`HP = (K_hp_body * B) + (K_hp_instinct * I) + (K_hp_mind * M)`

Required reference examples:
1. `10/10/10 -> 100 HP`
2. `100/10/10 -> 640 HP`
3. `10/100/10 -> 370 HP`
4. `10/10/100 -> 190 HP`

Interpretation:
1. Body specialization dominates bulk
2. Instinct specialization still carries meaningful survivability
3. Mind specialization is fragile by design

### 3.2 Physical Attack
Target formula:
`Atk_phys = BasePower_phys + (K_phys_atk_body * B_att) + (K_phys_atk_instinct * I_att) + (K_phys_atk_mind * M_att)`

Default target scaling intent:
1. melee basics: Body-primary
2. projectile physical: Instinct-primary, optional Body contribution
3. heavy impact skills: Body-primary

### 3.3 Magical Attack
Target formula:
`Atk_mag = BasePower_mag + (K_mag_atk_body * B_att) + (K_mag_atk_instinct * I_att) + (K_mag_atk_mind * M_att)`

Default target scaling intent:
1. targeted spells: Mind-primary
2. AoE spells: Mind-primary
3. status payloads: Mind-primary

### 3.4 Physical Defense
Target formula:
`Def_phys = (K_phys_def_body * B_def) + (K_phys_def_instinct * I_def) + (K_phys_def_mind * M_def)`

Contract:
1. Body is the primary physical mitigation anchor
2. Instinct may alter hit quality but not the physical defense denominator

### 3.5 Magical Defense
Target formula:
`Def_mag = (K_mag_def_body * B_def) + (K_mag_def_instinct * I_def) + (K_mag_def_mind * M_def)`

Contract:
1. Mind is the primary magical resistance anchor
2. Body does not directly mitigate magical attack by default

### 3.6 Base Physical Damage
Target formula:
`Damage_phys_base = Atk_phys^2 / (Atk_phys + Def_phys)`

Contract:
1. physical pacing is controlled by how source stats project into `Atk_phys` and `Def_phys`
2. higher `Def_phys` relative to `Atk_phys` means longer physical TTK
3. physical pacing should support tanky slog outcomes

Definitions:
1. `Damage_phys_base`: physical damage before HQ, crit, and final flooring
2. `Atk_phys`: physical attack input from base power plus physical scaling
3. `Def_phys`: physical defense denominator input derived from the physical defense coefficients applied to defender stats

### 3.7 Base Magical Damage
Target formula:
`Damage_mag_base = Atk_mag^2 / (Atk_mag + Def_mag)`

Contract:
1. magical pacing is controlled by how source stats project into `Atk_mag` and `Def_mag`
2. higher `Def_mag` relative to `Atk_mag` means stronger magical resistance
3. lower `Def_mag` relative to `Atk_mag` means burstier mage pressure

Definitions:
1. `Damage_mag_base`: magical damage before HQ, crit, and final flooring
2. `Atk_mag`: magical attack input from base power plus magical scaling
3. `Def_mag`: magical defense denominator input derived from the magical defense coefficients applied to defender stats

### 3.8 Melee Hit Quality
Locked target rule:
`Instinct-led with adjacency lock`

Target expression style:
`MeleePressure_att = (K_hq_melee_att_instinct * I_att) + K_hq_melee_adjacency`

`MeleePressure_def = max(HQ_floor, K_hq_melee_def_instinct * I_def)`

`HQ_melee = MeleePressure_att / MeleePressure_def`

Contract:
1. melee HQ is driven by attacker Instinct versus defender Instinct
2. range 1 strongly suppresses evasion failure
3. melee should rarely miss or glance unless attacker Instinct is dramatically lower or a special effect degrades close combat accuracy
4. adjacency must materially raise melee hit certainty
5. melee cannot behave like a long-range dodge contest

Definitions:
1. `HQ_melee`: close-range hit-quality outcome before tier mapping
2. `MeleePressure_att`: attacker-side close-combat hit-pressure
3. `MeleePressure_def`: defender-side close-combat evasion term
4. `K_hq_melee_att_instinct`: attacker Instinct coefficient in melee HQ
5. `K_hq_melee_def_instinct`: defender Instinct coefficient in melee HQ
6. `K_hq_melee_adjacency`: range-1 certainty bonus that suppresses glancing and miss outcomes in melee
7. `HQ_floor`: minimum positive denominator floor used to keep HQ well-defined

Coefficient policy:
1. melee HQ must remain Instinct-led
2. `K_hq_melee_adjacency` must be large enough to materially reduce close-range whiff behavior
3. target values remain provisional until melee certainty is discussed explicitly

### 3.9 Projectile Hit Quality
Target expression style:
`ProjectilePressure_att = (K_hq_projectile_att_instinct * I_att) + (K_hq_projectile_range * distance)`

`ProjectilePressure_def = max(HQ_floor, K_hq_projectile_def_instinct * I_def)`

`HQ_projectile = ProjectilePressure_att / ProjectilePressure_def`

Contract:
1. projectile HQ is Instinct-led
2. distance increases attacker lead quality
3. projectiles reward spacing and precision

Definitions:
1. `HQ_projectile`: ranged projectile hit-quality outcome before tier mapping
2. `ProjectilePressure_att`: attacker-side projectile tracking and lead term
3. `ProjectilePressure_def`: defender-side projectile evasion term
4. `K_hq_projectile_att_instinct`: attacker Instinct coefficient in projectile HQ
5. `K_hq_projectile_def_instinct`: defender Instinct coefficient in projectile HQ
6. `K_hq_projectile_range`: distance-to-projectile-lead coefficient
7. `HQ_floor`: minimum positive denominator floor used to keep HQ well-defined

Coefficient policy:
1. projectile HQ must remain Instinct-led on both offense and defense
2. `K_hq_projectile_range` must be positive so spacing improves projectile quality
3. target values remain provisional until projectile pressure bands are discussed explicitly

### 3.10 Spell Hit Quality
Locked target rule:
`Mind vs Instinct + distance dodge`

Target expression style:
`SpellPressure_att = K_hq_spell_att_mind * M_att`

`SpellPressure_def = max(HQ_floor, (K_hq_spell_def_instinct * I_def) + (K_hq_spell_distance_dodge * distance))`

`HQ_spell = SpellPressure_att / SpellPressure_def`

Contract:
1. targeted spells use attacker Mind as the tracking/intention stat
2. defender Instinct is the dodge and telegraph response stat
3. distance multiplies defender dodge opportunity
4. high-Instinct units should avoid targeted spells more reliably
5. low-Instinct brutes should not gain the same protection merely because the spell is cast from far away

Definitions:
1. `HQ_spell`: targeted spell hit-quality outcome before tier mapping
2. `SpellPressure_att`: attacker-side spell tracking and intent term
3. `SpellPressure_def`: defender-side dodge and telegraph-response term
4. `K_hq_spell_att_mind`: attacker Mind coefficient in spell HQ
5. `K_hq_spell_def_instinct`: defender Instinct coefficient in spell HQ
6. `K_hq_spell_distance_dodge`: distance-to-defender-dodge coefficient for targeted spells
7. `HQ_floor`: minimum positive denominator floor used to keep HQ well-defined

Coefficient policy:
1. spell HQ must remain Mind-on-offense versus Instinct-on-defense
2. `K_hq_spell_distance_dodge` must be positive so distance helps the defender, not the caster
3. low-Instinct brutes should still remain hittable because the dominant defensive stat is Instinct, not Body
4. target values remain provisional until spell telegraph bands are discussed explicitly

### 3.11 Hit Quality Tiers
Target tier ladder:
1. `miss`
2. `glancing`
3. `normal`
4. `critical`
5. `multi_critical`

Tier meaning:
1. `miss`: no landed damage
2. `glancing`: weak but landed result
3. `normal`: standard resolved hit
4. `critical`: elevated clean-hit tier
5. `multi_critical`: extreme clean-hit tier

Thresholds are intentionally left as target bands pending later discussion. Current implementation thresholds are not final truth.

### 3.12 Crit Chance
Target framing:
1. deterministic hit tiers may replace random crits in live resolution
2. if that is adopted, `crit chance` becomes an analytic or telemetry quantity rather than a mandatory RNG contract

This remains an open design question.

### 3.13 Crit Multiplier / Severity
Target form:
`CritSeverity = f(base_crit, Body_resilience, crit_tier_extension)`

Contract:
1. base critical severity exists
2. high Body reduces critical severity
3. multi-crit tiers may extend severity
4. tanks should resist spike lethality

Definitions:
1. `CritSeverity`: the final critical damage multiplier after defensive resilience is applied
2. `base_crit`: the baseline crit severity before mitigation
3. `Body_resilience`: the Body-derived burst resistance term
4. `crit_tier_extension`: any extra severity granted by higher critical tiers

### 3.14 Critical Expectation
Target definition:
`CE` is an expected-value or telemetry concept used to reason about burst envelopes.

Contract:
1. `CE` is useful for analysis
2. `CE` may not correspond to a random in-combat roll if deterministic tiering is adopted

### 3.15 Final Damage Assembly
Target order:
1. base damage
2. HQ scalar
3. crit severity
4. outgoing modifiers
5. incoming modifiers
6. final floor
7. glancing minimum
8. miss-to-zero rule

Contract:
1. landed positive hits never floor to `0`
2. only true misses resolve to `0`

### 3.16 Status Scaling
Target form:
`Status = f(M_att / M_def)`

Required outputs:
1. proc chance
2. potency
3. duration

Contract:
1. Mind is the primary status authoring stat
2. status pressure is a primary Mind predation tool into Body

Definitions:
1. `Status`: shorthand for the family of status outputs, including proc, potency, and duration
2. `M_att`: attacker Mind as the status authoring and pressure stat
3. `M_def`: defender Mind as the resistance and stability stat

## Layer 4: Tactical Pacing Metrics
These metrics answer questions like average actions per turn and average damage per turn.

### DPT
Definition:
average resolved damage output per turn over a chosen window

Use:
1. compare archetype throughput
2. reason about burst vs sustain

### APT
Definition:
average actions per turn over a chosen metabolic window

Use:
1. compare tempo and reserve efficiency
2. reason about initiative advantage turning into sustained action output

### TTK
Definition:
turns required to deplete defender HP under a chosen engagement model

Use:
1. compare matchup dominance
2. separate burst-kill from attrition-kill profiles

### Turns-To-First-Rest
Definition:
how many turns a profile can operate before rest becomes necessary

### Turns-To-Exhaustion
Definition:
turn count before the exhaustion state is entered under a defined workload

### Opening Pressure From Range
Definition:
expected early-turn output gained before contact

### Sustained Pressure After Contact
Definition:
steady-state throughput once melee or trading range is established

### Expected Glancing Frequency
Definition:
how often a matchup tends to land in `glancing` rather than `normal+`

### AI Pacing Interpretation
Target rule:
AI pacing should be derived from observable runtime state, not internal formula knowledge.

Contract:
1. decision logic should read current and projected `Spark`, `Mana`, `Exhaustion`, `isExhausted`, and action count
2. decision logic should not branch on hidden combat coefficients, BFI equations, or metabolic ladder constants directly
3. if the IRES formula package changes later, AI should adapt automatically through changed runtime state rather than requiring formula-specific rewrites

Target interpretation layer:
1. `SparkRatio = Spark / maxSpark`
2. `ManaRatio = Mana / maxMana`
3. `ExhaustionRatio = Exhaustion / 100`
4. `ReservePressure = f(SparkRatio, ManaRatio)`
5. `FatiguePressure = f(ExhaustionRatio, isExhausted)`
6. `RecoveryPressure = f(ReservePressure, FatiguePressure, actionCountThisTurn)`

Use:
1. decide whether to take one more action in the same turn
2. decide whether to end turn early
3. decide whether to take a full rest action
4. decide whether a Spark Burn or exhaustion-entry action is unacceptable

Design implication:
1. AI is allowed to observe resource previews for the candidate action it is evaluating
2. AI is not allowed to be authored against the literal BFI formula or any specific coefficient version
3. this keeps AI robust across future combat and IRES tuning passes

## Layer 5: IRES / Metabolic Formulas
### 5.1 BFI
Locked target formula:
`WeightedSum = (K_bfi_body_weight * B) + (K_bfi_instinct_weight * I) + (K_bfi_mind_weight * M)`

`BFI_base = round(K_bfi_ceiling - (K_bfi_scale * ln(1 + (WeightedSum / K_bfi_dampener))))`

`BFI_effective = clamp(BFI_base + WeightAdjustment, 6, 12)`

Meaning:
1. lower BFI means lower action friction
2. higher BFI means harsher metabolic tax

Contract:
1. Instinct is the strongest mobility friction reducer
2. Body contributes conditioning
3. Mind contributes focus and rhythm discipline
4. equipment burden adds external friction after physiology is resolved
5. logarithmic compression prevents extreme stats from collapsing BFI too quickly

Definitions:
1. `K_bfi_ceiling`: baseline friction ceiling before logarithmic relief
2. `K_bfi_scale`: logarithmic gain multiplier
3. `K_bfi_dampener`: early-investment sensitivity constant
4. `K_bfi_body_weight`: Body coefficient in `WeightedSum`
5. `K_bfi_instinct_weight`: Instinct coefficient in `WeightedSum`
6. `K_bfi_mind_weight`: Mind coefficient in `WeightedSum`
7. `WeightAdjustment`: numeric burden from equipment tier

Target coefficient values:
1. `K_bfi_ceiling = 14`
2. `K_bfi_scale = 1.87`
3. `K_bfi_dampener = 7`
4. `K_bfi_body_weight = 3`
5. `K_bfi_instinct_weight = 6`
6. `K_bfi_mind_weight = 1`
7. `WeightAdjustment`: `None = 0`, `Light = 1`, `Medium = 2`, `Heavy = 3`

### 5.2 Spark Pool
Target form:
`Spark = f(B)`

Interpretation:
1. Body is the primary Spark reserve source
2. Spark supports locomotion and physical throughput

### 5.3 Spark Recovery
Target form:
`SparkRecovery = f(B)`

Interpretation:
1. Body represents conditioning and repeatability

### 5.4 Mana Pool
Target form:
`Mana = f(M)`

Interpretation:
1. Mind is the primary Mana reserve source

### 5.5 Mana Recovery
Target form:
`ManaRecovery = f(M)`

Interpretation:
1. Mind represents focus and recentering capacity

### 5.6 Effective BFI
Target form:
`BFI_effective = BFI_base + WeightAdjustment`

Interpretation:
1. effective BFI is the row selector for metabolic pressure

Definitions:
1. `BFI_base`: the stat-derived friction before burden adjustments
2. `WeightAdjustment`: the final additive burden delta applied after equipment-burden mapping

### 5.7 Metabolic Tax Ladder
Contract:
1. ladder rows represent effective friction tiers
2. ladder columns represent increasing action ordinal inside a beat or pressure step
3. higher rows mean harsher metabolic friction
4. later columns mean harsher repeated-action pressure within the same beat

### 5.8 Avg Actions Per Turn
Target derivation inputs:
1. reserves
2. recovery
3. BFI
4. tax ladder
5. rest thresholds

### 5.9 Avg Damage Per Turn
Target derivation inputs:
1. action capacity
2. hit quality
3. damage per landed hit
4. sustain over a beat window

### 5.10 Throughput Interaction
Contract:
1. combat stats decide per-action quality
2. IRES decides action frequency
3. together they decide real fight outcome

### 5.11 AI Runtime Coupling Rule
Contract:
1. runtime AI should couple to post-formula state, not pre-formula math
2. the approved AI interface for pacing is:
   - current resource state
   - projected resource state after a candidate action
   - explicit blocked-action or Spark Burn preview flags where available
3. BFI remains an engine-side pacing mechanism, not a value AI should reason about directly

Examples:
1. acceptable:
   - "projected SparkRatio falls too low"
   - "projected FatiguePressure rises too high"
   - "this action would enter exhausted state"
   - "this action would trigger Spark Burn HP loss"
2. not acceptable:
   - "if BFI > 9 then do not cast"
   - "if metabolic tax row >= 3 then wait"
   - "if coefficient package changes, hand-retune fixed AI thresholds against raw formulas"

## Layer 6: Matchup Triangle Contract
### Body > Instinct
Winning mode:
1. close-range attrition
2. resilience against burst
3. map-control and collision dominance

Expectations:
1. Body wins sustained close fights
2. Instinct should not erase Body by merely dodging forever at contact range

### Mind > Body
Winning mode:
1. magical bypass pressure
2. range-enabled opening tempo
3. status and control war

Expectations:
1. Body bulk should not invalidate magical predation
2. low-Instinct brutes should suffer from targeted spell pressure

### Instinct > Mind
Winning mode:
1. safe projectile pressure
2. high spell avoidance
3. initiative and clean-hit advantage

Expectations:
1. high-Instinct units should contest targeted spells effectively
2. fragile Mind-heavy casters should suffer under clean ranged pressure

For every triangle edge, evaluation should consider:
1. per-hit expectation
2. throughput expectation
3. positional expectation
4. metabolic expectation

## Layer 7: Cross-Layer Dependency Matrix
| Metric | Body | Instinct | Mind |
| --- | --- | --- | --- |
| HP | primary | secondary | secondary |
| Atk_phys | primary | secondary | none |
| Atk_mag | none | none | primary |
| Def_phys | primary | indirect | none |
| Def_mag | none | indirect | primary |
| HQ_melee | indirect | primary | none |
| HQ_projectile | none | primary | none |
| HQ_spell | none | secondary as defense | primary as offense |
| crit severity | primary as resistance | secondary | none |
| initiative | none | primary | secondary |
| BFI | secondary | primary | secondary |
| Spark reserve | primary | indirect | none |
| Mana reserve | none | none | primary |
| APT | indirect | primary | secondary |
| DPT | primary or secondary by build | primary or secondary by build | primary or secondary by build |
| TTK | primary as survivability | secondary as tempo | secondary as magic/status pressure |

## Worked Example Profiles
### Standard Human: `10/10/10`
1. HP: `100`
2. offense bias: neutral
3. defense bias: neutral
4. HQ tendencies: normal baseline
5. metabolic posture: readable middle baseline
6. matchup role: reference profile

### Body Apex: `100/10/10`
1. HP: `640`
2. offense bias: physical and impact
3. defense bias: overwhelming physical durability
4. HQ tendencies: not inherently evasive, but oppressive on contact
5. metabolic posture: conditioned but burden-sensitive
6. matchup role: tank stress test

### Instinct Apex: `10/100/10`
1. HP: `370`
2. offense bias: projectile precision and tempo
3. defense bias: avoidance and clean-hit denial
4. HQ tendencies: dominates ranged tracking
5. metabolic posture: best friction reduction
6. matchup role: scout stress test

### Mind Apex: `10/10/100`
1. HP: `190`
2. offense bias: spell and status
3. defense bias: magical resistance
4. HQ tendencies: targeted spell authority
5. metabolic posture: deep mana posture
6. matchup role: mage stress test

### Brute
Suggested reference shape:
`60/10/10`

### Scout
Suggested reference shape:
`10/60/10`

### Mage
Suggested reference shape:
`10/10/60`

### Balanced Heroic
Suggested reference shape:
`35/35/35`

For Brute, Scout, Mage, and Balanced Heroic, the ledger should record:
1. derived HP
2. offense bias
3. defense bias
4. HQ tendencies
5. BFI posture
6. expected matchup role

## Open Questions
1. Should values above `100` ever enter the live contract?
2. Is `crit chance` a real gameplay variable or a telemetry abstraction under deterministic tiers?
3. Should melee `HQ` be fully specified by an exact closed-form equation now, or remain `Instinct + adjacency lock` until discussed further?
4. Should AoE spells use the same `HQ_spell` contract as targeted spells?
5. Should rooted later receive a true movement-phase duration model?
6. Should the AI pacing layer expose its normalized `ReservePressure` / `FatiguePressure` / `RecoveryPressure` values in telemetry by default?

## Test Contract Mapping
### `packages/engine/src/__tests__/combat_calculator_v2.test.ts`
Should eventually verify:
1. ledger-aligned v2 formula examples
2. glancing minimum contract
3. spell and projectile HQ behavior

Still provisional:
1. exact v2 thresholds
2. currently hardcoded sample coefficients

### `packages/engine/src/__tests__/trinity_ratio_matchups.test.ts`
Should eventually verify:
1. triangle contract examples
2. archetypal matchup behavior

Still provisional:
1. exact matchup envelopes
2. exact TTK thresholds

### `packages/engine/src/__tests__/status_action_phase.test.ts`
Should eventually verify:
1. status duration semantics implied by the ledger
2. control-vs-soft-debuff timing separation

### `packages/engine/src/__tests__/ires_bfi.test.ts`
Should eventually verify:
1. BFI reference profiles
2. weight-class interaction

Still provisional:
1. implementation coefficients until the ledger is adopted

### `packages/engine/src/__tests__/ires_metabolic_formulas.test.ts`
Should eventually verify:
1. Spark, Mana, and BFI formulas from the ledger
2. Trinity-to-metabolism relationships

### `packages/engine/src/__tests__/ires_metabolic_simulator.test.ts`
Should eventually verify:
1. `APT`
2. rest cadence
3. movement-vs-casting pacing
4. throughput interaction with combat quality

### `packages/engine/src/__tests__/ai_resource_signals.test.ts`
Should eventually verify:
1. normalized AI-facing resource ratios
2. reserve, fatigue, and recovery pressure derivation
3. exhaustion-state override behavior

Still provisional:
1. exact pressure coefficients if the normalization layer is reweighted later

Pending until ledger approval:
1. final tuning values
2. final target envelopes

## Important Interface / Process Changes
No runtime code changes are part of this document itself.

Process contract introduced by this ledger:
1. `docs/COMBAT_FORMULA_LEDGER.md` becomes the target-state combat math ledger
2. future combat/IRES formula changes must reference and update it
3. `combat_calculator_v2.test.ts` remains provisional until the ledger is approved

## Current Implementation Reference Points
These files inform the current engine, but this ledger is not a mirror of them:
1. `packages/engine/src/systems/combat/trinity-resolver.ts`
2. `packages/engine/src/systems/combat/combat-calculator.ts`
3. `packages/engine/src/systems/combat/hit-quality.ts`
4. `packages/engine/src/systems/combat/critical-outcome.ts`
5. `packages/engine/src/systems/ires/bfi.ts`
6. `packages/engine/src/systems/ires/metabolic-config.ts`
7. `packages/engine/src/systems/ires/metabolic-formulas.ts`
8. `packages/engine/src/systems/ires/metabolic-tax-ladder.ts`
9. `packages/engine/src/systems/ires/metabolic-simulator.ts`
