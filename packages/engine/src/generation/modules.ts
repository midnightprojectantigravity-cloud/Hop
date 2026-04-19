import type {
    IndexedModuleRegistryEntry,
    ModuleCollisionMask,
    ModuleEquivalenceClass,
    ModuleRegistryEntry,
    ModuleRegistryIndex,
    ModuleRegistrySnapshot
} from './schema';

const REGISTRY_VERSION = 'worldgen-v7.1';
const SPEC_SCHEMA_VERSION = 'worldgen-spec-v7.1';

const collisionMaskFromKeys = (keys: string[]): ModuleCollisionMask => {
    const sortedKeys = [...keys].sort();
    return {
        keys: sortedKeys,
        signature: sortedKeys.join('|')
    };
};

const createInfernoModules = (): ModuleRegistryEntry[] => ([
    {
        id: 'inferno_wall_choke',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: 0, dr: -1 }, { dq: 0, dr: 1 }],
        tileStamps: [{ dq: -1, dr: 0, baseId: 'WALL' }, { dq: 1, dr: 0, baseId: 'WALL' }, { dq: 0, dr: 0, baseId: 'STONE' }],
        gaskets: [{ id: 'north_lane', dq: 0, dr: -1, direction: 2, state: 'open_required' }, { id: 'south_lane', dq: 0, dr: 1, direction: 5, state: 'open_required' }],
        claimTemplates: [{ id: 'lane', kind: 'movement_corridor', hardness: 'hard', from: { dq: 0, dr: -1 }, to: { dq: 0, dr: 1 } }],
        capability: {
            tacticalTags: ['choke', 'cover_band'],
            narrativeTags: ['siege_breach'],
            moodTags: ['tense'],
            evidenceTags: ['broken_weapon'],
            encounterPostures: ['fortified_hold'],
            sceneRoles: ['choke'],
            anchorKinds: ['center'],
            forbiddenNeighborTags: []
        },
        collisionMask: collisionMaskFromKeys(['-1,0', '1,0'])
    },
    {
        id: 'inferno_gate_choke',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: 0, dr: -1 }, { dq: 0, dr: 1 }, { dq: 1, dr: -1 }],
        tileStamps: [{ dq: -1, dr: 0, baseId: 'WALL' }, { dq: 1, dr: -1, baseId: 'WALL' }, { dq: 1, dr: 0, baseId: 'WALL' }],
        gaskets: [{ id: 'gate_lane', dq: 0, dr: 0, direction: 2, state: 'open_required' }],
        claimTemplates: [{ id: 'gate_opening', kind: 'gasket_opening', hardness: 'hard', from: { dq: 0, dr: -1 }, to: { dq: 0, dr: 1 } }],
        capability: {
            tacticalTags: ['choke'],
            narrativeTags: ['siege_breach'],
            moodTags: ['tense'],
            evidenceTags: ['warning_marker'],
            encounterPostures: ['fortified_hold'],
            sceneRoles: ['choke'],
            anchorKinds: ['center', 'upper'],
            forbiddenNeighborTags: []
        },
        collisionMask: collisionMaskFromKeys(['-1,0', '1,-1', '1,0'])
    },
    {
        id: 'inferno_split_barricade',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 1, dr: -1 }],
        tileStamps: [{ dq: 0, dr: 0, baseId: 'WALL' }, { dq: -1, dr: 1, baseId: 'WALL' }, { dq: 1, dr: -1, baseId: 'WALL' }],
        claimTemplates: [{ id: 'split_lane', kind: 'movement_corridor', hardness: 'soft', from: { dq: -1, dr: 0 }, to: { dq: 1, dr: 0 } }],
        capability: {
            tacticalTags: ['choke', 'flank_route'],
            narrativeTags: ['siege_breach'],
            moodTags: ['alert'],
            evidenceTags: ['broken_weapon'],
            encounterPostures: ['fortified_hold'],
            sceneRoles: ['choke'],
            anchorKinds: ['center', 'left', 'right'],
            forbiddenNeighborTags: []
        },
        collisionMask: collisionMaskFromKeys(['0,0', '-1,1', '1,-1'])
    },
    {
        id: 'inferno_lava_pocket',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: 0, dr: 1 }, { dq: -1, dr: 1 }],
        tileStamps: [{ dq: 0, dr: 0, baseId: 'HAZARD' }, { dq: 1, dr: 0, baseId: 'HAZARD' }, { dq: 0, dr: 1, baseId: 'HAZARD' }, { dq: -1, dr: 1, baseId: 'VOID' }],
        claimTemplates: [{ id: 'heat_pull', kind: 'movement_corridor', hardness: 'soft', from: { dq: -1, dr: 0 }, to: { dq: 1, dr: 0 } }],
        capability: {
            tacticalTags: ['hazard_lure'],
            narrativeTags: ['collapsed_crossing'],
            moodTags: ['grim'],
            evidenceTags: ['scorched_path'],
            encounterPostures: ['predatory_lure'],
            sceneRoles: ['hazard_field'],
            anchorKinds: ['upper', 'center'],
            forbiddenNeighborTags: ['safe_reset']
        },
        collisionMask: collisionMaskFromKeys([])
    },
    {
        id: 'inferno_heat_funnel',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: 0, dr: -1 }, { dq: 0, dr: 1 }, { dq: -1, dr: 1 }],
        tileStamps: [{ dq: -1, dr: 0, baseId: 'HAZARD' }, { dq: 1, dr: 0, baseId: 'HAZARD' }, { dq: -1, dr: 1, baseId: 'WALL' }],
        gaskets: [{ id: 'heat_lane', dq: 0, dr: 0, direction: 0, state: 'open_optional' }],
        claimTemplates: [{ id: 'funnel_lane', kind: 'movement_corridor', hardness: 'soft', from: { dq: 0, dr: -1 }, to: { dq: 0, dr: 1 } }],
        capability: {
            tacticalTags: ['hazard_lure', 'cover_band'],
            narrativeTags: ['collapsed_crossing'],
            moodTags: ['grim'],
            evidenceTags: ['scorched_path'],
            encounterPostures: ['predatory_lure'],
            sceneRoles: ['hazard_field'],
            anchorKinds: ['center', 'upper'],
            forbiddenNeighborTags: ['safe_reset']
        },
        collisionMask: collisionMaskFromKeys(['-1,1'])
    },
    {
        id: 'inferno_broken_bridge',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: 0, dr: -1 }, { dq: 0, dr: 1 }],
        tileStamps: [{ dq: -1, dr: 0, baseId: 'HAZARD' }, { dq: 1, dr: 0, baseId: 'HAZARD' }, { dq: 0, dr: 0, baseId: 'STONE' }],
        claimTemplates: [{ id: 'bridge_crossing', kind: 'movement_corridor', hardness: 'hard', from: { dq: 0, dr: -1 }, to: { dq: 0, dr: 1 } }],
        capability: {
            tacticalTags: ['hazard_lure', 'flank_route'],
            narrativeTags: ['failed_escape'],
            moodTags: ['grim'],
            evidenceTags: ['collapsed_supply'],
            encounterPostures: ['predatory_lure'],
            sceneRoles: ['hazard_field'],
            anchorKinds: ['center'],
            forbiddenNeighborTags: ['safe_reset']
        },
        collisionMask: collisionMaskFromKeys([])
    },
    {
        id: 'inferno_watch_post',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: 0, dr: 1 }, { dq: 1, dr: -1 }],
        tileStamps: [{ dq: 0, dr: 1, baseId: 'WALL' }, { dq: 1, dr: -1, baseId: 'WALL' }],
        gaskets: [{ id: 'sight_cut', dq: 1, dr: 1, direction: 0, state: 'open_optional' }],
        claimTemplates: [{ id: 'perch_los', kind: 'los_corridor', hardness: 'hard', from: { dq: -1, dr: 0 }, to: { dq: 1, dr: 0 } }],
        capability: {
            tacticalTags: ['perch', 'crossfire'],
            narrativeTags: ['watch_post'],
            moodTags: ['alert'],
            evidenceTags: ['warning_marker'],
            encounterPostures: ['crossfire_screen'],
            sceneRoles: ['perch'],
            anchorKinds: ['upper', 'right'],
            forbiddenNeighborTags: ['choke']
        },
        collisionMask: collisionMaskFromKeys(['0,1', '1,-1'])
    },
    {
        id: 'inferno_crossfire_ledge',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 1, dr: -1 }, { dq: 0, dr: -1 }],
        tileStamps: [{ dq: -1, dr: 1, baseId: 'WALL' }, { dq: 1, dr: -1, baseId: 'WALL' }, { dq: 0, dr: -1, baseId: 'STONE' }],
        claimTemplates: [{ id: 'crossfire_lane', kind: 'los_corridor', hardness: 'soft', from: { dq: -1, dr: 0 }, to: { dq: 1, dr: 0 } }],
        capability: {
            tacticalTags: ['perch', 'crossfire'],
            narrativeTags: ['watch_post'],
            moodTags: ['alert'],
            evidenceTags: ['warning_marker'],
            encounterPostures: ['crossfire_screen'],
            sceneRoles: ['perch'],
            anchorKinds: ['upper', 'left', 'right'],
            forbiddenNeighborTags: ['safe_reset']
        },
        collisionMask: collisionMaskFromKeys(['-1,1', '1,-1'])
    },
    {
        id: 'inferno_sniper_nest',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: 0, dr: 1 }, { dq: -1, dr: 1 }, { dq: 1, dr: -1 }],
        tileStamps: [{ dq: 0, dr: 1, baseId: 'WALL' }, { dq: -1, dr: 1, baseId: 'WALL' }, { dq: 1, dr: -1, baseId: 'STONE' }],
        claimTemplates: [{ id: 'sniper_lane', kind: 'los_corridor', hardness: 'hard', from: { dq: -1, dr: 0 }, to: { dq: 1, dr: 0 } }],
        capability: {
            tacticalTags: ['perch'],
            narrativeTags: ['watch_post'],
            moodTags: ['alert'],
            evidenceTags: ['warning_marker'],
            encounterPostures: ['crossfire_screen'],
            sceneRoles: ['perch'],
            anchorKinds: ['upper'],
            forbiddenNeighborTags: ['choke']
        },
        collisionMask: collisionMaskFromKeys(['0,1', '-1,1'])
    },
    {
        id: 'inferno_flank_loop',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: 1, dr: -1 }, { dq: 0, dr: 1 }],
        tileStamps: [{ dq: 1, dr: -1, baseId: 'STONE' }, { dq: 0, dr: 1, baseId: 'STONE' }],
        claimTemplates: [{ id: 'flank_lane', kind: 'movement_corridor', hardness: 'soft', from: { dq: -1, dr: 0 }, to: { dq: 1, dr: -1 } }],
        capability: {
            tacticalTags: ['flank_route'],
            narrativeTags: ['failed_escape'],
            moodTags: ['grim'],
            evidenceTags: ['collapsed_supply'],
            encounterPostures: ['panic_scatter'],
            sceneRoles: ['pocket'],
            anchorKinds: ['left', 'right'],
            forbiddenNeighborTags: ['boss_arena']
        },
        collisionMask: collisionMaskFromKeys([])
    },
    {
        id: 'inferno_reset_pocket',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 0, dr: 1 }],
        tileStamps: [{ dq: 1, dr: 0, baseId: 'WALL' }, { dq: -1, dr: 1, baseId: 'STONE' }],
        claimTemplates: [{ id: 'reset_lane', kind: 'reset_access', hardness: 'hard', from: { dq: -1, dr: 0 }, to: { dq: 0, dr: 1 } }],
        capability: {
            tacticalTags: ['safe_reset'],
            narrativeTags: ['failed_escape'],
            moodTags: ['grim'],
            evidenceTags: ['collapsed_supply'],
            encounterPostures: ['panic_scatter'],
            sceneRoles: ['pocket'],
            anchorKinds: ['lower', 'left'],
            forbiddenNeighborTags: ['hazard_lure']
        },
        collisionMask: collisionMaskFromKeys(['1,0'])
    },
    {
        id: 'inferno_cover_band',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 1, dr: -1 }],
        tileStamps: [{ dq: -1, dr: 0, baseId: 'WALL' }, { dq: 1, dr: 0, baseId: 'WALL' }],
        claimTemplates: [{ id: 'cover_run', kind: 'movement_corridor', hardness: 'soft', from: { dq: -1, dr: 1 }, to: { dq: 1, dr: -1 } }],
        capability: {
            tacticalTags: ['cover_band', 'safe_reset'],
            narrativeTags: ['siege_breach'],
            moodTags: ['tense'],
            evidenceTags: ['broken_weapon'],
            encounterPostures: ['fortified_hold'],
            sceneRoles: ['pocket'],
            anchorKinds: ['center', 'lower'],
            forbiddenNeighborTags: []
        },
        collisionMask: collisionMaskFromKeys(['-1,0', '1,0'])
    },
    {
        id: 'inferno_switchback_bend',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: 0, dr: 1 }, { dq: 1, dr: -1 }],
        tileStamps: [{ dq: 1, dr: 0, baseId: 'WALL' }, { dq: 0, dr: 1, baseId: 'WALL' }],
        claimTemplates: [{ id: 'switchback_lane', kind: 'movement_corridor', hardness: 'soft', from: { dq: -1, dr: 0 }, to: { dq: 1, dr: -1 } }],
        capability: {
            tacticalTags: ['cover_band', 'flank_route'],
            narrativeTags: ['failed_escape'],
            moodTags: ['grim'],
            evidenceTags: ['collapsed_supply'],
            encounterPostures: ['panic_scatter'],
            sceneRoles: ['pocket'],
            anchorKinds: ['left', 'lower', 'right'],
            forbiddenNeighborTags: []
        },
        collisionMask: collisionMaskFromKeys(['0,1', '1,0'])
    },
    {
        id: 'inferno_split_fork',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 1, dr: -1 }],
        tileStamps: [{ dq: 0, dr: 0, baseId: 'STONE' }, { dq: -1, dr: 1, baseId: 'WALL' }],
        claimTemplates: [{ id: 'fork_lane', kind: 'movement_corridor', hardness: 'soft', from: { dq: -1, dr: 0 }, to: { dq: 1, dr: 0 } }],
        capability: {
            tacticalTags: ['flank_route', 'safe_reset'],
            narrativeTags: ['failed_escape'],
            moodTags: ['grim'],
            evidenceTags: ['warning_marker'],
            encounterPostures: ['panic_scatter'],
            sceneRoles: ['pocket'],
            anchorKinds: ['center', 'left', 'right'],
            forbiddenNeighborTags: ['boss_arena']
        },
        collisionMask: collisionMaskFromKeys(['-1,1'])
    },
    {
        id: 'inferno_merge_choke',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: 0, dr: -1 }, { dq: 0, dr: 1 }],
        tileStamps: [{ dq: -1, dr: 0, baseId: 'WALL' }, { dq: 0, dr: -1, baseId: 'WALL' }],
        claimTemplates: [{ id: 'merge_lane', kind: 'movement_corridor', hardness: 'hard', from: { dq: 0, dr: 1 }, to: { dq: 1, dr: 0 } }],
        capability: {
            tacticalTags: ['choke', 'cover_band'],
            narrativeTags: ['siege_breach'],
            moodTags: ['tense'],
            evidenceTags: ['broken_weapon'],
            encounterPostures: ['fortified_hold'],
            sceneRoles: ['choke'],
            anchorKinds: ['center', 'upper'],
            forbiddenNeighborTags: []
        },
        collisionMask: collisionMaskFromKeys(['-1,0', '0,-1'])
    },
    {
        id: 'inferno_snare_lane',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: 0, dr: 1 }],
        tileStamps: [{ dq: 1, dr: 0, baseId: 'STONE' }],
        claimTemplates: [{ id: 'snare_lane', kind: 'movement_corridor', hardness: 'soft', from: { dq: -1, dr: 0 }, to: { dq: 0, dr: 1 } }],
        capability: {
            tacticalTags: ['hazard_lure', 'flank_route'],
            narrativeTags: ['collapsed_crossing'],
            moodTags: ['grim'],
            evidenceTags: ['scorched_path'],
            encounterPostures: ['predatory_lure'],
            sceneRoles: ['hazard_field'],
            anchorKinds: ['left', 'right', 'lower'],
            forbiddenNeighborTags: ['safe_reset']
        },
        collisionMask: collisionMaskFromKeys([])
    },
    {
        id: 'inferno_fire_step',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: 0, dr: -1 }],
        tileStamps: [{ dq: 0, dr: 0, baseId: 'HAZARD' }],
        claimTemplates: [{ id: 'fire_step', kind: 'movement_corridor', hardness: 'soft', from: { dq: -1, dr: 0 }, to: { dq: 1, dr: 0 } }],
        capability: {
            tacticalTags: ['hazard_lure'],
            narrativeTags: ['collapsed_crossing'],
            moodTags: ['grim'],
            evidenceTags: ['scorched_path'],
            encounterPostures: ['predatory_lure'],
            sceneRoles: ['hazard_field'],
            anchorKinds: ['center', 'upper', 'right'],
            forbiddenNeighborTags: ['safe_reset']
        },
        collisionMask: collisionMaskFromKeys([])
    },
    {
        id: 'inferno_broken_cover_weave',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 1, dr: -1 }, { dq: 0, dr: 1 }],
        tileStamps: [{ dq: -1, dr: 0, baseId: 'WALL' }, { dq: 1, dr: -1, baseId: 'WALL' }, { dq: 0, dr: 1, baseId: 'STONE' }],
        claimTemplates: [{ id: 'weave_lane', kind: 'los_corridor', hardness: 'soft', from: { dq: -1, dr: 1 }, to: { dq: 1, dr: 0 } }],
        capability: {
            tacticalTags: ['cover_band', 'perch'],
            narrativeTags: ['watch_post'],
            moodTags: ['alert'],
            evidenceTags: ['warning_marker'],
            encounterPostures: ['crossfire_screen'],
            sceneRoles: ['perch'],
            anchorKinds: ['upper', 'left', 'right'],
            forbiddenNeighborTags: []
        },
        collisionMask: collisionMaskFromKeys(['-1,0', '1,-1'])
    },
    {
        id: 'inferno_ritual_dais',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: 0, dr: -1 }, { dq: 0, dr: 1 }, { dq: -1, dr: 1 }],
        tileStamps: [{ dq: 0, dr: 0, baseId: 'STONE' }, { dq: -1, dr: 1, baseId: 'WALL' }, { dq: 0, dr: 1, baseId: 'WALL' }],
        claimTemplates: [{ id: 'ritual_view', kind: 'choke_visibility', hardness: 'hard', from: { dq: 0, dr: -1 }, to: { dq: 1, dr: 0 } }],
        capability: {
            tacticalTags: ['boss_arena', 'choke'],
            narrativeTags: ['ritual_site'],
            moodTags: ['tense'],
            evidenceTags: ['ruined_altar'],
            encounterPostures: ['ritual_defense'],
            sceneRoles: ['objective'],
            anchorKinds: ['center'],
            forbiddenNeighborTags: ['safe_reset']
        },
        collisionMask: collisionMaskFromKeys(['-1,1', '0,1'])
    },
    {
        id: 'inferno_arena_ring',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: 0, dr: -1 }, { dq: 0, dr: 1 }, { dq: 1, dr: -1 }, { dq: -1, dr: 1 }],
        tileStamps: [{ dq: -1, dr: 0, baseId: 'WALL' }, { dq: 1, dr: 0, baseId: 'WALL' }, { dq: 0, dr: -1, baseId: 'STONE' }, { dq: 0, dr: 1, baseId: 'STONE' }],
        claimTemplates: [{ id: 'arena_focus', kind: 'choke_visibility', hardness: 'hard', from: { dq: 0, dr: -1 }, to: { dq: 0, dr: 1 } }],
        capability: {
            tacticalTags: ['boss_arena', 'crossfire'],
            narrativeTags: ['ritual_site'],
            moodTags: ['tense'],
            evidenceTags: ['burned_brazier'],
            encounterPostures: ['ritual_defense'],
            sceneRoles: ['objective'],
            anchorKinds: ['center'],
            forbiddenNeighborTags: ['safe_reset']
        },
        collisionMask: collisionMaskFromKeys(['-1,0', '1,0'])
    },
    {
        id: 'inferno_failed_escape',
        theme: 'inferno',
        footprint: [{ dq: -1, dr: 0 }, { dq: 0, dr: 0 }, { dq: 1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 1, dr: -1 }],
        tileStamps: [{ dq: -1, dr: 1, baseId: 'HAZARD' }, { dq: 1, dr: -1, baseId: 'WALL' }],
        claimTemplates: [{ id: 'escape_line', kind: 'movement_corridor', hardness: 'soft', from: { dq: -1, dr: 0 }, to: { dq: 1, dr: 0 } }],
        capability: {
            tacticalTags: ['flank_route', 'hazard_lure'],
            narrativeTags: ['failed_escape'],
            moodTags: ['grim'],
            evidenceTags: ['corpse_cluster'],
            encounterPostures: ['panic_scatter'],
            sceneRoles: ['pocket'],
            anchorKinds: ['left', 'right', 'lower'],
            forbiddenNeighborTags: ['boss_arena']
        },
        collisionMask: collisionMaskFromKeys(['1,-1'])
    }
]);

