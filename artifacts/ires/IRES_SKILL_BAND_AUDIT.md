# IRES Skill Band Audit

## Coverage Summary

- mapped known skills: 49
- expanded non-active mappings: 22
- mapped active-roster skills: 27
- known legacy fallback skills: 0
- accepted medium-risk migrations: 2
- outstanding high-risk deltas: 3

## Active-Roster Skills By Band

### heavy

| Skill | Scope | Resource | Cost | Strain | Travel Eligible | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| BOMB_TOSS | enemy_runtime | spark | 30 | 18 | no | low |
| CORPSE_EXPLOSION | player_default | mana | 11 | 18 | no | low |
| FIREWALL | player_default | mana | 11 | 18 | no | low |
| GRAPPLE_HOOK | shared_active | spark | 30 | 20 | no | medium (accepted) |
| KINETIC_TRI_TRAP | player_default | spark | 30 | 18 | no | low |
| RAISE_DEAD | player_default | mana | 11 | 17 | no | low |
| SHADOW_STEP | player_default | mana | 10 | 17 | no | low |
| SMOKE_SCREEN | player_default | spark | 28 | 16 | no | low |
| SNEAK_ATTACK | player_default | spark | 30 | 15 | no | low |
| SOUL_SWAP | player_default | mana | 10 | 17 | no | low |
| VAULT | player_default | spark | 30 | 18 | no | low |
| WITHDRAWAL | player_default | spark | 30 | 18 | no | low |

### light

| Skill | Scope | Resource | Cost | Strain | Travel Eligible | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| ABSORB_FIRE | player_default | mana | 5 | 6 | no | low |
| DASH | shared_active | spark | 18 | 8 | yes | low |
| FIREWALK | player_default | mana | 5 | 5 | no | low |
| JUMP | player_default | spark | 16 | 8 | yes | low |
| SENTINEL_TELEGRAPH | enemy_runtime | mana | 4 | 2 | no | low |

### maintenance

| Skill | Scope | Resource | Cost | Strain | Travel Eligible | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| BASIC_MOVE | shared_active | spark | 10 | 0 | yes | medium (accepted) |

### redline

| Skill | Scope | Resource | Cost | Strain | Travel Eligible | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| SENTINEL_BLAST | enemy_runtime | mana | 10 | 34 | no | high |

### standard

| Skill | Scope | Resource | Cost | Strain | Travel Eligible | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| ARCHER_SHOT | enemy_runtime | spark | 26 | 11 | no | low |
| AUTO_ATTACK | shared_active | spark | 26 | 11 | no | low |
| BASIC_ATTACK | shared_active | spark | 26 | 11 | no | low |
| FALCON_COMMAND | player_default | mana | 6 | 9 | no | low |
| FIREBALL | shared_active | mana | 7 | 10 | no | low |
| SHIELD_BASH | shared_active | spark | 26 | 11 | no | low |
| SHIELD_THROW | player_default | spark | 26 | 11 | no | low |
| SPEAR_THROW | player_default | spark | 26 | 11 | no | low |

## Action-Bearing Off-Roster Skills

| Skill | Band | Resource | Cost | Strain | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| BULWARK_CHARGE | heavy | spark | 30 | 15 | low | Band-derived from heavy. |
| MULTI_SHOOT | standard | spark | 30 | 10 | low | Band-derived from standard. |
| SET_TRAP | heavy | spark | 30 | 15 | low | Band-derived from heavy. |
| SWIFT_ROLL | light | spark | 20 | 10 | low | Band-derived from light. |

## Inert Passive And Capability Skills

| Skill | Scope | Resource | Cost | Strain | Legacy Power | Derived Power | Delta Power |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BASIC_AWARENESS | loadout_capability | none | 0 | 0 | 2.9 | 2.9 | 0 |
| BLIND_FIGHTING | system_passive | none | 0 | 0 | 5.68 | 5.68 | 0 |
| BURROW | loadout_capability | none | 0 | 0 | 1.3 | 3.5 | 2.2 |
| COMBAT_ANALYSIS | loadout_capability | none | 0 | 0 | 2.42 | 3.22 | 0.8 |
| ENEMY_AWARENESS | system_passive | none | 0 | 0 | 3.22 | 3.22 | 0 |
| FLIGHT | loadout_capability | none | 0 | 0 | 1.3 | 3.5 | 2.2 |
| ORACLE_SIGHT | system_passive | none | 0 | 0 | 3.86 | 3.86 | 0 |
| PHASE_STEP | loadout_capability | none | 0 | 0 | 2.7 | 3.5 | 0.8 |
| STANDARD_VISION | loadout_capability | none | 0 | 0 | 3.7 | 3.7 | 0 |
| TACTICAL_INSIGHT | loadout_capability | none | 0 | 0 | 3.54 | 3.54 | 0 |
| THEME_HAZARDS | system_passive | none | 0 | 0 | 7.29 | 7.29 | 0 |
| VIBRATION_SENSE | system_passive | none | 0 | 0 | 4.5 | 4.5 | 0 |

