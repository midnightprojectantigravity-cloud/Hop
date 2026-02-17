# Visual Layer Contract

## Purpose
Define a deterministic contract between engine timeline signals and web rendering layers.

For the full biome + bestiary + triangle contract, see `docs/BIOME_BESTIARY_TRINITY_CONTRACT.md`.

## Board Layer Stack (authoritative)

### Conceptual runtime stack
1. Layer 0: Undercurrent.
2. Layer 1: Crust.
3. Layer 2: Clutter and obstacle sprites.
4. Layer 3: Interaction and UI overlays.

### Manifest asset stack
1. `ground`
2. `decal`
3. `prop`
4. `unit`
5. `fx`
6. `ui`

Both stacks must remain internally ordered and deterministic.

## Asset Format Policy
- `tile`, `decal`, `prop`: `svg`, `webp`, `avif`, `png`, `jpg`, `jpeg`.
- `unit`: `svg`, `webp`, `avif`, `png`.
- `fx`: `svg`, `webp`, `avif`, `png`.
- `ui`: `svg`.
- Every manifest asset must declare `recommendedFormat`.

## Biome Runtime Semantics
1. Undercurrent is global and may scroll via pattern transform.
2. Crust is global and must support deterministic seed shift.
3. Crust must support masked holes that expose undercurrent for hazard/fire zones.
4. Clutter/props may exceed hex bounds and must be Y-depth sorted.
5. Interaction overlays remain crisp SVG for tactical readability.

## Unit Readability Semantics
1. Player ring is cyan-adjacent; enemy ring is magenta-adjacent.
2. Units require rim-light silhouette separation.
3. Unit-on-floor readability target is minimum 4.5:1 contrast.
4. Runtime fallbacks must preserve readability when preferred assets are missing.

## Timeline-to-Visual Mapping

`INTENT_START`
- Show pre-action telegraph in `fx`.
- No displacement.

`MOVE_START`
- Start movement animation in `unit`.
- Optional preflight trails in `fx`.

`MOVE_END`
- Unit settles at destination.
- Enter/on-pass markers render only after movement settles.

`ON_PASS` / `ON_ENTER`
- Resolve interaction effects in `fx`.
- Persist state marks in `decal` when needed.

`HAZARD_CHECK`
- Hazard pulse/flash in `fx`.

`STATUS_APPLY`
- Status indicators in `ui` and optional `fx` pulse.

`DAMAGE_APPLY`
- Hit feedback in `fx`, combat text in `ui`.

`DEATH_RESOLVE`
- Death animation in `unit` with optional residue in `decal`.

`INTENT_END`
- Clear transient telegraphs.

## Determinism Rules
1. No `Math.random()` in runtime layer placement logic.
2. Interaction results must wait for movement arrival visuals.
3. Stale traces or mismatched-destination traces must be ignored.
4. Replay and live modes must consume identical layer semantics.

## Validation Checklist
1. Unit never snaps to post-turn destination before `MOVE_START` playback.
2. Shrine/stairs interactions trigger only after visual arrival.
3. Kinetic chain displacements preserve ordered actor sequence.
4. No hidden animation path mutates actor transforms outside orchestrator flow.
