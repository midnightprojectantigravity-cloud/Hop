# AI + IRES Alignment Signoff

## Purpose
This document records the accepted runtime-alignment pass that followed the grounded BFI and post-roster rebalance work.

It exists to make three things explicit:
- which grounded runtime anchors now govern reserve validation
- which artifacts are authoritative for acceptance
- which parity and golden baselines were intentionally regenerated

## Grounded Runtime Anchors
The accepted runtime anchors for this phase are:
- `standard_human = 10 / 10 / 10`
- `bruiser_frontline = 16 / 4 / 8`
- `skirmisher_light = 8 / 6 / 16`
- `caster_mind = 6 / 16 / 8`
- `companion_falcon = 4 / 6 / 18`
- `companion_skeleton = 12 / 2 / 4`
- `boss_anchor = 18 / 14 / 10`

Accepted burden assumptions:
- `standard_human`: `None`
- `bruiser_frontline`: weight-derived burden
- `skirmisher_light`: weight-derived burden
- `caster_mind`: `None`
- `companion_falcon`: `None`
- `companion_skeleton`: `Medium`
- `boss_anchor`: `Heavy`

## Accepted Runtime Policy
This phase locked the following runtime policy:
- reserve pools remain formula-driven
- instinct continues to matter through BFI and Spark efficiency, not direct reserve-pool scaling
- grounded loops are judged by role-appropriate sustain, not by equal pool totals
- parity, harness, and golden artifacts may change when the runtime is intentionally re-authored

## Reserve Formula State
Accepted metabolic version:
- `ires-metabolism-v7`

Accepted formula shifts in [metabolic-config.ts](../packages/engine/src/systems/ires/metabolic-config.ts):
- Spark pool: `108 + body * 2.4`
- Spark recovery: `21 + body * 0.6`
- Mana pool: `12 + mind * 2.2`
- Mana recovery: `3 + mind * 0.45`

BFI state remains:
- logarithmic grounded BFI
- burden-adjusted effective BFI
- unchanged ladder bounds

## Accepted Target Loops
The following target loops are the authoritative metabolic acceptance surface in [metabolic-targets.ts](../packages/engine/src/systems/ires/metabolic-targets.ts):
- `standard_move_attack_loop`
- `ranged_attack_spacing_loop`
- `caster_signature_loop`
- `bomber_setup_loop`
- `falcon_support_loop`
- `skeleton_attrition_loop`

Interpretation:
- `standard_human` should sustain a readable move-plus-attack loop without immediate reserve collapse
- `caster_mind` and bomber-like setup loops must not fail from native Mana starvation
- falcon remains efficient but not free
- skeleton remains intentionally low-throughput

## Authoritative Acceptance Artifacts
Primary metabolic acceptance:
- [IRES_METABOLIC_REPORT.json](../artifacts/ires/IRES_METABOLIC_REPORT.json)
- [IRES_METABOLIC_REPORT.md](../artifacts/ires/IRES_METABOLIC_REPORT.md)
- [IRES_SKILL_BAND_AUDIT.md](../artifacts/ires/IRES_SKILL_BAND_AUDIT.md)

Primary runtime/parity acceptance:
- [expected_outputs.v1.json](../packages/engine/src/__tests__/__fixtures__/ai/enemy_decision_corpus/expected_outputs.v1.json)
- [enemy_ai_shadow_fallback_rate.test.ts](../packages/engine/src/__tests__/enemy_ai_shadow_fallback_rate.test.ts)
- [harness_ai_convergence_regression.test.ts](../packages/engine/src/__tests__/harness_ai_convergence_regression.test.ts)
- [golden-runs/fixtures](../packages/engine/src/__tests__/golden-runs/fixtures)

## Regenerated Baselines
The following baselines were intentionally refreshed in this phase:
- enemy AI parity corpus fixture
- shadow fallback corpus-size expectation
- harness convergence envelopes for:
  - `VANGUARD`
  - `NECROMANCER`
  - `SKIRMISHER`
  - `FIREMAGE`
- golden run fixture fingerprints and accepted outcome envelopes

## Signoff Commands
These are the commands used to validate the accepted state:

```powershell
npx vitest run packages/engine/src/__tests__/ires_metabolic_formulas.test.ts packages/engine/src/__tests__/ires_metabolic_simulator.test.ts packages/engine/src/__tests__/ires_metabolic_bridge.test.ts packages/engine/src/__tests__/ires_metabolic_report.test.ts
npm run ires:metabolic:report
npm --workspace @hop/engine run generate-enemy-ai-parity-fixture
npx vitest run packages/engine/src/__tests__/enemy_ai_parity_corpus.test.ts packages/engine/src/__tests__/enemy_ai_synthetic_edge_parity.test.ts packages/engine/src/__tests__/enemy_ai_shadow_fallback_rate.test.ts
npx vitest run packages/engine/src/__tests__/harness_ai_convergence_regression.test.ts
npx vitest run packages/engine/src/__tests__/balance_harness.test.ts
npm run golden:rebaseline:fingerprints
npx vitest run packages/engine/src/__tests__/golden-runs/golden_run.test.ts
```

## What This Phase Does Not Claim
This signoff does not claim:
- map/worldgen pressure is fully tuned
- player archetype parity is finished
- selector quality is globally ideal

It only claims:
- the grounded BFI and post-roster runtime now have an accepted reserve model
- runtime validation artifacts were rebaselined to that accepted state
- the next pressure issues should be investigated as map/composition/AI problems, not as stale-runtime-contract problems
