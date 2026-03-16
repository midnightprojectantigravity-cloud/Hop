# The Hop Engine: Gold Standard Balancing

## Purpose
This document defines how balance work should be done in Hop.

It is the canonical guide for design and engineering when answering questions like:
- what kind of play experience balance should produce
- which lever to touch first
- how broad the consequences of a tuning change will be
- which reports and gates should confirm the change

Balance is not the pursuit of equal numbers. The goal is a controllable, legible play experience with:
- meaningful role identity
- fair pressure
- readable cause and effect
- tunable difficulty
- deterministic validation

Audience:
- designers
- gameplay engineers
- AI and worldgen engineers

Scope:
- current PvE milestone
- current IRES, Balance Stack, Director, and worldgen pipeline

Non-goals:
- PvP parity
- speculative future systems
- feature ideation disguised as tuning

> **Where to start**
>
> - Systemic tempo issue: inspect [bfi.ts](../packages/engine/src/systems/ires/bfi.ts) and [config.ts](../packages/engine/src/systems/ires/config.ts)
> - Roster fairness issue: inspect [systems/evaluation](../packages/engine/src/systems/evaluation)
> - Run pacing issue: inspect [compiler.ts](../packages/engine/src/generation/compiler.ts) plus encounter/floor reports
> - Archetype behavior issue: inspect [selector.ts](../packages/engine/src/systems/ai/player/selector.ts), [policy.ts](../packages/engine/src/systems/ai/player/policy.ts), and [skill-intent-profile.ts](../packages/engine/src/systems/skill-intent-profile.ts)

## Core Philosophy
### Experience first, math second
Players feel tempo, danger, clarity, and identity before they feel coefficients. The numbers matter because they create those experiences, not because equality on paper is the goal.

### Tune the highest effective layer first
If a problem comes from turn cadence, recovery pressure, or route density, do not begin with skill damage numbers. Fix the layer that actually owns the problem.

### Prefer systemic fixes over local patches when the problem is systemic
If all actors are chaining too many actions, the right lever is usually BFI, Fibonacci growth, recovery cadence, or exhaustion thresholds. It is rarely six different skill nerfs.

### Prefer role clarity over flattening
Parity does not mean every archetype or enemy should feel similar. Vanguard should still feel durable, Firemage should still feel like zone control, and Skirmisher should still feel like setup and movement conversion.

### Reinforce weak-side identity before bluntly nerfing strong-side identity when possible
If a weak archetype is failing because its selector misuses its kit or its setup burden is mis-modeled, fix that before deleting the strong archetype's identity.

### Balance is about controllable pressure, not raw win-rate only
Win-rate, average floor, and success rates are important, but they are mixed signals. They must be read alongside static loadout power, encounter difficulty, IRES stress, and Director telemetry.

### Information quality is part of fairness
If the HUD, preview, log, or state badges fail to explain what happened, players will read the system as unfair even when the math is internally correct. UI clarity is a balance lever.

### Example: macro lever vs micro lever
Increasing default BFI changes:
- how many actions fit in a turn
- when exhaustion becomes relevant
- how soon resting matters
- whether greedy chains feel viable
- how both enemies and players pace themselves

Changing one skill multiplier, such as `FIREBALL` damage, changes:
- one local exchange
- one archetype's tactic
- one subset of encounters

That is why BFI is a macro-tempo decision and a skill multiplier is a micro-tactic decision.

## Balance Layer Hierarchy
Treat balance work as a stack. Start at the highest responsible layer, not the most visible symptom.

### 1. Ruleset / economy layer
Controls:
- action cadence
- exhaustion growth
- recovery cadence
- redline behavior
- spark burn pressure
- travel leniency

Typical files:
- [bfi.ts](../packages/engine/src/systems/ires/bfi.ts)
- [config.ts](../packages/engine/src/systems/ires/config.ts)
- [validation.ts](../packages/engine/src/systems/ires/validation.ts)

Gameplay meaning:
- defines the baseline rhythm of turns
- defines whether greed is cheap or expensive
- defines how quickly the game asks the player to respect resource discipline

