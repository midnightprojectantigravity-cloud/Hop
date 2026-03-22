# Trinity V2 Integration Signoff

## Status
Trinity combat and IRES are now integrated as the core runtime contract.

Current runtime truth:
1. Combat supports only `trinity_ratio_v2`.
2. Trinity content ships as one profile set: `core-v2-live`.
3. Replay bootstrap and validation accept only the integrated combat contract.
4. IRES runtime authority is the metabolic config path.
5. AI pacing is driven by observable Spark/Mana/exhaustion state and projected post-action pressure.

## Removed Transitional Systems
The following migration-era seams are retired:
1. `legacy_v1` combat runtime support
2. combat rollout flag injection
3. Trinity profile env override workflow
4. neutral-vs-live runtime profile split
5. replay bootstrap compatibility shims for the old combat contract
6. transitional health gate naming

## Runtime Ownership
Core design and formula ownership:
1. combat and IRES formula contract: `docs/COMBAT_FORMULA_LEDGER.md`
2. combat coefficients: `packages/engine/src/systems/combat/combat-coefficients.ts`
3. Trinity profile content: `packages/engine/src/systems/combat/trinity-profiles.ts`
4. IRES config authority: `packages/engine/src/systems/ires/metabolic-config.ts`
5. replay validation: `packages/engine/src/systems/replay-validation.ts`

## Stable Release Gates
Fast release gate:
1. `npm run build`
2. `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts --silent`
3. `npm run mvp:replay:gate`
4. `npm run mvp:timeline:audit`
5. `npm run mvp:turn-stack:audit:strict`
6. `npm run upa:health:release`
7. `npm run mvp:gate`

Deep analysis paths:
1. `npm run upa:health:full`
2. `npm run upa:matrix`
3. `npm run ires:metabolic:report`
4. `npm run ires:skill-bands:audit`
5. evaluator and parity/golden rebaseline suites as needed

## Remaining Debt
Remaining work is balance/tuning debt, not rollout debt:
1. reserve alignment by actor/loadout against beat-band expectations
2. parity/golden/harness envelope rebaseline
3. timeline audit budget cleanup
4. continued tuning of matchup and pacing envelopes

## Artifact Sources Of Truth
1. skill health: `docs/UPA_SKILL_HEALTH.json`
2. matchup matrix: `docs/UPA_PVP_MATCHUP_MATRIX.json`
3. IRES metabolic report: `artifacts/ires/IRES_METABOLIC_REPORT.md`
4. IRES skill band audit: `artifacts/ires/IRES_SKILL_BAND_AUDIT.md`
5. balance/evaluator artifacts: `artifacts/upa/`