const DEFAULT_MODULES: ModuleRegistryEntry[] = createInfernoModules();

const maskCatalog = (entries: ModuleRegistryEntry[], select: (entry: ModuleRegistryEntry) => string[]) => {
    const keys = Array.from(new Set(entries.flatMap(select))).sort();
    const bitByValue: Record<string, bigint> = {};
    keys.forEach((value, index) => {
        bitByValue[value] = 1n << BigInt(index);
    });
    const toMask = (values: string[]): bigint =>
        values.reduce((mask, value) => mask | (bitByValue[value] || 0n), 0n);
    return { toMask };
};

const buildEquivalenceKey = (entry: IndexedModuleRegistryEntry): string => {
    const gasketSignature = (entry.gaskets || [])
        .map(gasket => `${gasket.id}:${gasket.dq},${gasket.dr}:${gasket.direction}:${gasket.state}`)
        .sort()
        .join('|');
    const claimSignature = (entry.claimTemplates || [])
        .map(claim => `${claim.id}:${claim.kind}:${claim.hardness}:${claim.from.dq},${claim.from.dr}:${claim.to.dq},${claim.to.dr}`)
        .sort()
        .join('|');

    return [
        entry.theme,
        entry.tacticalMask.toString(),
        entry.narrativeMask.toString(),
        entry.moodMask.toString(),
        entry.evidenceMask.toString(),
        entry.encounterMask.toString(),
        entry.sceneRoleMask.toString(),
        entry.anchorMask.toString(),
        entry.forbiddenNeighborMask.toString(),
        entry.collisionMask.signature,
        gasketSignature,
        claimSignature,
        entry.footprint.map(hex => `${hex.dq},${hex.dr}`).sort().join('|')
    ].join('::');
};

