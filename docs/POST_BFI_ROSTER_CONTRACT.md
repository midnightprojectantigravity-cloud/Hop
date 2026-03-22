# Post-BFI Roster Contract

## Purpose
This document is the grounded roster authority for the first post-BFI rebalance pass.

It defines:
1. Enemy combat roles.
2. Companion target roles.
3. Bomb treatment as an ephemeral hazard actor.
4. The intended trinity and BFI posture for each authored subtype.

## Enemy Roles
| Role | Meaning | Trinity Posture | BFI Intent |
| --- | --- | --- | --- |
| `bruiser` | Frontline attrition body | Body primary, Instinct secondary | Base 9, heavier effective burden |
| `skirmisher` | Fast melee pressure | Instinct primary, Body secondary | Base 9, light effective burden |
| `shooter` | Ranged precision pressure | Instinct primary, Mind secondary | Base 9, light burden |
| `caster` | Mind-led ranged pressure | Mind primary, Instinct secondary | Base 9, no burden |
| `controller` | Threat that forces routing or commitment | Instinct/Mind mixed | Base 9, light burden |
| `hazard_setter` | Zone denial and delayed pressure | Instinct/Mind mixed, low Body | Base 9, no burden |
| `boss_anchor` | Heavy encounter centerpiece | Body primary, Mind secondary | Base 8, heavy burden |

## Companion Roles
| Subtype | Role | Intent |
| --- | --- | --- |
| `falcon` | `utility_predator` | Tempo-efficient scout/predator with capped sustained damage |
| `skeleton` | `attrition_body` | Disposable occupancy and chip-pressure summon |

## Ephemeral Hazard Actors
| Subtype | Class | Intent |
| --- | --- | --- |
| `bomb` | `ephemeral_hazard_actor` | Deterministic timed blast object, not a full roster unit |

## Authored Roster Sheet
| Subtype | Role | Trinity (B/M/I) | Burden | Target BFI | Notes |
| --- | --- | --- | --- | --- | --- |
| `footman` | `bruiser` | `12 / 3 / 6` | `Medium` | `9 -> 11` | Baseline frontline body |
| `sprinter` | `skirmisher` | `6 / 3 / 14` | `Light` | `9 -> 10` | Pure tempo melee |
| `raider` | `skirmisher` | `8 / 4 / 13` | `Light` | `9 -> 10` | Dash-enabled flanker |
| `pouncer` | `controller` | `7 / 5 / 15` | `Light` | `9 -> 10` | Grapple-driven diver |
| `shieldBearer` | `bruiser` | `16 / 4 / 5` | `Heavy` | `9 -> 12` | Deliberate frontline anchor |
| `archer` | `shooter` | `6 / 5 / 14` | `Light` | `9 -> 10` | Ranged precision pressure |
| `bomber` | `hazard_setter` | `4 / 6 / 10` | `None` | `9 -> 9` | Threat carried by bombs, not chassis |
| `warlock` | `caster` | `4 / 14 / 8` | `None` | `9 -> 9` | Mind-led ranged pressure |
| `sentinel` | `boss_anchor` | `18 / 14 / 10` | `Heavy` | `8 -> 11` | Boss centerpiece with artillery support role |
| `falcon` | `utility_predator` | `4 / 6 / 18` | `None` | `8 -> 8` | Companion-only evaluation lane |
| `skeleton` | `attrition_body` | `12 / 2 / 4` | `Medium` | `10 -> 12` | Summon swarm body, low autonomy |
| `bomb` | `ephemeral_hazard_actor` | `0 / 0 / 0` | `None` | `14 -> 12` clamp | Evaluated as delayed hazard payload only |

## Composition Rules
First-pass encounter composition is floor-profile-driven, not worldgen-pressure-driven.

Rules:
1. Every non-empty floor profile must define a frontline minimum.
2. Hazard setters are capped at one per encounter in this pass.
3. Boss-anchor encounters are capped at one boss anchor.
4. Recovery floors limit ranged and hazard density.
5. Pressure-spike and elite floors may increase flanker density, but still keep hazard and ranged stacks bounded.