Use this when:
- too many units take too many actions per turn
- the whole game feels too spammy or too strict
- resting is irrelevant or oppressive across the board

Do not use this to fix:
- one bad skill
- one enemy subtype
- one selector bug

### 2. Actor chassis layer
Controls:
- HP, durability, trinity, speed, weight class
- basic survivability and shell-level pressure

Typical files:
- [trinity-profiles.ts](../packages/engine/src/systems/combat/trinity-profiles.ts)
- [mvp-enemy-content.ts](../packages/engine/src/data/packs/mvp-enemy-content.ts)
- [enemy-catalog.ts](../packages/engine/src/data/enemies/enemy-catalog.ts)

Gameplay meaning:
- determines what a unit can endure
- determines how punishing it is to expose that unit
- determines how strongly its role reads before skill choice matters

Use this when:
- one enemy or archetype is over- or under-performing regardless of map
- a unit's basic body does not match its intended role

Do not use this to fix:
- route difficulty
- bad AI sequencing
- a local targeting problem

### 3. Skill layer
Controls:
- damage, range, area, cooldown, cost, targeting shape
- direct tactical options and local risk/reward

Typical files:
- [skills](../packages/engine/src/skills)
- [skill-intent-profile.ts](../packages/engine/src/systems/skill-intent-profile.ts)
- [balance-skill-power.ts](../packages/engine/src/systems/evaluation/balance-skill-power.ts)

Gameplay meaning:
- shapes what a tactic can do when chosen correctly
- shapes local burst, reach, control, and repeatability

Use this when:
- the skill itself is too strong, too weak, too safe, too broad, or too cheap
- the problem survives correct economy, correct chassis, and correct AI behavior

Do not use this to fix:
- systemic action economy
- recovery-floor pacing
- selector incompetence

### 4. AI behavior layer
Controls:
- which actions get chosen
- when to rest or end turn
- how setup-dependent kits are converted into actual value

Typical files:
- [selector.ts](../packages/engine/src/systems/ai/player/selector.ts)
- [policy.ts](../packages/engine/src/systems/ai/player/policy.ts)
- [systems/ai/enemy](../packages/engine/src/systems/ai/enemy)

Gameplay meaning:
- determines whether theoretical power becomes real pressure
- determines whether an archetype looks smart, wasteful, or self-destructive

Use this when:
- static power looks fine but runtime behavior is weak
- a loadout wastes turns, refuses to rest, or misuses setup tools

Do not use this to fix:
- intrinsic boss-grade numbers
- floor budget violations caused by encounter composition

### 5. Map / floor difficulty layer
Controls:
- route count
- route asymmetry
- trap and obstacle density
- straight-run pressure
- recovery access

Typical files:
- [compiler.ts](../packages/engine/src/generation/compiler.ts)
- [modules.ts](../packages/engine/src/generation/modules.ts)
- [balance-floor-difficulty.ts](../packages/engine/src/systems/evaluation/balance-floor-difficulty.ts)

Gameplay meaning:
- determines whether the player has room to breathe, flank, reset, or reroute
- determines whether a floor feels like a puzzle, a pressure hall, or an arena

Use this when:
- a floor role does not feel like its label
- recovery floors feel punishing
- one lane is not meaningfully safer or riskier

Do not use this to fix:
- a single enemy's shell
- a weak skill coefficient

### 6. Encounter composition layer
Controls:
- which enemies spawn together
- how much power is present on a floor
- how enemy power interacts with terrain

Typical files:
- [floor-spawn-profile.ts](../packages/engine/src/data/enemies/floor-spawn-profile.ts)
- [enemy-catalog.ts](../packages/engine/src/data/enemies/enemy-catalog.ts)
- [balance-encounter-difficulty.ts](../packages/engine/src/systems/evaluation/balance-encounter-difficulty.ts)

Gameplay meaning:
- determines the practical pressure of a floor, not just its geometry
- determines whether the player is solving skirmishes, chokes, artillery, or attrition

Use this when:
- budget violations cluster by floor
- a floor is fair geometrically but still too hot

Do not use this to fix:
- a broken BFI curve
- a selector issue

### 7. Loadout / roster parity layer
Controls:
- relative fairness between archetypes and between enemies
- whether one roster member sits far above or below median

