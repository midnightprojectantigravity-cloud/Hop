# Tactical Core Data Schemas (MVP V1)

This folder seeds the parser contract for Architecture Phase:

- `schemas/base-unit.schema.json`
- `schemas/composite-skill.schema.json`
- `examples/base-unit.raider.v1.json`
- `examples/composite-skill.shield-bash.v1.json`
- `contracts.ts`
- `contract-parser.ts`
- `index.ts`

## Parsing Notes

1. Unit instantiation:
- Read `instantiate.drawOrder` in order.
- For each key, evaluate `propensities[key]` with engine RNG only.
- If `counterMode = consume_global`, consume `GameState.rngCounter` per roll.
- Build `trinity`, `mass`, `speed`, then resolve `derivedStats` (`trinity_hp_v1` maps to `deriveMaxHpFromTrinity`).
- Build actor using `createEntity`.

2. Composite skill materialization:
- Start with `baseAction.effects` as the base `AtomicEffect` template list.
- Apply selected `upgrades[].modifiers` in declaration order.
- If inhibit/silence applies, filter effect list by `inhibit.removableTags`.
- Convert effect kinds:
  - `DEAL_DAMAGE` -> `AtomicEffect` type `Damage`
  - `APPLY_STATUS` -> `AtomicEffect` type `ApplyStatus`
  - `APPLY_FORCE` -> displacement/collision pipeline
  - `MESSAGE` -> `AtomicEffect` type `Message`

3. Resolution stack:
- `stackPolicy.resolveOrder = LIFO` is the ordering contract.
- `reaction.enqueuePosition = top` means push onto the top of stack before continuing resolution.

4. Coordinate contract:
- Use `coordSpace.system = cube-axial` and `pointFormat = qrs`.
- All pathing/targeting/physics should consume cube-compatible hex points (`q/r/s`).
