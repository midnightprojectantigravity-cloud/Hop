import type { AilmentCatalog } from './contracts';

export const MVP_AILMENT_CATALOG: AilmentCatalog = {
    version: '1.0.0',
    ailments: [
        {
            id: 'burn',
            name: 'Burn',
            core: {
                atk: 'mind',
                def: 'resolve',
                scalingFactor: 10,
                baseDeposit: 2,
                skillMultiplierBase: 0
            },
            interactions: [
                { target: 'frozen', ratio: 1, priority: 30, vfx: 'SEAR' }
            ],
            tick: {
                damage: {
                    base: 0,
                    terms: [{ variable: 'currentCounters', coefficient: 0.2 }],
                    round: 'floor',
                    min: 0,
                    max: 12
                },
                decay: {
                    base: 1,
                    terms: [{ variable: 'resiliencePct', coefficient: 0.03 }],
                    round: 'floor',
                    min: 0,
                    max: 6
                }
            },
            thresholds: [
                {
                    count: 20,
                    effectId: 'INCINERATED',
                    message: 'Incinerated!',
                    bonusDamage: 2
                }
            ],
            hardening: {
                tickXpRate: 0.2,
                shockXpRate: 0.8,
                capPct: 85,
                xpToResistance: 1.5
            }
        },
        {
            id: 'wet',
            name: 'Wet',
            core: {
                atk: 'instinct',
                def: 'body',
                scalingFactor: 12,
                baseDeposit: 2,
                skillMultiplierBase: 0
            },
            interactions: [
                { target: 'burn', ratio: 1, priority: 40, vfx: 'STEAM' }
            ],
            tick: {
                decay: {
                    base: 2,
                    terms: [{ variable: 'resiliencePct', coefficient: 0.04 }],
                    round: 'floor',
                    min: 0,
                    max: 8
                }
            },
            hardening: {
                tickXpRate: 0.08,
                shockXpRate: 0.4,
                capPct: 85,
                xpToResistance: 1.8
            }
        },
        {
            id: 'poison',
            name: 'Poison',
            core: {
                atk: 'int',
                def: 'wis',
                scalingFactor: 8,
                baseDeposit: 1,
                skillMultiplierBase: 0
            },
            tick: {
                damage: {
                    base: 0,
                    terms: [
                        { variable: 'currentCounters', coefficient: 0.01 },
                        { variable: 'maxHp', coefficient: 0.01 }
                    ],
                    round: 'floor',
                    min: 0,
                    max: 10
                },
                decay: {
                    base: 1,
                    terms: [{ variable: 'resiliencePct', coefficient: 0.02 }],
                    round: 'floor',
                    min: 0,
                    max: 5
                }
            },
            hardening: {
                tickXpRate: 0.15,
                shockXpRate: 0.25,
                capPct: 85,
                xpToResistance: 1.6
            }
        },
        {
            id: 'frozen',
            name: 'Frozen',
            core: {
                atk: 'wis',
                def: 'body',
                scalingFactor: 14,
                baseDeposit: 1,
                skillMultiplierBase: 0
            },
            tick: {
                decay: {
                    base: 1,
                    terms: [{ variable: 'resiliencePct', coefficient: 0.025 }],
                    round: 'floor',
                    min: 0,
                    max: 5
                }
            },
            thresholds: [
                {
                    count: 12,
                    effectId: 'IMMOBILIZED',
                    message: 'Immobilized by frost.'
                }
            ],
            hardening: {
                tickXpRate: 0.12,
                shockXpRate: 0.3,
                capPct: 85,
                xpToResistance: 1.7
            }
        },
        {
            id: 'bleed',
            name: 'Bleed',
            core: {
                atk: 'dex',
                def: 'agi',
                scalingFactor: 10,
                baseDeposit: 1,
                skillMultiplierBase: 0
            },
            tick: {
                damage: {
                    base: 0,
                    terms: [{ variable: 'currentCounters', coefficient: 0.15 }],
                    round: 'floor',
                    min: 0,
                    max: 8
                },
                decay: {
                    base: 2,
                    terms: [{ variable: 'resiliencePct', coefficient: 0.02 }],
                    round: 'floor',
                    min: 0,
                    max: 6
                }
            },
            hardening: {
                tickXpRate: 0.1,
                shockXpRate: 0.35,
                capPct: 85,
                xpToResistance: 1.4
            }
        }
    ]
};
