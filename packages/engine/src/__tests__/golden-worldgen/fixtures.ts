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
        hiddenLandmarkIds: string[];
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
        artifactDigest: '445865c0',
        verificationDigest: '52780755',
        sceneId: 'f8f1931c',
        moduleIds: [],
        directorEntropyKey: '0b28f0ba',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'shrine'],
            hiddenLandmarkIds: ['scene_anchor_collapsed_crossing'],
            tacticalTileCount: 11,
            visualTileCount: 10
        }
    },
    {
        id: 'opening_b',
        floor: 1,
        runSeed: 'golden-open-2',
        floorSeed: 'golden-open-2',
        artifactDigest: '7cbdc1dc',
        verificationDigest: '52780755',
        sceneId: 'f8f1931c',
        moduleIds: [],
        directorEntropyKey: 'f6d4714d',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'shrine'],
            hiddenLandmarkIds: ['scene_anchor_collapsed_crossing'],
            tacticalTileCount: 13,
            visualTileCount: 11
        }
    },
    {
        id: 'watchline_a',
        floor: 5,
        runSeed: 'golden-watch-1',
        floorSeed: 'golden-watch-1:5',
        artifactDigest: '1f85b2ff',
        verificationDigest: '52780755',
        sceneId: '3cf066e5',
        moduleIds: ['inferno_cover_band', 'inferno_watch_post'],
        directorEntropyKey: '00bd7b0a',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_watch_post', 'shrine'],
            hiddenLandmarkIds: ['inferno_cover_band'],
            tacticalTileCount: 15,
            visualTileCount: 13
        }
    },
    {
        id: 'watchline_b',
        floor: 5,
        runSeed: 'golden-watch-2',
        floorSeed: 'golden-watch-2:5',
        artifactDigest: '467a6663',
        verificationDigest: '52780755',
        sceneId: '3cf066e5',
        moduleIds: ['inferno_cover_band', 'inferno_watch_post'],
        directorEntropyKey: '8e30b69d',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_watch_post', 'shrine'],
            hiddenLandmarkIds: ['inferno_cover_band'],
            tacticalTileCount: 17,
            visualTileCount: 15
        }
    },
    {
        id: 'recovery_a',
        floor: 7,
        runSeed: 'golden-recovery-3',
        floorSeed: 'golden-recovery-3:7',
        artifactDigest: 'e8402e00',
        verificationDigest: '52780755',
        sceneId: '7e7cccb7',
        moduleIds: ['inferno_lava_pocket'],
        directorEntropyKey: '500d64db',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_collapsed_crossing', 'shrine'],
            hiddenLandmarkIds: [],
            tacticalTileCount: 11,
            visualTileCount: 11
        }
    },
    {
        id: 'recovery_b',
        floor: 7,
        runSeed: 'golden-recovery-4',
        floorSeed: 'golden-recovery-4:7',
        artifactDigest: 'dcd9dfea',
        verificationDigest: '52780755',
        sceneId: '7e7cccb7',
        moduleIds: ['inferno_lava_pocket'],
        directorEntropyKey: '0e67cd48',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_collapsed_crossing', 'shrine'],
            hiddenLandmarkIds: [],
            tacticalTileCount: 13,
            visualTileCount: 13
        }
    },
    {
        id: 'escape_a',
        floor: 8,
        runSeed: 'golden-escape-a',
        floorSeed: 'golden-escape-a:8',
        artifactDigest: '8afecb57',
        verificationDigest: '52780755',
        sceneId: 'f92b8eea',
        moduleIds: ['inferno_failed_escape', 'inferno_flank_loop'],
        directorEntropyKey: '7da5348b',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_failed_escape', 'shrine'],
            hiddenLandmarkIds: ['secondary_slot'],
            tacticalTileCount: 17,
            visualTileCount: 16
        }
    },
    {
        id: 'escape_b',
        floor: 8,
        runSeed: 'golden-escape-2',
        floorSeed: 'golden-escape-2:8',
        artifactDigest: 'ea3f69da',
        verificationDigest: '52780755',
        sceneId: 'f92b8eea',
        moduleIds: ['inferno_failed_escape', 'inferno_flank_loop'],
        directorEntropyKey: '2925a434',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_failed_escape', 'shrine'],
            hiddenLandmarkIds: ['secondary_slot'],
            tacticalTileCount: 17,
            visualTileCount: 15
        }
    },
    {
        id: 'boss_a',
        floor: 10,
        runSeed: 'golden-boss-1',
        floorSeed: 'golden-boss-1:10',
        artifactDigest: '1dfbc079',
        verificationDigest: '52780755',
        sceneId: '5ce5d93a',
        moduleIds: ['inferno_arena_ring', 'inferno_ritual_dais'],
        directorEntropyKey: '90a1e73d',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_ritual_site', 'secondary_slot', 'shrine'],
            hiddenLandmarkIds: [],
            tacticalTileCount: 18,
            visualTileCount: 18
        }
    },
    {
        id: 'boss_b',
        floor: 10,
        runSeed: 'golden-boss-2',
        floorSeed: 'golden-boss-2:10',
        artifactDigest: 'd738877a',
        verificationDigest: '52780755',
        sceneId: '5ce5d93a',
        moduleIds: ['inferno_arena_ring', 'inferno_ritual_dais'],
        directorEntropyKey: 'f2291daa',
        recentOutcomeQueue: [],
        pathSummary: {
            mainLandmarkIds: ['entry', 'exit', 'primary_slot', 'scene_anchor_ritual_site', 'secondary_slot', 'shrine'],
            hiddenLandmarkIds: [],
            tacticalTileCount: 15,
            visualTileCount: 15
        }
    }
];
