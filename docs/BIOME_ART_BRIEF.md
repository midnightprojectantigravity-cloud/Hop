# Biome Art Brief

## Purpose
Provide production-ready art direction and handoff requirements for full biome visual sets in Hop's hybrid renderer.

Runtime architecture and formula contracts are documented in:
- `docs/BIOME_BESTIARY_TRINITY_CONTRACT.md`
- `docs/VISUAL_LAYER_CONTRACT.md`

This project uses a hybrid visual model:
- Biome look/texture: raster (`webp`) underlays and decals.
- Gameplay grid and targeting: code-driven SVG interaction layer.
- Fire visuals: SVG status/FX overlays (not biome terrain art).

## Hard Constraints
- No wall art for this biome set.
- Fire is not a terrain tile; treat it as status VFX (SVG overlay).
- Do not draw hex outlines or grid indicators into biome art.
- Maintain gameplay readability over all surfaces.

## Visual Direction
- Top-down or near-orthographic feel.
- Painterly-gritty, weathered surfaces matching unit illustration quality.
- Material richness over hard geometric forms.
- Controlled contrast: background should support units, not compete with them.

## Deliverables Per Biome
1. Floor underlays (seamless, rectangular textures)
Required files: `biome.<theme>.floor.01.webp`, `biome.<theme>.floor.02.webp`, `biome.<theme>.floor.03.webp`.

2. Terrain hazards (only terrain hazards, not status effects)
Required file (example): `biome.<theme>.hazard.lava.01.webp`. Optional variants: `.02`, `.03`.

3. Clutter sprites (transparent WebP)
Target subjects: debris, cracked slabs, rubble, bones, roots, dead vegetation, ruins. Do not produce wall chunks/blockers.
File pattern: `biome.<theme>.clutter.<assetName>.01.webp` (+ optional `.02`, `.03`).

4. Transition decals (transparent WebP)
Target use: soft blending masks/overlays for material transitions.
File pattern: `biome.<theme>.transition.<assetName>.01.webp` (+ optional `.02`, `.03`).

## Source + Export Specs
- Authoring source: layered file per asset (`.psd`, `.kra`, or equivalent).
- Underlay master resolution: `2048x2048`.
- Export resolutions: `1024x1024` and `512x512`.
- Runtime format: `webp`.
- Transparency required for clutter and transition decals.

## Lighting + Value Rules
- Prefer ambient/soft directional lighting; avoid extreme one-sided light baked across all assets.
- Avoid heavy bloom and over-saturated highlights.
- Ensure character silhouettes remain readable on plain floor, hazard floor (e.g. lava), and clutter-dense tiles.

## Naming Matrix
1. Floor: `biome.<theme>.floor.01.webp`, `biome.<theme>.floor.02.webp`, `biome.<theme>.floor.03.webp`
2. Terrain hazard: `biome.<theme>.hazard.lava.01.webp` (+ optional `.02`, `.03`)
3. Clutter: `biome.<theme>.clutter.<assetName>.01.webp` (+ optional `.02`, `.03`)
4. Transition: `biome.<theme>.transition.<assetName>.01.webp` (+ optional `.02`, `.03`)

## Explicit Non-Goals
- No wall tile sets.
- No fire terrain assets.
- No baked UI symbols, text, or target indicators.
- No visible tile seams when repeated.

## Fire (Status Effect) Direction
Fire belongs in FX/UI rendering:
- Format: `svg`
- Usage: status overlays and event effects.
- Keep shapes readable at gameplay zoom.
- Prefer simple animated-capable silhouettes and clean alpha edges.

## QA Checklist (Pass/Fail)
1. Seamless test passes: floor tiles repeated in an 8x8 preview show no visible seams.
2. Readability test passes: player/enemy sprites remain clear on floor, lava, and clutter scenes.
3. Noise budget passes: board does not become visually noisy at gameplay zoom.
4. No prohibited content: no walls, no fire terrain, no hex outlines.
5. Naming is correct and consistent with the naming matrix.
6. Layered source files are delivered with exports.

## Handoff Package
1. `/source/<theme>/...` layered files.
2. `/exports/<theme>/...` runtime WebP assets.
3. One contact sheet per theme including floor variants, hazard variants, clutter thumbnails, and transition decals.