## Companion Skill Table

| Skill | Band | Resource | Cost | Strain | Movement | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FALCON_APEX_STRIKE | heavy | spark | 30 | 10 | no | yes | Band-derived from heavy. |
| FALCON_AUTO_ROOST | maintenance | none | 0 | 0 | no | no | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. Consumes the falcon turn internally but remains zero-cost and strain-free. |
| FALCON_HEAL | light | mana | 5 | 5 | no | yes | Band-derived from light. |
| FALCON_PECK | standard | spark | 30 | 10 | no | yes | Band-derived from standard. |
| FALCON_SCOUT | light | mana | 5 | 5 | yes | no | Band-derived from light. Metabolically corrected to movement semantics to match scouting displacement. Movement/action semantics changed relative to the legacy bucket. Special movement stays out of travel relief. |

## Spawned And System Runtime Skills

| Skill | Scope | Resource | Cost | Strain | Notes |
| --- | --- | --- | --- | --- | --- |
| TIME_BOMB | spawned_runtime | none | 0 | 0 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. Fuse resolution may consume the bomb turn but remains metabolically free. |

## Intentional Medium-Risk Migrations

| Skill | Band | Legacy Cost | Derived Cost | Legacy Strain | Derived Strain | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| BASIC_MOVE | maintenance | 20 | 10 | 10 | 0 | Band-derived from maintenance. Ordinary locomotion is intentionally anchored to the maintenance band instead of the legacy move bucket. Accepted medium-risk migration for this phase. |
| GRAPPLE_HOOK | heavy | 20 | 30 | 10 | 20 | Band-derived from heavy. Movement/action semantics changed relative to the legacy bucket. Hybrid movement plus action semantics are intentional and retained even though the legacy bucket treated it as pure movement. Accepted medium-risk migration for this phase. |

## Outstanding High-Risk Deltas

| Skill | Scope | Band | Legacy Cost | Derived Cost | Legacy Strain | Derived Strain | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BURROW | loadout_capability | maintenance | 20 | 0 | 10 | 0 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. Passive movement capability only; modifies BASIC_MOVE pathing without becoming an active movement cost. Movement/action semantics changed relative to the legacy bucket. Tune via offsets before reconsidering the underlying band. |
| FLIGHT | loadout_capability | maintenance | 20 | 0 | 10 | 0 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. Passive movement capability only; modifies BASIC_MOVE pathing without becoming an active movement cost. Movement/action semantics changed relative to the legacy bucket. Tune via offsets before reconsidering the underlying band. |
| SENTINEL_BLAST | enemy_runtime | redline | 10 | 10 | 15 | 34 | Band-derived from redline. Boss spike remains intentionally above heavy-band pressure while staying castable inside the sentinel's current runtime mana pool. Tune via offsets before reconsidering the underlying band. |

## Power-Score Delta Watchlist