let cachedIndex: ModuleRegistryIndex | undefined;

export const indexModuleRegistry = (sourceEntries: ModuleRegistryEntry[]): ModuleRegistryIndex => {
    const tacticalCatalog = maskCatalog(sourceEntries, entry => entry.capability.tacticalTags);
    const narrativeCatalog = maskCatalog(sourceEntries, entry => entry.capability.narrativeTags);
    const moodCatalog = maskCatalog(sourceEntries, entry => entry.capability.moodTags);
    const evidenceCatalog = maskCatalog(sourceEntries, entry => entry.capability.evidenceTags);
    const encounterCatalog = maskCatalog(sourceEntries, entry => entry.capability.encounterPostures);
    const sceneRoleCatalog = maskCatalog(sourceEntries, entry => entry.capability.sceneRoles);
    const anchorCatalog = maskCatalog(sourceEntries, entry => entry.capability.anchorKinds);
    const forbiddenCatalog = maskCatalog(sourceEntries, entry => entry.capability.forbiddenNeighborTags);

    const entries: IndexedModuleRegistryEntry[] = sourceEntries.map(entry => {
        const indexed: IndexedModuleRegistryEntry = {
            ...entry,
            tacticalMask: tacticalCatalog.toMask(entry.capability.tacticalTags),
            narrativeMask: narrativeCatalog.toMask(entry.capability.narrativeTags),
            moodMask: moodCatalog.toMask(entry.capability.moodTags),
            evidenceMask: evidenceCatalog.toMask(entry.capability.evidenceTags),
            encounterMask: encounterCatalog.toMask(entry.capability.encounterPostures),
            sceneRoleMask: sceneRoleCatalog.toMask(entry.capability.sceneRoles),
            anchorMask: anchorCatalog.toMask(entry.capability.anchorKinds),
            forbiddenNeighborMask: forbiddenCatalog.toMask(entry.capability.forbiddenNeighborTags),
            constraintDensityScore: entry.capability.forbiddenNeighborTags.length + entry.capability.tacticalTags.length,
            equivalenceKey: ''
        };
        indexed.equivalenceKey = buildEquivalenceKey(indexed);
        return indexed;
    }).sort((a, b) => a.id.localeCompare(b.id));

    const entriesById = entries.reduce<Record<string, IndexedModuleRegistryEntry>>((acc, entry) => {
        acc[entry.id] = entry;
        return acc;
    }, {});

    const equivalenceMap = new Map<string, ModuleEquivalenceClass>();
    for (const entry of entries) {
        const existing = equivalenceMap.get(entry.equivalenceKey);
        if (existing) {
            existing.moduleIds.push(entry.id);
            existing.moduleIds.sort();
            continue;
        }
        equivalenceMap.set(entry.equivalenceKey, {
            id: `eq_${equivalenceMap.size}`,
            moduleIds: [entry.id],
            collisionSignature: entry.collisionMask.signature,
            representativeId: entry.id
        });
    }

    const equivalenceClasses = Array.from(equivalenceMap.values()).sort((a, b) => a.id.localeCompare(b.id));
    const snapshot: ModuleRegistrySnapshot = {
        registryVersion: REGISTRY_VERSION,
        specSchemaVersion: SPEC_SCHEMA_VERSION,
        moduleCount: entries.length,
        modules: entries.map(entry => ({
            id: entry.id,
            theme: entry.theme,
            collisionSignature: entry.collisionMask.signature
        }))
    };

    return {
        registryVersion: REGISTRY_VERSION,
        specSchemaVersion: SPEC_SCHEMA_VERSION,
        entries,
        entriesById,
        equivalenceClasses,
        snapshot
    };
};

export const buildModuleRegistryIndex = (): ModuleRegistryIndex => {
    if (cachedIndex) return cachedIndex;
    cachedIndex = indexModuleRegistry(DEFAULT_MODULES);

    return cachedIndex;
};

export const getModuleRegistrySnapshot = (): ModuleRegistrySnapshot =>
    buildModuleRegistryIndex().snapshot;