Typical files:
- [balance-loadout-power.ts](../packages/engine/src/systems/evaluation/balance-loadout-power.ts)
- [balance-enemy-power.ts](../packages/engine/src/systems/evaluation/balance-enemy-power.ts)
- [balance-parity.ts](../packages/engine/src/systems/evaluation/balance-parity.ts)
- [balance-budget-config.ts](../packages/engine/src/systems/evaluation/balance-budget-config.ts)

Gameplay meaning:
- determines whether identity differences remain within an acceptable envelope
- prevents one archetype from being the obvious default answer

Use this when:
- reports show consistent over/under parity
- roster fairness, not single-fight drama, is the problem

Do not use this to fix:
- one bad floor seed
- one isolated player complaint with no system evidence

### 8. Runtime validation layer
Controls:
- whether the static model matches actual play
- whether changes regress the live tuning envelope

Typical files:
- [runBalanceStackReport.ts](../packages/engine/scripts/runBalanceStackReport.ts)
- [runBalanceStackGate.ts](../packages/engine/scripts/runBalanceStackGate.ts)
- [runIresStressReport.ts](../packages/engine/scripts/runIresStressReport.ts)
- [runIresStressGate.ts](../packages/engine/scripts/runIresStressGate.ts)
- [balance-harness-summary.ts](../packages/engine/src/systems/evaluation/balance-harness-summary.ts)

Gameplay meaning:
- proves whether the experience created by the stack matches the intended envelope

Use this when:
- confirming a change
- disproving a theory
- catching drift

Do not use this to fix:
- the meaning of a lever itself
- ambiguous ownership of a problem

## Lever Taxonomy
Use this as the quick reference for what a knob actually does.

| Lever | Source of truth | Gameplay effect | Blast radius | Best use case | Common misuse |
| --- | --- | --- | --- | --- | --- |
| Base BFI curve | [bfi.ts](../packages/engine/src/systems/ires/bfi.ts) | Changes base action-tax tempo for all actors | System-wide | Global turn chaining is too cheap or too harsh | Using it to fix one archetype |
| Weight-class BFI modifier | [bfi.ts](../packages/engine/src/systems/ires/bfi.ts) | Makes light units greedier and heavy units more deliberate | Roster-wide | Weight fantasy is not reading in action cadence | Using it to patch HP imbalance |
| Fibonacci exhaustion table | [config.ts](../packages/engine/src/systems/ires/config.ts) | Changes how sharply extra actions spike in cost | System-wide | Turns feel too flat or too explosive | Treating it as a skill-balance tool |
| Recovery and rest values | [config.ts](../packages/engine/src/systems/ires/config.ts) | Changes how easy it is to recover tempo and resources | System-wide | Resting is irrelevant or mandatory too often | Using it to hide poor skill costs |
| Exhaustion hysteresis thresholds | [config.ts](../packages/engine/src/systems/ires/config.ts) | Changes when redline begins and ends | System-wide | Exhausted state is too sticky or too loose | Using thresholds instead of fixing BFI |
| Spark burn | [config.ts](../packages/engine/src/systems/ires/config.ts) | Determines cost of ignoring exhaustion discipline | System-wide | Redline should be more or less punishable | Using burn to compensate for overtuned offense |
| Trinity profiles | [trinity-profiles.ts](../packages/engine/src/systems/combat/trinity-profiles.ts) | Shapes intrinsic role shells | Roster-wide | Archetype bodies do not match intended identity | Using trinity to fix selector bugs |
| Enemy shell stats and loadouts | [mvp-enemy-content.ts](../packages/engine/src/data/packs/mvp-enemy-content.ts), [enemy-catalog.ts](../packages/engine/src/data/enemies/enemy-catalog.ts) | Shapes enemy threat before map context | Enemy-specific | One subtype is intrinsically off-band | Using shell stats to fix encounter mix problems |
| Skill damage/cost/cooldown/range/area | [skills](../packages/engine/src/skills) | Tunes local tactic power and repeatability | Local to archetype/enemy | One skill is mispriced or misranged | Nerfing a skill before checking macro economy |
| Intent-profile setup and risk | [skill-intent-profile.ts](../packages/engine/src/systems/skill-intent-profile.ts) | Changes how theoretical skill power converts in runtime | Archetype-specific | Setup-heavy kits are over- or under-valued | Treating setup metadata as pure flavor |
| Selector and policy weights | [selector.ts](../packages/engine/src/systems/ai/player/selector.ts), [policy.ts](../packages/engine/src/systems/ai/player/policy.ts) | Changes sequencing, rest timing, and tactical judgment | Runtime behavior | Static power is fine but play looks bad | Using policy to hide bad intrinsic power forever |
| Route profile and topology | [compiler.ts](../packages/engine/src/generation/compiler.ts) | Changes safety, flanking space, and route pressure | Floor-role wide | Recovery vs pressure floors do not read correctly | Using map shape to rescue a weak loadout permanently |
| Encounter budgets and parity thresholds | [balance-budget-config.ts](../packages/engine/src/systems/evaluation/balance-budget-config.ts) | Defines acceptable fairness bands | Reporting and tuning-wide | Formalize what counts as drift | Treating thresholds as flavor, not gates |
| Director progression shaping | [compiler.ts](../packages/engine/src/generation/compiler.ts), [telemetry.ts](../packages/engine/src/generation/telemetry.ts) | Shapes run arc and floor sequencing | Run-wide | Difficulty spikes cluster badly | Using Director instead of fixing bad floor content |
| HUD, preview, state messaging | [apps/web/src/components/ui](../apps/web/src/components/ui), [PreviewOverlay.tsx](../apps/web/src/components/PreviewOverlay.tsx) | Changes perceived fairness and clarity | Player-facing | Players do not understand costs, redline, or traps | Calling an information problem a numeric problem |

