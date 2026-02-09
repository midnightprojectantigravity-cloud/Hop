import { generateDungeon, generateEnemies } from './map';
import { evaluateEncounter, type GradeResult } from './evaluation';
import { getCalibrationProfile, type CalibrationProfile } from './calibration';
import { computeEvaluatorBaselines } from './evaluation-baselines';

export interface EncounterTargetResult {
    targetDifficulty: number;
    tolerance: number;
    selected: {
        floor: number;
        seed: string;
        difficultyGrade: number;
        deltaFromTarget: number;
        bandMatch: boolean;
        encounter: GradeResult;
    };
}

export interface ReinforcementRecommendation {
    loadoutId: string;
    currentNumericGrade: number;
    firemageBaselineGrade: number;
    upliftNeeded: number;
    recommendedLevers: string[];
}

export const findEncounterForTargetDifficulty = (
    targetDifficulty: number,
    tolerance: number,
    calibration: CalibrationProfile,
    floorRange: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    attemptsPerFloor = 20
): EncounterTargetResult => {
    let best: EncounterTargetResult['selected'] | undefined;

    for (const floor of floorRange) {
        for (let i = 0; i < attemptsPerFloor; i++) {
            const seed = `challenge-${floor}-${i + 1}`;
            const dungeon = generateDungeon(floor, seed);
            const enemies = generateEnemies(floor, dungeon.spawnPositions, seed);
            const candidateEnemySets = enemies.length <= 1
                ? [enemies]
                : Array.from({ length: enemies.length }, (_, idx) => enemies.slice(0, idx + 1));

            for (const enemySet of candidateEnemySets) {
                const encounter = evaluateEncounter({
                    id: `challenge_f${floor}_s${i + 1}_e${enemySet.length}`,
                    map: {
                        id: `challenge_map_f${floor}_s${i + 1}`,
                        tiles: dungeon.tiles,
                        playerSpawn: dungeon.playerSpawn,
                        stairsPosition: dungeon.stairsPosition,
                        shrinePosition: dungeon.shrinePosition
                    },
                    enemies: enemySet,
                    objectives: [
                        { id: 'TURN_LIMIT', target: 60 },
                        { id: 'HAZARD_CONSTRAINT', target: 3 }
                    ]
                }, { calibration });
                const delta = Math.abs(encounter.difficultyGrade - targetDifficulty);
                const candidate: EncounterTargetResult['selected'] = {
                    floor,
                    seed: `${seed}:enemies:${enemySet.length}`,
                    difficultyGrade: encounter.difficultyGrade,
                    deltaFromTarget: Number(delta.toFixed(4)),
                    bandMatch: delta <= tolerance,
                    encounter
                };
                if (!best || candidate.deltaFromTarget < best.deltaFromTarget) {
                    best = candidate;
                }
                if (candidate.bandMatch) {
                    return {
                        targetDifficulty,
                        tolerance,
                        selected: candidate
                    };
                }
            }
        }
    }

    if (!best) {
        throw new Error('No encounter candidates generated');
    }

    return {
        targetDifficulty,
        tolerance,
        selected: best
    };
};

export const buildReinforcementPlan = (
    calibrationVersion = 'cal-v1-firemage-baseline',
    modelVersion = 'uel-v1'
): ReinforcementRecommendation[] => {
    const baselines = computeEvaluatorBaselines(modelVersion, calibrationVersion);
    const loadoutRows = baselines.entityGrades.loadouts;
    const firemage = loadoutRows.find(r => r.id === 'player_firemage');
    if (!firemage) return [];

    return loadoutRows
        .filter(r => r.id !== 'player_firemage')
        .map(row => {
            const upliftNeeded = Number(Math.max(0, firemage.numericGrade - row.numericGrade).toFixed(4));
            const recommendedLevers = upliftNeeded <= 0
                ? []
                : [
                    'increase skill scaling on archetype-defining skills',
                    'improve policy offense/positioning weights for archetype',
                    'reduce hazard exposure through movement/control tools'
                ];
            return {
                loadoutId: row.id.replace('player_', '').toUpperCase(),
                currentNumericGrade: row.numericGrade,
                firemageBaselineGrade: firemage.numericGrade,
                upliftNeeded,
                recommendedLevers
            };
        })
        .sort((a, b) => b.upliftNeeded - a.upliftNeeded);
};

export const runChallengeDesignWorkflow = (
    targetDifficulty = 55,
    tolerance = 5,
    calibrationVersion = 'cal-v1-firemage-baseline',
    modelVersion = 'uel-v1'
) => {
    const calibration = getCalibrationProfile(calibrationVersion);
    const targetEncounter = findEncounterForTargetDifficulty(targetDifficulty, tolerance, calibration);
    const reinforcementPlan = buildReinforcementPlan(calibration.version, modelVersion);
    return {
        targetEncounter,
        reinforcementPlan
    };
};