| Skill | Scope | Legacy Power | Derived Power | Delta Power | Notes |
| --- | --- | --- | --- | --- | --- |
| BURROW | loadout_capability | 1.3 | 3.5 | 2.2 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. Passive movement capability only; modifies BASIC_MOVE pathing without becoming an active movement cost. Movement/action semantics changed relative to the legacy bucket. Tune via offsets before reconsidering the underlying band. |
| FLIGHT | loadout_capability | 1.3 | 3.5 | 2.2 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. Passive movement capability only; modifies BASIC_MOVE pathing without becoming an active movement cost. Movement/action semantics changed relative to the legacy bucket. Tune via offsets before reconsidering the underlying band. |
| COMBAT_ANALYSIS | loadout_capability | 2.42 | 3.22 | 0.8 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. Movement/action semantics changed relative to the legacy bucket. |
| PHASE_STEP | loadout_capability | 2.7 | 3.5 | 0.8 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. Passive movement capability only; modifies BASIC_MOVE pathing without becoming an active movement cost. Movement/action semantics changed relative to the legacy bucket. |
| BASIC_AWARENESS | loadout_capability | 2.9 | 2.9 | 0 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. |
| BLIND_FIGHTING | system_passive | 5.68 | 5.68 | 0 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. |
| BULWARK_CHARGE | off_roster_action | 4.59 | 4.59 | 0 | Band-derived from heavy. |
| ENEMY_AWARENESS | system_passive | 3.22 | 3.22 | 0 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. |
| FALCON_APEX_STRIKE | companion_runtime | 3.07 | 3.07 | 0 | Band-derived from heavy. |
| FALCON_AUTO_ROOST | companion_runtime | 3.28 | 3.28 | 0 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. Consumes the falcon turn internally but remains zero-cost and strain-free. |
| FALCON_HEAL | companion_runtime | 4.44 | 4.44 | 0 | Band-derived from light. |
| FALCON_PECK | companion_runtime | 0 | 0 | 0 | Band-derived from standard. |
| FALCON_SCOUT | companion_runtime | 5.3 | 5.3 | 0 | Band-derived from light. Metabolically corrected to movement semantics to match scouting displacement. Movement/action semantics changed relative to the legacy bucket. Special movement stays out of travel relief. |
| MULTI_SHOOT | off_roster_action | 2.47 | 2.47 | 0 | Band-derived from standard. |
| ORACLE_SIGHT | system_passive | 3.86 | 3.86 | 0 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. |
| SET_TRAP | off_roster_action | 0.92 | 0.92 | 0 | Band-derived from heavy. |
| STANDARD_VISION | loadout_capability | 3.7 | 3.7 | 0 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. |
| SWIFT_ROLL | off_roster_action | 0 | 0 | 0 | Band-derived from light. |
| TACTICAL_INSIGHT | loadout_capability | 3.54 | 3.54 | 0 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. |
| THEME_HAZARDS | system_passive | 7.29 | 7.29 | 0 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. |
| TIME_BOMB | spawned_runtime | 5.94 | 5.94 | 0 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. Fuse resolution may consume the bomb turn but remains metabolically free. |
| VIBRATION_SENSE | system_passive | 4.5 | 4.5 | 0 | Band-derived from maintenance. Metabolically inert in runtime: no spark, mana, or BFI tax. |

## Player Loadout Coverage

- player default roster skills: 23
- mapped in active roster: 23
- skills: ABSORB_FIRE, AUTO_ATTACK, BASIC_ATTACK, BASIC_MOVE, CORPSE_EXPLOSION, DASH, FALCON_COMMAND, FIREBALL, FIREWALK, FIREWALL, GRAPPLE_HOOK, JUMP, KINETIC_TRI_TRAP, RAISE_DEAD, SHADOW_STEP, SHIELD_BASH, SHIELD_THROW, SMOKE_SCREEN, SNEAK_ATTACK, SOUL_SWAP, SPEAR_THROW, VAULT, WITHDRAWAL

## Enemy Runtime Coverage

- enemy runtime skills: 11
- mapped in active roster: 11
- skills: ARCHER_SHOT, AUTO_ATTACK, BASIC_ATTACK, BASIC_MOVE, BOMB_TOSS, DASH, FIREBALL, GRAPPLE_HOOK, SENTINEL_BLAST, SENTINEL_TELEGRAPH, SHIELD_BASH

## Recommended Tuning Queue

1. BASIC_MOVE
2. DASH
3. JUMP
4. GRAPPLE_HOOK
5. VAULT
6. WITHDRAWAL
7. FIREWALK
8. SHADOW_STEP
9. SOUL_SWAP
10. BASIC_ATTACK
11. AUTO_ATTACK
12. ARCHER_SHOT
13. SPEAR_THROW
14. SHIELD_BASH
15. SHIELD_THROW
16. ABSORB_FIRE
17. FALCON_COMMAND
18. KINETIC_TRI_TRAP
19. SMOKE_SCREEN
20. BOMB_TOSS
21. SENTINEL_TELEGRAPH
22. FIREBALL
23. FIREWALL
24. CORPSE_EXPLOSION
25. RAISE_DEAD
26. SNEAK_ATTACK
27. SENTINEL_BLAST
28. BULWARK_CHARGE
29. SWIFT_ROLL
30. MULTI_SHOOT
31. SET_TRAP
32. FALCON_PECK
33. FALCON_APEX_STRIKE
34. FALCON_HEAL
35. FALCON_SCOUT