## Gameplay Meaning of the Major Levers
### Tempo and action-economy levers
#### Base BFI
Current source: [bfi.ts](../packages/engine/src/systems/ires/bfi.ts)

Current meaning:
- current default curve is `clamp(6 - floor(Instinct / 5), 2, 10)`
- higher BFI increases the effective Fibonacci tax earlier
- lower BFI allows longer turns before exhaustion pressure spikes

What it feels like:
- raising BFI makes every extra action feel more expensive, shortens greedy turns, and makes resting matter earlier
- lowering BFI makes actors feel freer, more spammy, and more willing to chain

#### Weight-class BFI modifier
Current source: [bfi.ts](../packages/engine/src/systems/ires/bfi.ts)

Current defaults:
- `Light`: `-1` BFI and cheaper movement Spark
- `Medium`: neutral
- `Heavy`: `+2` BFI and more expensive movement Spark

What it feels like:
- `Light` units feel nimble and permissive
- `Heavy` units feel deliberate, committed, and more punished for greed

#### Fibonacci growth
Current source: [config.ts](../packages/engine/src/systems/ires/config.ts)

Current default table:
- `[1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]`

What it feels like:
- steeper later values make turn 3, 4, and 5 feel like genuine commitments
- flatter values make extra actions feel like minor surcharges instead of redline choices

Worked example:
- changing default BFI is a macro-tempo decision because it changes the cost of action chaining for the whole cast
- changing `FIREBALL` damage is a micro-tactic decision because it changes one archetype's payoff after the action has already been chosen

Use this when:
- the game-wide turn rhythm is wrong
- too many actors can act too long before respecting exhaustion

Do not use this when:
- one specific skill or enemy is the issue

Typical side effects:
- AI sequencing changes
- value of `Rest` changes
- Spark Burn frequency changes
- heavy vs light identity gets stronger or weaker

### Recovery and exhaustion levers
#### Spark / Mana recovery
Current source: [config.ts](../packages/engine/src/systems/ires/config.ts)

Current defaults:
- end-turn Spark recovery: `+25` unless exhausted
- end-turn Mana recovery: `+5`

What it feels like:
- higher recovery makes resource management softer and repeated engagement safer
- lower recovery makes each turn's spend matter for longer

#### Rest exhaustion clear
Current source: [config.ts](../packages/engine/src/systems/ires/config.ts)

