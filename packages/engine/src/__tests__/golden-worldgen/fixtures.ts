export interface GoldenWorldgenFixture {
    id: string;
    floor: number;
    runSeed: string;
    floorSeed: string;
    artifactDigest: string;
    verificationDigest: string;
    sceneId: string;
    moduleIds: string[];
    directorEntropyKey: string;
    recentOutcomeQueue: Array<{
        floorIndex: number;
        snapshotId: string;
        bucketIds: {
            completionPace: number;
            resourceStress: number;
            hazardPressure: number;
            controlStability: number;
            combatDominance: number;
            recoveryUse: number;
        };
    }>;
    pathSummary: {
        mainLandmarkIds: string[];
        primaryLandmarkIds: string[];
        alternateLandmarkIds: string[];
        hiddenLandmarkIds: string[];
        routeCount: number;
        junctionCount: number;
        maxStraightRun: number;
        obstacleClusterCount: number;
        trapClusterCount: number;
        lavaClusterCount: number;
        tacticalTileCount: number;
        visualTileCount: number;
    };
}

export const GOLDEN_WORLDGEN_FIXTURES: GoldenWorldgenFixture[] = [
    {
        id: 'opening_a',
        floor: 1,
        runSeed: 'golden-open-1',
        floorSeed: 'golden-open-1',
        artifactDigest: 'e29d44e9',
        verificationDigest: '52780755',
        sceneId: 'f8f1931c',
        moduleIds: [],
        directorEntropyKey: '0b28f0ba',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'shrine'],
            primaryLandmarkIds: ['entry', 'exit', 'shrine'],
            alternateLandmarkIds: ['entry', 'exit', 'shrine'],
            hiddenLandmarkIds: ['scene_anchor_collapsed_crossing'],
            routeCount: 1,
            junctionCount: 0,
            maxStraightRun: 4,
            obstacleClusterCount: 1,
            trapClusterCount: 0,
            lavaClusterCount: 0,
            tacticalTileCount: 10,
            visualTileCount: 10
        }
    },
    {
        id: 'opening_b',
        floor: 1,
        runSeed: 'golden-open-2',
        floorSeed: 'golden-open-2',
        artifactDigest: '89129fc3',
        verificationDigest: '52780755',
        sceneId: 'f8f1931c',
        moduleIds: [],
        directorEntropyKey: 'f6d4714d',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'shrine'],
            primaryLandmarkIds: ['entry', 'exit', 'shrine'],
            alternateLandmarkIds: ['entry', 'exit', 'shrine'],
            hiddenLandmarkIds: ['scene_anchor_collapsed_crossing'],
            routeCount: 1,
            junctionCount: 0,
            maxStraightRun: 5,
            obstacleClusterCount: 1,
            trapClusterCount: 0,
            lavaClusterCount: 0,
            tacticalTileCount: 13,
            visualTileCount: 11
        }
    },
    {
        id: 'watchline_a',
        floor: 5,
        runSeed: 'golden-watch-1',
        floorSeed: 'golden-watch-1:5',
        artifactDigest: '980585af',
        verificationDigest: '52780755',
        sceneId: '3cf066e5',
        moduleIds: ['inferno_cover_band', 'inferno_watch_post'],
        directorEntropyKey: '00bd7b0a',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_watch_post', 'shrine'],
            primaryLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_watch_post', 'shrine'],
            alternateLandmarkIds: ['entry', 'exit', 'shrine'],
            hiddenLandmarkIds: ['inferno_cover_band'],
            routeCount: 1,
            junctionCount: 0,
            maxStraightRun: 4,
            obstacleClusterCount: 0,
            trapClusterCount: 0,
            lavaClusterCount: 1,
            tacticalTileCount: 15,
            visualTileCount: 13
        }
    },
    {
        id: 'watchline_b',
        floor: 5,
        runSeed: 'golden-watch-2',
        floorSeed: 'golden-watch-2:5',
        artifactDigest: '88a91da8',
        verificationDigest: '52780755',
        sceneId: '3cf066e5',
        moduleIds: ['inferno_cover_band', 'inferno_watch_post'],
        directorEntropyKey: '8e30b69d',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_watch_post', 'shrine'],
            primaryLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_watch_post', 'shrine'],
            alternateLandmarkIds: ['entry', 'exit', 'shrine'],
            hiddenLandmarkIds: ['inferno_cover_band'],
            routeCount: 1,
            junctionCount: 0,
            maxStraightRun: 5,
            obstacleClusterCount: 0,
            trapClusterCount: 0,
            lavaClusterCount: 1,
            tacticalTileCount: 15,
            visualTileCount: 15
        }
    },
    {
        id: 'recovery_a',
        floor: 7,
        runSeed: 'golden-recovery-3',
        floorSeed: 'golden-recovery-3:7',
        artifactDigest: 'af99f6ed',
        verificationDigest: '52780755',
        sceneId: '9c19b46d',
        moduleIds: ['inferno_fire_step'],
        directorEntropyKey: '500d64db',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_collapsed_crossing', 'shrine'],
            primaryLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_collapsed_crossing', 'shrine'],
            alternateLandmarkIds: ['entry', 'exit', 'shrine'],
            hiddenLandmarkIds: [],
            routeCount: 2,
            junctionCount: 2,
            maxStraightRun: 3,
            obstacleClusterCount: 2,
            trapClusterCount: 1,
            lavaClusterCount: 0,
            tacticalTileCount: 13,
            visualTileCount: 13
        }
    },
    {
        id: 'recovery_b',
        floor: 7,
        runSeed: 'golden-recovery-4',
        floorSeed: 'golden-recovery-4:7',
        artifactDigest: 'b2330d0f',
        verificationDigest: '52780755',
        sceneId: 'd60474fe',
        moduleIds: ['inferno_snare_lane'],
        directorEntropyKey: '0e67cd48',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_collapsed_crossing', 'shrine'],
            primaryLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_collapsed_crossing', 'shrine'],
            alternateLandmarkIds: ['entry', 'exit', 'shrine'],
            hiddenLandmarkIds: [],
            routeCount: 2,
            junctionCount: 2,
            maxStraightRun: 3,
            obstacleClusterCount: 2,
            trapClusterCount: 1,
            lavaClusterCount: 0,
            tacticalTileCount: 15,
            visualTileCount: 15
        }
    },
    {
        id: 'escape_a',
        floor: 8,
        runSeed: 'golden-escape-a',
        floorSeed: 'golden-escape-a:8',
        artifactDigest: '7b94ca9d',
        verificationDigest: '52780755',
        sceneId: 'f92b8eea',
        moduleIds: ['inferno_failed_escape', 'inferno_flank_loop'],
        directorEntropyKey: '7da5348b',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_failed_escape', 'shrine'],
            primaryLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_failed_escape', 'shrine'],
            alternateLandmarkIds: ['entry', 'exit', 'shrine'],
            hiddenLandmarkIds: ['secondary_slot'],
            routeCount: 1,
            junctionCount: 0,
            maxStraightRun: 6,
            obstacleClusterCount: 0,
            trapClusterCount: 0,
            lavaClusterCount: 1,
            tacticalTileCount: 17,
            visualTileCount: 15
        }
    },
    {
        id: 'escape_b',
        floor: 8,
        runSeed: 'golden-escape-2',
        floorSeed: 'golden-escape-2:8',
        artifactDigest: 'fc4fa13f',
        verificationDigest: '52780755',
        sceneId: 'f92b8eea',
        moduleIds: ['inferno_failed_escape', 'inferno_flank_loop'],
        directorEntropyKey: '2925a434',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_failed_escape', 'shrine'],
            primaryLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_failed_escape', 'shrine'],
            alternateLandmarkIds: ['entry', 'exit', 'shrine'],
            hiddenLandmarkIds: ['secondary_slot'],
            routeCount: 1,
            junctionCount: 0,
            maxStraightRun: 5,
            obstacleClusterCount: 0,
            trapClusterCount: 0,
            lavaClusterCount: 1,
            tacticalTileCount: 18,
            visualTileCount: 15
        }
    },
    {
        id: 'boss_a',
        floor: 10,
        runSeed: 'golden-boss-1',
        floorSeed: 'golden-boss-1:10',
        artifactDigest: 'e0411eb1',
        verificationDigest: '52780755',
        sceneId: '5ce5d93a',
        moduleIds: ['inferno_arena_ring', 'inferno_ritual_dais'],
        directorEntropyKey: '90a1e73d',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_ritual_site', 'secondary_slot', 'shrine'],
            primaryLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_ritual_site', 'secondary_slot', 'shrine'],
            alternateLandmarkIds: ['entry', 'exit', 'shrine'],
            hiddenLandmarkIds: [],
            routeCount: 1,
            junctionCount: 0,
            maxStraightRun: 6,
            obstacleClusterCount: 0,
            trapClusterCount: 0,
            lavaClusterCount: 1,
            tacticalTileCount: 16,
            visualTileCount: 16
        }
    },
    {
        id: 'boss_b',
        floor: 10,
        runSeed: 'golden-boss-2',
        floorSeed: 'golden-boss-2:10',
        artifactDigest: '4c76559d',
        verificationDigest: '52780755',
        sceneId: '5ce5d93a',
        moduleIds: ['inferno_arena_ring', 'inferno_ritual_dais'],
        directorEntropyKey: 'f2291daa',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_ritual_site', 'secondary_slot', 'shrine'],
            primaryLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_ritual_site', 'secondary_slot', 'shrine'],
            alternateLandmarkIds: ['entry', 'exit', 'shrine'],
            hiddenLandmarkIds: [],
            routeCount: 1,
            junctionCount: 0,
            maxStraightRun: 3,
            obstacleClusterCount: 0,
            trapClusterCount: 0,
            lavaClusterCount: 1,
            tacticalTileCount: 15,
            visualTileCount: 15
        }
    }
];
