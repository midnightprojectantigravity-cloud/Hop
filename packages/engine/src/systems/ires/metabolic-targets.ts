import type {
    MetabolicCadenceResult,
    MetabolicStatProfile,
    MetabolicTargetOutcome,
    MetabolicWeightClass
} from './metabolic-types';

export interface MetabolicProfileTemplate {
    id: string;
    label: string;
    body: number;
    mind: number;
    instinct: number;
}

const WEIGHTS: MetabolicWeightClass[] = ['Light', 'Standard', 'Heavy'];

export const DEFAULT_METABOLIC_PROFILE_TEMPLATES: MetabolicProfileTemplate[] = [
    { id: 'balanced_low', label: 'Balanced Low', body: 4, mind: 4, instinct: 4 },
    { id: 'balanced_mid', label: 'Balanced Mid', body: 7, mind: 7, instinct: 6 },
    { id: 'balanced_high', label: 'Balanced High', body: 10, mind: 10, instinct: 8 },
    { id: 'body_mid', label: 'Body Mid', body: 12, mind: 4, instinct: 4 },
    { id: 'body_high', label: 'Body High', body: 16, mind: 6, instinct: 6 },
    { id: 'mind_mid', label: 'Mind Mid', body: 4, mind: 12, instinct: 4 },
    { id: 'mind_high', label: 'Mind High', body: 6, mind: 16, instinct: 6 },
    { id: 'instinct_mid', label: 'Instinct Mid', body: 4, mind: 4, instinct: 12 },
    { id: 'instinct_high', label: 'Instinct High', body: 6, mind: 6, instinct: 16 }
];

export const buildDefaultMetabolicProfileMatrix = (): MetabolicStatProfile[] =>
    DEFAULT_METABOLIC_PROFILE_TEMPLATES.flatMap((template) =>
        WEIGHTS.map((weightClass) => ({
            id: `${template.id}_${weightClass.toLowerCase()}`,
            label: `${template.label} ${weightClass}`,
            body: template.body,
            mind: template.mind,
            instinct: template.instinct,
            weightClass
        }))
    );

const round3 = (value: number): number => Number(value.toFixed(3));

const getResult = (
    results: MetabolicCadenceResult[],
    profileId: string,
    workloadId: string
): MetabolicCadenceResult | undefined =>
    results.find((entry) => entry.profileId === profileId && entry.workloadId === workloadId);