Current default:
- `Rest` clears `25` exhaustion when the turn ends without moving or acting

What it feels like:
- higher rest clear makes disciplined pass turns powerful
- lower rest clear makes recovery slower and sustained greed more dangerous

#### Exhausted enter / exit thresholds
Current source: [config.ts](../packages/engine/src/systems/ires/config.ts)

Current defaults:
- enter exhausted at `>= 80`
- recover out of exhausted only when below `50`

What it feels like:
- lower enter threshold makes redline arrive earlier
- lower exit threshold makes exhaustion feel stickier

#### Spark burn
Current source: [config.ts](../packages/engine/src/systems/ires/config.ts)

Current default:
- `sparkBurnHpPct = 0.15`

What it feels like:
- higher burn means greed is survivability risk, not just economy risk
- lower burn makes exhausted casting more tolerable

Use this when:
- the recovery loop is wrong
- redline feels toothless or oppressive across the whole game

Do not use this when:
- a skill is merely numerically too strong

Typical side effects:
- rest frequency changes
- travel mode value shifts
- player tolerance for danger changes

### Skill tuning levers
#### Skill cost
What it feels like:
- lower cost makes a tactic more repeatable, but does not automatically make the whole game faster if BFI still caps chaining
- higher cost makes the tactic more selective and makes rest/resource planning matter more

#### Skill cooldown
What it feels like:
- longer cooldown pushes a skill toward spike identity
- shorter cooldown makes it part of the normal rotation

#### Skill range
What it feels like:
- more range increases safety, initiative, and tactical certainty
- less range forces exposure and route commitment

#### Skill area
What it feels like:
- larger area increases zone control, target reliability, and route denial
- smaller area makes a skill more precise and less universally useful

Worked example:
- increasing `FIREBALL` damage changes how rewarding a successful cast is
- it does not change how many total actions fit in the turn, how quickly exhaustion arrives, or whether resting matters

Use this when:
- the skill itself is mispriced, misranged, or mis-sized

Do not use this when:
- the whole economy is off
- the real issue is setup burden or selector choice

Typical side effects:
- matchup volatility changes
- kill pressure changes faster than general pacing
- strong archetypes can become oppressive if macro pacing is already permissive

### Map and encounter levers
#### Map route count
Current source: [compiler.ts](../packages/engine/src/generation/compiler.ts)

What it feels like:
- more routes create options, flanks, and differential safety
- fewer routes make pressure more direct and committed

#### Trap / obstacle density
Current source: [compiler.ts](../packages/engine/src/generation/compiler.ts), [modules.ts](../packages/engine/src/generation/modules.ts)

What it feels like:
- more density creates friction, commitment, and positional tax
- lower density makes fights more open and route-based

#### Encounter budget
Current source: [balance-budget-config.ts](../packages/engine/src/systems/evaluation/balance-budget-config.ts)

What it feels like:
- higher encounter budget means more total pressure on the floor even if geometry is fair
- lower encounter budget gives room for mistakes and experimentation

Worked example:
- if a recovery floor feels oppressive because both lanes are choked and trapped, a route/topology change can fix the perception of oppression without touching enemy HP

Use this when:
- a floor role does not read correctly
- same-kit fights feel harder or softer than their intended role

Do not use this when:
- the real issue is that an enemy subtype is intrinsically over budget

Typical side effects:
- ranged units become stronger or weaker
- rest windows change
- route clarity changes player confidence

### Progression shaping levers
#### Director recovery bias vs pressure bias
Current source: [compiler.ts](../packages/engine/src/generation/compiler.ts), [telemetry.ts](../packages/engine/src/generation/telemetry.ts)

What it feels like:
- stronger recovery bias gives players time to stabilize after stress spikes
- stronger pressure bias creates harsher arcs and less forgiveness between hard floors

Use this when:
- the run arc is wrong even though individual floors look acceptable

Do not use this when:
- a single floor type is intrinsically misbuilt

Typical side effects:
- difficulty clustering changes
- elite and boss lead-ins become more or less fair
- perceived campaign fairness changes without changing single-fight numbers

## Golden Order of Operations
1. Diagnose the problem.
   - Name the symptom in gameplay terms first.
   - Example: "Units are taking too many actions per turn" is better than "combat feels weird."
