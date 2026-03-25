# Synapse v1 Wrap-Up (2026-03-03)

## What shipped
- Synapse now uses a deterministic **Unified Power Score (UPS)** for every actor and scales it as an integer (`UPS * 100`).
- Relative threat uses `zScore = (enemyUPS - playerUPS) / sigmaRef` with `sigmaRef = max(stddev, 600)`.
- Heatmap source contribution is discrete per hostile source:
  - `below` tier: excluded (`z < 0`)
  - `elevated` tier: `+1 threat unit`
  - `high` / `extreme` tier: `+2 threat units`
  - dead-zone attenuation still applies for emitter weight visibility (`z < 0.25 => 0`) while heat units remain tier-based.

## Heatmap bands (final)
- `safe` (white): `H_t = 0`
- `contested_low` (orange): `0 < H_t < 2`
- `contested_high` (red): `2 <= H_t < 5`
- `deadly` (black): `H_t >= 5`

This matches the requested behavior:
- absolute safe only at zero threats,
- low danger starts at one low threat,
- deadly can be reached by stacked low threats or a single high-pressure overlap path.

## Targeting correctness updates
- Synapse threat coverage is now skill-shape driven (not just radius).
- Archer threat projection respects:
  - minimum range (`2-4`, so range `1` is safe),
  - axial-only targeting,
  - line-of-sight blocking.
- Sprinter-style melee danger no longer includes movement inflation; effective damage reach is attack reach.

## Overlay occupancy rule
- Occupied tiles are excluded from the Synapse tile overlay payload.
- This includes player, enemies, and companions, so occupied cells are shown as non-overlay space (neither safe nor dangerous color bands).

## UX additions kept
- UPS chips are shown in Synapse mode.
- UPS delta chip behavior is integer-based with thresholded direction markers.
- Source-row tap bridge (pulse + tray switch) remains active.

## Validation done
- Engine: Synapse threat preview test suite updated and passing.
- Engine: archer scenario coverage extended (adjacent target rejection) and passing.
- Web: Synapse helper/tray/unit score layer tests passing.
- Type-check: `apps/web` and `packages/engine` both pass `tsc --noEmit`.