export const scoreMetabolicTargets = (results: MetabolicCadenceResult[]): MetabolicTargetOutcome[] => {
    const targetRows: MetabolicTargetOutcome[] = [];

    const walking = getResult(results, 'balanced_mid_standard', 'basic_move_x1');
    if (walking) {
        const restTurn = walking.firstRestTurn ?? 99;
        targetRows.push({
            id: 'balanced_mid_standard_basic_move_x1',
            passed: walking.avgActionsPerTurnOpening5 >= 1 && restTurn >= 5,
            score: round3(Math.abs(walking.avgActionsPerTurnOpening5 - 1) + Math.max(0, 5 - restTurn)),
            details: `avg=${round3(walking.avgActionsPerTurnOpening5)} rest=${restTurn}`
        });
    }

    const running = getResult(results, 'balanced_mid_standard', 'basic_move_x2');
    if (running) {
        const restTurn = running.firstRestTurn ?? 99;
        targetRows.push({
            id: 'balanced_mid_standard_basic_move_x2',
            passed: running.avgActionsPerTurnOpening5 >= 1.1
                && running.avgActionsPerTurnOpening5 <= 1.6
                && restTurn >= 2
                && restTurn <= 3,
            score: round3(
                Math.abs(running.avgActionsPerTurnOpening5 - 1.35)
                + Math.abs(restTurn - 2.5)
            ),
            details: `avg=${round3(running.avgActionsPerTurnOpening5)} rest=${restTurn}`
        });
    }

    const sprint = getResult(results, 'balanced_mid_standard', 'basic_move_x3');
    if (sprint) {
        targetRows.push({
            id: 'balanced_mid_standard_basic_move_x3',
            passed: sprint.firstImmediateBurnTurn === 1 && sprint.avgActionsPerTurnOpening5 <= 1.9,
            score: round3(
                (sprint.firstImmediateBurnTurn === 1 ? 0 : 1)
                + Math.max(0, sprint.avgActionsPerTurnOpening5 - 1.9)
            ),
            details: `burn=${sprint.firstImmediateBurnTurn ?? 0} avg=${round3(sprint.avgActionsPerTurnOpening5)}`
        });
    }

    const committed = getResult(results, 'balanced_mid_standard', 'basic_move_then_standard_attack');
    if (committed) {
        const restTurn = committed.firstRestTurn ?? 99;
        targetRows.push({
            id: 'balanced_mid_standard_basic_move_then_standard_attack',
            passed: committed.avgActionsPerTurnOpening5 >= 1
                && committed.avgActionsPerTurnOpening5 <= 1.4
                && restTurn >= 2
                && restTurn <= 3,
            score: round3(
                Math.abs(committed.avgActionsPerTurnOpening5 - 1.2)
                + Math.abs(restTurn - 2.5)
            ),
            details: `avg=${round3(committed.avgActionsPerTurnOpening5)} rest=${restTurn}`
        });
    }

    const mindMidHeavyBattleline = getResult(results, 'mind_mid_heavy', 'heavy_mind_battleline');
    if (mindMidHeavyBattleline) {
        targetRows.push({
            id: 'mind_mid_heavy_battleline',
            passed: mindMidHeavyBattleline.firstFailureMode !== 'mana'
                && mindMidHeavyBattleline.movementShareOfSparkSpend >= 0.5,
            score: round3(
                (mindMidHeavyBattleline.firstFailureMode === 'mana' ? 1 : 0)
                + Math.max(0, 0.5 - mindMidHeavyBattleline.movementShareOfSparkSpend)
            ),
            details: `failure=${mindMidHeavyBattleline.firstFailureMode} moveShare=${round3(mindMidHeavyBattleline.movementShareOfSparkSpend)}`
        });
    }

    const instinctMoveBurst = getResult(results, 'instinct_mid_light', 'instinct_move_burst');
    if (instinctMoveBurst) {
        const interval = instinctMoveBurst.avgTurnsBetweenBonusActions ?? 99;
        targetRows.push({
            id: 'instinct_mid_light_move_burst',
            passed: interval >= 3 && interval <= 5 && instinctMoveBurst.avgActionsPerTurnOpening5 < 2,
            score: round3(Math.abs(interval - 4) + Math.max(0, instinctMoveBurst.avgActionsPerTurnOpening5 - 1.7)),
            details: `interval=${interval} avg=${round3(instinctMoveBurst.avgActionsPerTurnOpening5)}`
        });
    }

    const travelBalanced = getResult(results, 'balanced_mid_standard', 'move_only_travel');
    const battleBalanced = getResult(results, 'balanced_mid_standard', 'move_only_battle');
    if (travelBalanced && battleBalanced) {
        const travelRest = travelBalanced.firstRestTurn ?? 99;
        const battleRest = battleBalanced.firstRestTurn ?? 99;
        targetRows.push({
            id: 'travel_move_relief',
            passed: travelBalanced.avgActionsPerTurnOpening5 >= battleBalanced.avgActionsPerTurnOpening5
                && travelRest >= battleRest,
            score: round3(
                Math.max(0, battleBalanced.avgActionsPerTurnOpening5 - travelBalanced.avgActionsPerTurnOpening5)
                + Math.max(0, battleRest - travelRest)
            ),
            details: `travel=${round3(travelBalanced.avgActionsPerTurnOpening5)} battle=${round3(battleBalanced.avgActionsPerTurnOpening5)}`
        });
    }

    return targetRows;
};