2. Identify the highest responsible layer.
   - Ask whether the problem is systemic, compositional, local, or informational.
3. Check whether the issue is systemic, compositional, or local.
   - Systemic: economy, pacing, recovery, redline
   - Compositional: map + encounter + progression
   - Local: one skill, one unit, one AI decision rule
4. Use static reports first.
   - Start with Balance Stack profiles and budget violations.
5. Use harness, stress, and runtime reports second.
   - Confirm whether the static diagnosis matches actual play.
6. Tune the smallest high-impact lever that solves the right problem.
   - Do not start from skill multipliers if the issue is actually turn cadence, map pressure, or AI sequencing.
7. Re-run gates.
   - Balance Stack gate
   - IRES stress gate
   - any relevant harness or scenario slice
8. Rebaseline only after the new state is accepted.
   - Baselines record accepted truth; they do not bless experiments automatically.

Rules:
- Do not use map favoritism to fix a weak loadout.
- Do not use AI patches to hide bad intrinsic power forever.
- Do not tune multiple layers at once unless the change is intentionally a multi-layer refactor.

## Diagnosis Cookbook
| Symptom | Likely layer | Inspect first | Preferred lever order |
| --- | --- | --- | --- |
| Actors are taking too many actions per turn | Ruleset / economy | [bfi.ts](../packages/engine/src/systems/ires/bfi.ts), [config.ts](../packages/engine/src/systems/ires/config.ts), IRES stress artifacts | Base BFI -> weight modifiers -> Fibonacci growth -> recovery values -> individual skill costs last |
| Firemage feels oppressive even when runtime progression is mediocre | Loadout parity plus runtime validation | Balance Stack loadout profiles, [balance-loadout-power.ts](../packages/engine/src/systems/evaluation/balance-loadout-power.ts), [selector.ts](../packages/engine/src/systems/ai/player/selector.ts), harness summaries | Static model -> selector/policy -> intent-profile setup/risk -> skill coefficients last |
| A recovery floor feels harsher than a pressure floor | Map / floor plus encounter composition | [compiler.ts](../packages/engine/src/generation/compiler.ts), floor and encounter profiles in Balance Stack | Safer-route access -> trap and obstacle density -> spawn mix -> Director sequencing |
| One enemy is overrepresented in budget violations | Enemy power and encounter composition | enemy parity rows, [mvp-enemy-content.ts](../packages/engine/src/data/packs/mvp-enemy-content.ts), [enemy-catalog.ts](../packages/engine/src/data/enemies/enemy-catalog.ts) | Chassis and cooldowns -> skill loadout -> spawn profile |
| A loadout is statically strong but performs poorly in harness runs | AI behavior or setup burden | loadout power profile, harness summary, IRES stress report, [skill-intent-profile.ts](../packages/engine/src/systems/skill-intent-profile.ts) | Selector/policy -> setup burden -> skill targeting/risk -> raw buffs last |
| A skill looks weak, but the actual issue is setup burden or selector behavior | Skill layer plus AI behavior | skill health/usage, [skill-intent-profile.ts](../packages/engine/src/systems/skill-intent-profile.ts), [selector.ts](../packages/engine/src/systems/ai/player/selector.ts) | Setup/risk metadata -> policy/selection -> cost/cooldown/damage |
| Players are confused or feel cheated, but the raw numbers are technically fair | Information layer | preview overlays, HUD, logs, status badges, simulation feedback | Preview accuracy -> messaging/logging -> state surfacing -> numeric changes only if clarity is not enough |

Worked example:
- A static loadout-parity outlier can still be a runtime underperformer. That usually means the model is over-crediting overlap or the AI is failing to convert the kit. Do not assume "high static score" means "needs a nerf" until runtime validation agrees.

Worked example:
- A selector/policy fix can solve a weak archetype without buffing raw skill numbers if the kit already has the right tools but chooses them badly or rests at the wrong times.

## Tooling and Artifacts
### Balance Stack
Purpose:
- static analysis of skills, loadouts, units, enemies, floors, encounters, and parity

