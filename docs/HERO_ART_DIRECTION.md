# Hero Art Direction Guide

## Purpose
Define hard visual rules for hero/unit art so gameplay readability stays high at tactical board scale.

## Canonical Hero Readability Rules
- Facing direction: hero must face East/right in idle-combat stance.
- Face visibility: at least one eye must be visible.
- Weapon visibility: primary weapon must be visible and clearly identifiable by silhouette.
- Color identity: each archetype must have a dominant, repeatable color family.
- Role clarity: silhouette must communicate class role (tank, ranged, caster, assassin) in under 1 second.

These are not suggestions. Assets that violate these rules should not ship.

## Camera and Pose Standards
- Camera angle: 3/4 view (not pure side profile, not full front, not back-facing).
- Pose: combat-ready idle with clear line of action.
- Limb readability: no major limb fully merging into torso silhouette at rest.
- Head direction: head and chest should generally track toward East/right.

## Face and Head Rules
- At least one eye must be readable at normal gameplay zoom.
- Hoods/helmets are allowed only if one eye or one clear face plane is still visible.
- Avoid full face occlusion by weapon, cloak, or VFX.

## Weapon Readability Rules
- Weapon must extend beyond torso silhouette.
- Weapon type must be identifiable without tooltip.
- Sword/axe/spear/bow/staff/dagger should each read as distinct shapes.
- Avoid glow-only weapons where the base shape is unclear.
- If dual wielding, one weapon can be secondary, but primary hand must still be obvious.

## Archetype Color Identity
- Each hero/archetype needs one dominant accent hue and one secondary support hue.
- Dominant accent should appear in at least 2-3 separated regions (not one tiny detail).
- Palette should be stable across skins so class recognition remains fast.
- Avoid near-monochrome units that blend into environment tiles.

Recommended defaults:
- Vanguard/frontliner: warm red/crimson accents.
- Skirmisher/ranger: teal/green accents.
- Firemage/caster: amber/orange accents.

## Value and Contrast
- Silhouette edge contrast must remain readable against both light and dark tiles.
- Do not rely only on internal detail lines; external silhouette must carry identification.
- Keep local contrast near face and weapon higher than cloak/background cloth regions.

## Canvas, Scale, and Anchor
- Authoring source for heroes: `512x512` minimum.
- Transparent background required.
- Feet/contact point must be consistent with manifest anchor.
- Canonical unit anchor target: `x=0.5`, `y=0.78` unless intentionally different.

## Export and Format Policy
- Hero/unit assets: `webp` preferred. `avif`/`png` acceptable.
- Environment/system layers remain `svg` by policy.
- Do not flatten into sprite sheets for runtime unless explicitly needed for perf.

## Forbidden Patterns
- Full back-facing hero.
- Face fully hidden with no visible eye.
- Weapon fully occluded or ambiguous.
- Pure grayscale hero with no class accent color.
- Overgrown VFX that obscures base silhouette in idle pose.

## Acceptance Checklist (Pass/Fail)
- Faces East/right.
- One eye visible.
- Weapon class is obvious at gameplay scale.
- Dominant archetype color is visible and consistent.
- Silhouette stays readable on at least 3 different tile backgrounds.
- Contact point aligns correctly with unit anchor.

## Review Workflow
- Required deliverables: full-resolution source file, exported runtime asset, and screenshot at gameplay zoom over floor, lava, and wall-adjacent backgrounds.
- Review by design + implementation before manifest promotion.
