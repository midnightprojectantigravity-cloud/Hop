# Visual System Plan (World-Class Baseline)

## Goals
- Establish a single source of truth for visual assets and layering.
- Make visuals deterministic across live play, replay, and headless-to-web traces.
- Keep runtime performance stable while enabling high-fidelity tactical presentation.

## Principles
- Data-driven: visuals come from manifest data, not hardcoded filenames.
- Layered composition: board, decals, units, effects, and UI are separate streams.
- Deterministic sequencing: visual playback order is tied to timeline/trace data.
- Production-safe: naming, metadata, and file structure are CI-validated.

## Canonical Technical Standards
- Grid topology: `flat-top-hex`.
- Canonical tile width: `256px` x `222px`.
- Canonical tile ratio: `1.154700538` (regular flat-top hex width/height).
- Environment/system default format: `svg` (`tile`, `decal`, `prop`, `ui`).
- Unit default format: `webp` (preferred), with `avif`/`png` allowed.
- FX default format: `svg`, with raster (`webp`/`avif`/`png`) for high-detail effects.
- Transparent bleed: `5-10%` around rendered tile/token art.

## Asset Structure
- `apps/web/public/assets/tiles`
- `apps/web/public/assets/units`
- `apps/web/public/assets/fx`
- `apps/web/public/assets/ui`
- `apps/web/public/assets/decals`
- `apps/web/public/assets/props`

Naming convention:
- `{domain}.{theme}.{name}.{variant}`
- Example: `tile.catacombs.floor.01.webp`
- Lowercase only; separators: `.`, `_`, `-`.

## Manifest Contract
- File: `apps/web/public/assets/manifest.json`
- Schema: `apps/web/public/assets/manifest.schema.json`
- Loaded at runtime by `apps/web/src/visual/asset-manifest.ts`

Manifest responsibilities:
- Define canonical render layers and ordering.
- Declare each asset with path, dimensions, anchor, type, layer, and `recommendedFormat`.
- Carry theme and tag metadata for selection/filtering.

## Layer Contract
See `docs/VISUAL_LAYER_CONTRACT.md`.
See `docs/HERO_ART_DIRECTION.md` for hero/unit readability and art standards.

Core z-order (low to high):
1. `ground`
2. `decal`
3. `prop`
4. `unit`
5. `fx`
6. `ui`

## Delivery Phases
1. Foundation
- Freeze manifest/schema.
- Add validator in CI.
- Use manifest loader in web app bootstrap.

2. MVP Art Pass
- Ship one complete biome set.
- Ship core archetype tokens and essential interaction effects.
- Validate live/replay parity on movement and timeline-critical effects.

3. Production Expansion
- Add biome variants and archetype skin sets.
- Add effect variants for damage/control/objective interactions.
- Add screenshot regression checks for critical scenarios.

## Quality Gates
- Build/test gate: manifest validation must pass.
- Runtime gate: no missing manifest references at load.
- Performance gate: maintain 60fps target under normal enemy density.
- Sequencing gate: interactions resolve only after movement playback completion.
