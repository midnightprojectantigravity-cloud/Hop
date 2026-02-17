# Biome Color System (MTG 5-Color)

## Goal
Keep biome switching trivial and deterministic while matching the 5-color MTG fantasy axis:
- White
- Blue
- Black
- Red
- Green

Renderer model remains hybrid:
- Raster/WebP for world look (underlays + clutter/hazards).
- SVG for interaction grid and status overlays.

For the full runtime layer strategy, surface hooks, and bestiary/trinity linkage, see:
- `docs/BIOME_BESTIARY_TRINITY_CONTRACT.md`

## Runtime Control
Biome selection is centralized in:
- `apps/web/src/visual/biome-config.ts`

Key knobs:
- `BIOME_VISUALS`: biome -> floor/hazard tile IDs.
- `THEME_TO_BIOME`: engine theme -> biome color mapping.

Optional visual override (debug):
- In browser console: `window.__HOP_FORCE_BIOME = 'blue'`
- Valid values: `white`, `blue`, `black`, `red`, `green`.
- Clear override: `delete window.__HOP_FORCE_BIOME`

## Current Mapping
Engine themes to color biomes:
- `catacombs` -> `white`
- `frozen` -> `blue`
- `void` -> `black`
- `inferno` -> `red`
- `throne` -> `green`

Color biome to tile assets:
- `white` -> `tile.catacombs.floor.01`
- `blue` -> `tile.frozen.floor.01`
- `black` -> `tile.void.floor.01`
- `red` -> `tile.inferno.floor.01`
- `green` -> `tile.throne.floor.01`

Hazard mapping:
- `red` -> `tile.inferno.lava.01`
- others -> `tile.catacombs.lava.01` (placeholder until biome-specific hazard art ships)

## Biome Design Direction
### White (Plains / Mesa)
- Palette: pale gold, bone, soft amber.
- Suggested hazard visuals: quicksand, holy ground.
- Suggested clutter: monoliths, standing stones, weathered ruins.

### Blue (Islands / Coast)
- Palette: cerulean, teal, cyan.
- Suggested hazard visuals: submerged reef, fog bank.
- Suggested clutter: shipwrecks, shells, kelp, crystalline spires.

### Black (Swamp / Wastes)
- Palette: deep purple, charcoal, oily green.
- Suggested hazard visuals: toxic miasma, sinkhole.
- Suggested clutter: bones, brambles, ooze vents, tombstones.

### Red (Mountains / Volcanic)
- Palette: crimson, burnt orange, slate.
- Suggested hazard visuals: lava pools, lightning rods.
- Suggested clutter: obsidian shards, magma vents, slag, jagged peaks.

### Green (Forest / Jungle)
- Palette: emerald, moss, deep wood brown.
- Suggested hazard visuals: vines, spores.
- Suggested clutter: roots, stumps, logs, overgrown idols.

## Engine-Logic Hooks (Target)
- Mountain clutter: `is_blocker: true`, `blocks_los: true`
- Spike hazards: `is_passable: false`, `on_collision: damage`
- Trees: `provides_cover: 0.5`, `is_blocker: true`
- Walls/ruins: `is_blocker: true`, `is_destructible: true`

Note: `fire` remains a status/VFX concern (SVG overlay), not a biome ground tile.
