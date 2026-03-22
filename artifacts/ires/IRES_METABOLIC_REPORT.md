# IRES Metabolic Report

The turn window is the beat.
Spells are Mana-only plus BFI tax by default.
Movement is Spark plus BFI.
Passive recovery and passive exhaustion bleed happen every beat. WAIT adds extra reset on top.

## Band Catalog

| Band | Spark | Mana | Base EX | Intended Use |
| --- | ---: | ---: | ---: | --- |
| maintenance | 10 | 4 | 0 | sustainable |
| light | 16 | 5 | 6 | repeatable |
| standard | 24 | 8 | 12 | committed |
| heavy | 32 | 12 | 20 | burst |
| redline | 44 | 18 | 32 | crisis |

## Beat Anchors

- `BASIC_MOVE x1 = walking`
- `BASIC_MOVE x2 = running`
- `BASIC_MOVE x3 = sprint / overdrive`

## Recovery Model

- passive Spark recovery base: 21
- passive Mana recovery base: 3
- passive base Exhaustion bleed: 15
- WAIT Spark bonus: 30
- WAIT Exhaustion bonus: 40

## Target Outcomes

| Target | Passed | Score | Details |
| --- | --- | ---: | --- |
| standard_human_standard_move_attack_loop | yes | 1.000 | avg=1.2 rest=3 failure=exhaustion |
| bruiser_frontline_heavy_standard_move_attack_loop | yes | 1.050 | avg=1.2 rest=2 moveSpark=75 |
| skirmisher_light_ranged_attack_spacing_loop | yes | 0.200 | avg=0.8 rest=3 failure=exhaustion |
| caster_mind_caster_signature_loop | yes | 0.500 | rest=3 manaSpent=32 failure=exhaustion |
| bomber_setup_loop_native_reserve | yes | 0.000 | avg=1.2 rest=3 failure=exhaustion |
| companion_falcon_support_loop | yes | 1.600 | avg=1.2 rest=2 failure=exhaustion |
| companion_skeleton_attrition_loop | yes | 1.300 | avg=0.4 rest=1 failure=exhaustion |
| standard_human_movement_gradient | yes | 0.000 | walkRest=12 runRest=2 sprintBurn=1 |
| travel_move_relief | yes | 0.000 | travel=1 battle=1 |

## Walking / Running / Sprinting

| Scenario | Avg Events / Beat (5) | First Rest | Peak EX (5) | First Burn |
| --- | ---: | ---: | ---: | ---: |
| Standard Human Standard / BASIC_MOVE x1 | 1.000 | 12 | 30.000 | - |
| Standard Human Standard / BASIC_MOVE x2 | 1.200 | 2 | 51.000 | - |
| Standard Human Standard / BASIC_MOVE x3 | 1.800 | 2 | 92.000 | 1 |

## Body Vs Instinct

| Scenario | Avg Events / Beat (5) | First Rest | Peak EX (5) | First Burn |
| --- | ---: | ---: | ---: | ---: |
| Bruiser Frontline Standard / BASIC_MOVE x2 | 0.800 | 2 | 84.000 | 1 |
| Skirmisher Light Standard / BASIC_MOVE x2 | 0.800 | 2 | 72.000 | 1 |

## Mind Vs Instinct

| Scenario | Avg Events / Beat (5) | First Rest | Peak EX (5) | First Burn |
| --- | ---: | ---: | ---: | ---: |
| Caster Mind Standard / Caster Signature Loop | 1.200 | 3 | 92.000 | 5 |
| Skirmisher Light Standard / Ranged Attack Spacing Loop | 0.400 | 1 | 10.000 | - |

## Heavy Mind Move+Cast

- first failure mode: exhaustion
- movement share of Spark spend: 1.000
- opening 5 avg events per beat: 1.200

## Light Vs Standard Vs Heavy

| Scenario | Avg Events / Beat (5) | First Rest | Peak EX (5) | First Burn |
| --- | ---: | ---: | ---: | ---: |
| Standard Human Light / Standard Move + Attack | 1.200 | 3 | 92.000 | 4 |
| Standard Human Standard / Standard Move + Attack | 1.200 | 3 | 92.000 | 4 |
| Standard Human Heavy / Standard Move + Attack | 1.200 | 3 | 92.000 | 4 |

## Travel Vs Battle Movement

| Scenario | Avg Events / Beat (5) | First Rest | Peak EX (5) | First Burn |
| --- | ---: | ---: | ---: | ---: |
| Standard Human Standard / Move Only Battle | 1.000 | 12 | 30.000 | - |
| Standard Human Standard / Move Only Travel | 1.000 | - | 0.000 | - |

## Sensitivity

| Lever | Avg Events / Beat Delta | First Rest Delta | Peak EX Delta | Profiles |
| --- | ---: | ---: | ---: | --- |
| Walking Vs Running | 0.200 | -10.000 | 21.000 | standard_human_standard |
| Running Vs Sprinting | 0.600 | 0.000 | 41.000 | standard_human_standard |
| Body Vs Instinct Compression | 0.000 | 0.000 | -12.000 | bruiser_frontline_standard, skirmisher_light_standard |
| Weight Move+Attack Gradient | 0.000 | 0.000 | 0.000 | standard_human_light, standard_human_heavy |

## Recommended Next Candidate Changes