Primary sources:
- [runBalanceStackReport.ts](../packages/engine/scripts/runBalanceStackReport.ts)
- [runBalanceStackGate.ts](../packages/engine/scripts/runBalanceStackGate.ts)
- [BALANCE_STACK_REPORT.json](../artifacts/balance/BALANCE_STACK_REPORT.json)
- [BALANCE_STACK_BASELINE.json](../artifacts/balance/BALANCE_STACK_BASELINE.json)
- [BALANCE_STACK_ALLOWLIST.json](../artifacts/balance/BALANCE_STACK_ALLOWLIST.json)

Use it for:
- identifying static outliers
- identifying budget violations
- deciding whether the issue is loadout, enemy, floor, or encounter ownership

Current gate truths from [balance-budget-config.ts](../packages/engine/src/systems/evaluation/balance-budget-config.ts):
- loadout and enemy parity target: within `+/-15%` of roster median
- parity error band: above `25%`
- budget warnings begin above role budget
- budget errors begin at more than `10%` over role budget
- boss parity is exempt from normal enemy parity and judged by boss budgets instead

### IRES stress reports
Purpose:
- runtime confirmation of resource strain, redline frequency, rest frequency, and Spark Burn pressure

Primary sources:
- [runIresStressReport.ts](../packages/engine/scripts/runIresStressReport.ts)
- [runIresStressGate.ts](../packages/engine/scripts/runIresStressGate.ts)

Use it for:
- confirming whether economy changes behave as intended
- detecting redline abuse
- seeing whether a loadout survives through discipline or through luck

### Balance harness summaries
Purpose:
- deterministic run summaries and archetype behavior evidence

Primary sources:
- [balance-harness-summary.ts](../packages/engine/src/systems/evaluation/balance-harness-summary.ts)
- [harness-types.ts](../packages/engine/src/systems/evaluation/harness-types.ts)

Use it for:
- average floor progression
- skill usage totals
- Director stress signals
- comparing candidate vs accepted behavior

### Director telemetry
Purpose:
- explain run-shape drift and floor-sequencing pressure

Primary sources:
- [telemetry.ts](../packages/engine/src/generation/telemetry.ts)
- [compiler.ts](../packages/engine/src/generation/compiler.ts)

Use it for:
- back-to-back pressure diagnosis
- recovery bias vs pressure bias validation
- run-arc fairness

### Allowlists
Purpose:
- track intentional temporary exceptions

Rules:
- allowlists are not design goals
- allowlists are not permanent hiding places
- every allowlist entry must be specific and justified

### Baseline artifacts
Purpose:
- record accepted state after a tuning change is reviewed and approved

Rule:
- do not rebaseline to silence a regression
- rebaseline only after the new state is intentionally accepted

## Anti-Patterns
- Balancing from vibes alone
  - Feel matters, but feel without source-of-truth reports produces random walk tuning.
- Balancing from win-rate alone
  - Win-rate mixes chassis, AI, map, encounter, and information quality into one late signal.
- Nerfing a skill before checking BFI, economy, and map pressure
  - This is the fastest route to local overfitting.
- Flattening archetypes to reach parity
  - Distinct roles are the point. Parity is an envelope, not sameness.
- Using allowlists as permanent exemptions
  - An allowlist entry is debt with a reason, not a normal state.
- Confusing information problems with numeric problems
  - If the player cannot read Spark Burn, exhaustion, or route risk, the experience will feel unfair even with correct math.
- Changing multiple layers at once and then claiming a single cause
  - If you change BFI, map routing, and `FIREBALL` damage in one batch, you do not know which lever solved the issue.

## Definition of Done
For the current milestone, balance is complete enough when all of the following are true:
- Balance Stack gate is green
- IRES stress gate is green
- there are no unallowlisted error violations
- only intentional documented exceptions remain
- recovery and pressure floor behavior matches intended role
- loadouts are in parity band or intentionally justified
- enemies are in parity band or intentionally justified
- the run arc no longer produces accidental difficulty spikes that the Director should have prevented

If a change cannot explain:
- which layer it touched
- why that layer owns the symptom
- what reports proved the change

then it is not yet gold-standard balance work.
