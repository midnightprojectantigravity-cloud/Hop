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

- passive Spark recovery base: 20
- passive Mana recovery base: 2
- passive base Exhaustion bleed: 15
- WAIT Spark bonus: 30
- WAIT Exhaustion bonus: 40

## Target Outcomes

| Target | Passed | Score | Details |
| --- | --- | ---: | --- |
| balanced_mid_standard_basic_move_x1 | yes | 0.000 | avg=1 rest=12 |
| balanced_mid_standard_basic_move_x2 | yes | 0.650 | avg=1.2 rest=2 |
| balanced_mid_standard_basic_move_x3 | yes | 0.000 | burn=1 avg=1.8 |
| balanced_mid_standard_basic_move_then_standard_attack | yes | 0.500 | avg=1.2 rest=3 |
| mind_mid_heavy_battleline | yes | 0.000 | failure=exhaustion moveShare=1 |
| instinct_mid_light_move_burst | yes | 1.000 | interval=3 avg=1.2 |
| travel_move_relief | yes | 0.000 | travel=1 battle=1 |

## Walking / Running / Sprinting

| Scenario | Avg Events / Beat (5) | First Rest | Peak EX (5) | First Burn |
| --- | ---: | ---: | ---: | ---: |
| Balanced Mid Standard / BASIC_MOVE x1 | 1.000 | 12 | 30.000 | - |
| Balanced Mid Standard / BASIC_MOVE x2 | 1.200 | 2 | 51.000 | - |
| Balanced Mid Standard / BASIC_MOVE x3 | 1.800 | 2 | 92.000 | 1 |

## Body Vs Instinct

| Scenario | Avg Events / Beat (5) | First Rest | Peak EX (5) | First Burn |
| --- | ---: | ---: | ---: | ---: |
| Body Mid Standard / BASIC_MOVE x2 | 1.200 | 2 | 51.000 | - |
| Instinct Mid Standard / BASIC_MOVE x2 | 1.200 | 3 | 77.000 | 2 |

## Mind Vs Instinct

| Scenario | Avg Events / Beat (5) | First Rest | Peak EX (5) | First Burn |
| --- | ---: | ---: | ---: | ---: |
| Mind Mid Standard / BASIC_MOVE Then Standard Cast | 1.200 | 3 | 92.000 | 4 |
| Instinct Mid Standard / BASIC_MOVE Then Standard Cast | 1.200 | 3 | 92.000 | 2 |

## Heavy Mind Move+Cast

- first failure mode: exhaustion
- movement share of Spark spend: 1.000
- opening 5 avg events per beat: 1.200

## Light Vs Standard Vs Heavy

| Scenario | Avg Events / Beat (5) | First Rest | Peak EX (5) | First Burn |
| --- | ---: | ---: | ---: | ---: |
| Balanced Mid Light / BASIC_MOVE Then Standard Attack | 1.200 | 3 | 92.000 | 2 |
| Balanced Mid Standard / BASIC_MOVE Then Standard Attack | 1.200 | 3 | 92.000 | 4 |
| Balanced Mid Heavy / BASIC_MOVE Then Standard Attack | 1.200 | 2 | 92.000 | 1 |

## Travel Vs Battle Movement

| Scenario | Avg Events / Beat (5) | First Rest | Peak EX (5) | First Burn |
| --- | ---: | ---: | ---: | ---: |
| Balanced Mid Standard / Move Only Battle | 1.000 | 12 | 30.000 | - |
| Balanced Mid Standard / Move Only Travel | 1.000 | - | 0.000 | - |

## Sensitivity

| Lever | Avg Events / Beat Delta | First Rest Delta | Peak EX Delta | Profiles |
| --- | ---: | ---: | ---: | --- |
| Walking Vs Running | 0.200 | -10.000 | 21.000 | balanced_mid_standard |
| Running Vs Sprinting | 0.600 | 0.000 | 41.000 | balanced_mid_standard |
| Body Vs Instinct Compression | 0.000 | 1.000 | 26.000 | body_mid_standard, instinct_mid_standard |
| Weight Move+Attack Gradient | 0.000 | 1.000 | 0.000 | balanced_mid_light, balanced_mid_heavy |

## Recommended Next Candidate Changes


