import type { GenerationPoint, GenerationSpecInput } from '../schema';
import { getModuleRegistrySnapshot } from '../modules';

const point = (q: number, r: number): GenerationPoint => ({ q, r, s: -q - r });

export const INFERNO_VERTICAL_SLICE_SPEC: GenerationSpecInput = {
    registryVersion: getModuleRegistrySnapshot().registryVersion,
    authoredFloorFamilies: {
        inferno_elite_watchline: {
            id: 'inferno_elite_watchline',
            role: 'elite',
            theme: 'inferno',
            requiredTacticalTags: ['perch', 'crossfire'],
            requiredNarrativeTags: ['watch_post'],
            anchors: {
                entry: point(4, 10),
                exit: point(4, 0),
                primary_slot: point(4, 3),
                secondary_slot: point(6, 2)
            },
            pathOverrides: {
                primary_slot: { onPath: true, pathOrder: 100 },
                secondary_slot: { onPath: false, pathOrder: 220 }
            },
            preferredModuleIds: ['inferno_watch_post', 'inferno_crossfire_ledge', 'inferno_sniper_nest', 'inferno_cover_band'],
            pinnedModules: [
                { id: 'inferno_watch_post', anchor: point(4, 3) },
                { id: 'inferno_cover_band', anchor: point(4, 6) }
            ],
            closedPaths: [
                {
                    id: 'watchline_entry_exit',
                    entryAnchorId: 'entry',
                    exitAnchorId: 'exit',
                    requiredLength: 10,
                    requiredParity: 'even'
                }
            ]
        },
        inferno_elite_breach: {
            id: 'inferno_elite_breach',
            role: 'elite',
            theme: 'inferno',
            requiredTacticalTags: ['choke', 'hazard_lure'],
            requiredNarrativeTags: ['siege_breach'],
            anchors: {
                entry: point(4, 10),
                exit: point(4, 0),
                primary_slot: point(4, 5),
                secondary_slot: point(5, 4)
            },
            pathOverrides: {
                primary_slot: { onPath: true, pathOrder: 120 },
                secondary_slot: { onPath: false, pathOrder: 240 }
            },
            preferredModuleIds: ['inferno_gate_choke', 'inferno_split_barricade', 'inferno_heat_funnel', 'inferno_broken_bridge'],
            pinnedModules: [
                { id: 'inferno_gate_choke', anchor: point(4, 5) }
            ]
        },
        inferno_boss_ring: {
            id: 'inferno_boss_ring',
            role: 'boss',
            theme: 'inferno',
            requiredTacticalTags: ['boss_arena', 'choke'],
            requiredNarrativeTags: ['ritual_site'],
            anchors: {
                entry: point(4, 10),
                exit: point(4, 0),
                boss_anchor: point(4, 2),
                primary_slot: point(4, 5),
                secondary_slot: point(4, 2),
                shrine: point(7, 5)
            },
            pathOverrides: {
                primary_slot: { onPath: true, pathOrder: 120 },
                secondary_slot: { onPath: true, pathOrder: 160 }
            },
            preferredModuleIds: ['inferno_arena_ring', 'inferno_ritual_dais', 'inferno_cover_band'],
            pinnedModules: [
                { id: 'inferno_arena_ring', anchor: point(4, 5) },
                { id: 'inferno_ritual_dais', anchor: point(4, 2) }
            ],
            tileStamps: [
                { dq: 3, dr: 2, baseId: 'WALL' },
                { dq: 3, dr: 3, baseId: 'WALL' },
                { dq: 4, dr: 3, baseId: 'WALL' },
                { dq: 3, dr: 4, baseId: 'WALL' },
                { dq: 4, dr: 4, baseId: 'WALL' },
                { dq: 3, dr: 5, baseId: 'WALL' },
                { dq: 3, dr: 6, baseId: 'WALL' },
                { dq: 4, dr: 6, baseId: 'WALL' },
                { dq: 5, dr: 6, baseId: 'WALL' },
                { dq: 3, dr: 7, baseId: 'WALL' },
                { dq: 4, dr: 7, baseId: 'WALL' },
                { dq: 3, dr: 8, baseId: 'WALL' },
                { dq: 4, dr: 8, baseId: 'WALL' }
            ],
            enemySeeds: [
                { q: 5, r: 2, s: -7, subtype: 'butcher' }
            ],
            closedPaths: [
                {
                    id: 'boss_ring_entry_exit',
                    entryAnchorId: 'entry',
                    exitAnchorId: 'exit',
                    requiredLength: 10,
                    requiredParity: 'even'
                }
            ]
        },
        inferno_challenge_escape: {
            id: 'inferno_challenge_escape',
            role: 'pressure_spike',
            theme: 'inferno',
            requiredTacticalTags: ['hazard_lure', 'flank_route'],
            requiredNarrativeTags: ['failed_escape'],
            anchors: {
                entry: point(4, 10),
                exit: point(4, 0),
                primary_slot: point(3, 4),
                secondary_slot: point(5, 5)
            },
            pathOverrides: {
                primary_slot: { onPath: true, pathOrder: 100 },
                secondary_slot: { onPath: false, pathOrder: 180 }
            },
            preferredModuleIds: ['inferno_failed_escape', 'inferno_broken_bridge', 'inferno_flank_loop', 'inferno_lava_pocket'],
            pinnedModules: [
                { id: 'inferno_failed_escape', anchor: point(3, 4) },
                { id: 'inferno_flank_loop', anchor: point(5, 5) }
            ],
            closedPaths: [
                {
                    id: 'escape_loop',
                    entryAnchorId: 'primary_slot',
                    exitAnchorId: 'secondary_slot',
                    requiredLength: 5,
                    requiredParity: 'flexible',
                    flexibleLoop: true
                }
            ]
        }
    },
    floorFamilyAssignments: {
        5: 'inferno_elite_watchline',
        8: 'inferno_challenge_escape',
        10: 'inferno_boss_ring'
    },
    authoredFloors: {
        10: {
            floorFamilyId: 'inferno_boss_ring',
            role: 'boss',
            requiredTacticalTags: ['boss_arena', 'choke'],
            requiredNarrativeTags: ['ritual_site']
        }
    }
};
