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
    { id: 'standard_human', label: 'Standard Human', body: 10, mind: 10, instinct: 10 },
    { id: 'bruiser_frontline', label: 'Bruiser Frontline', body: 16, mind: 4, instinct: 8 },
    { id: 'skirmisher_light', label: 'Skirmisher Light', body: 8, mind: 6, instinct: 16 },
    { id: 'caster_mind', label: 'Caster Mind', body: 6, mind: 16, instinct: 8 },
    { id: 'companion_falcon', label: 'Companion Falcon', body: 4, mind: 6, instinct: 18 },
    { id: 'companion_skeleton', label: 'Companion Skeleton', body: 12, mind: 2, instinct: 4 },
    { id: 'boss_anchor', label: 'Boss Anchor', body: 18, mind: 14, instinct: 10 }
];

const defaultBurdenForProfile = (
    templateId: string,
    weightClass: MetabolicWeightClass
): MetabolicStatProfile['burdenTier'] => {
    if (templateId === 'standard_human') return 'None';
    if (templateId === 'caster_mind') return 'None';
    if (templateId === 'companion_falcon') return 'None';
    if (templateId === 'companion_skeleton') return 'Medium';
    if (templateId === 'boss_anchor') return 'Heavy';
    if (weightClass === 'Light') return 'Light';
    if (weightClass === 'Heavy') return 'Heavy';
    return 'Medium';
};

export const buildDefaultMetabolicProfileMatrix = (): MetabolicStatProfile[] =>
    DEFAULT_METABOLIC_PROFILE_TEMPLATES.flatMap((template) =>
        WEIGHTS.map((weightClass) => ({
            id: `${template.id}_${weightClass.toLowerCase()}`,
            label: `${template.label} ${weightClass}`,
            body: template.body,
            mind: template.mind,
            instinct: template.instinct,
            weightClass,
            burdenTier: defaultBurdenForProfile(template.id, weightClass)
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

    const standardMoveAttack = getResult(results, 'standard_human_standard', 'standard_move_attack_loop');
    if (standardMoveAttack) {
        const restTurn = standardMoveAttack.firstRestTurn ?? 99;
        targetRows.push({
            id: 'standard_human_standard_move_attack_loop',
            passed: standardMoveAttack.avgActionsPerTurnOpening5 >= 1
                && standardMoveAttack.avgActionsPerTurnOpening5 <= 1.4
                && restTurn >= 3
                && restTurn <= 5
                && standardMoveAttack.firstFailureMode !== 'spark',
            score: round3(
                Math.abs(standardMoveAttack.avgActionsPerTurnOpening5 - 1.2)
                + Math.abs(restTurn - 4)
                + (standardMoveAttack.firstFailureMode === 'spark' ? 1 : 0)
            ),
            details: `avg=${round3(standardMoveAttack.avgActionsPerTurnOpening5)} rest=${restTurn} failure=${standardMoveAttack.firstFailureMode}`
        });
    }

    const bruiserFrontline = getResult(results, 'bruiser_frontline_heavy', 'standard_move_attack_loop');
    if (bruiserFrontline) {
        const restTurn = bruiserFrontline.firstRestTurn ?? 99;
        targetRows.push({
            id: 'bruiser_frontline_heavy_standard_move_attack_loop',
            passed: bruiserFrontline.avgActionsPerTurnOpening5 >= 1
                && bruiserFrontline.avgActionsPerTurnOpening5 <= 1.3
                && restTurn >= 2
                && restTurn <= 4
                && bruiserFrontline.sparkSpentOnMovementOpening5 > 0,
            score: round3(
                Math.abs(bruiserFrontline.avgActionsPerTurnOpening5 - 1.15)
                + Math.abs(restTurn - 3)
            ),
            details: `avg=${round3(bruiserFrontline.avgActionsPerTurnOpening5)} rest=${restTurn} moveSpark=${round3(bruiserFrontline.sparkSpentOnMovementOpening5)}`
        });
    }

    const skirmisherBurst = getResult(results, 'skirmisher_light_light', 'ranged_attack_spacing_loop');
    if (skirmisherBurst) {
        const restTurn = skirmisherBurst.firstRestTurn ?? 99;
        targetRows.push({
            id: 'skirmisher_light_ranged_attack_spacing_loop',
            passed: skirmisherBurst.avgActionsPerTurnOpening5 >= 0.8
                && skirmisherBurst.avgActionsPerTurnOpening5 <= 1.2
                && restTurn >= 2
                && restTurn <= 4
                && skirmisherBurst.firstFailureMode !== 'spark',
            score: round3(
                Math.abs(skirmisherBurst.avgActionsPerTurnOpening5 - 1)
                + Math.abs(restTurn - 3)
                + (skirmisherBurst.firstFailureMode === 'spark' ? 1 : 0)
            ),
            details: `avg=${round3(skirmisherBurst.avgActionsPerTurnOpening5)} rest=${restTurn} failure=${skirmisherBurst.firstFailureMode}`
        });
    }

    const casterSignature = getResult(results, 'caster_mind_standard', 'caster_signature_loop');
    if (casterSignature) {
        const restTurn = casterSignature.firstRestTurn ?? 99;
        targetRows.push({
            id: 'caster_mind_caster_signature_loop',
            passed: casterSignature.firstFailureMode !== 'mana'
                && casterSignature.manaSpentOpening5 > 0
                && restTurn >= 2
                && restTurn <= 5,
            score: round3(
                (casterSignature.firstFailureMode === 'mana' ? 2 : 0)
                + Math.abs(restTurn - 3.5)
            ),
            details: `rest=${restTurn} manaSpent=${round3(casterSignature.manaSpentOpening5)} failure=${casterSignature.firstFailureMode}`
        });
    }

    const bomberSetup = getResult(results, 'caster_mind_light', 'bomber_setup_loop');
    if (bomberSetup) {
        const restTurn = bomberSetup.firstRestTurn ?? 99;
        targetRows.push({
            id: 'bomber_setup_loop_native_reserve',
            passed: bomberSetup.firstFailureMode !== 'mana'
                && bomberSetup.avgActionsPerTurnOpening5 >= 1
                && bomberSetup.avgActionsPerTurnOpening5 <= 1.3
                && restTurn >= 3,
            score: round3(
                (bomberSetup.firstFailureMode === 'mana' ? 2 : 0)
                + Math.max(0, 3 - restTurn)
            ),
            details: `avg=${round3(bomberSetup.avgActionsPerTurnOpening5)} rest=${restTurn} failure=${bomberSetup.firstFailureMode}`
        });
    }

    const falconSupport = getResult(results, 'companion_falcon_light', 'falcon_support_loop');
    if (falconSupport) {
        const restTurn = falconSupport.firstRestTurn ?? 99;
        targetRows.push({
            id: 'companion_falcon_support_loop',
            passed: falconSupport.avgActionsPerTurnOpening5 >= 1
                && falconSupport.avgActionsPerTurnOpening5 <= 1.5
                && restTurn >= 2
                && restTurn <= 5
                && falconSupport.firstFailureMode !== 'mana',
            score: round3(
                Math.abs(falconSupport.avgActionsPerTurnOpening5 - 1.3)
                + Math.abs(restTurn - 3.5)
            ),
            details: `avg=${round3(falconSupport.avgActionsPerTurnOpening5)} rest=${restTurn} failure=${falconSupport.firstFailureMode}`
        });
    }

    const skeletonAttrition = getResult(results, 'companion_skeleton_standard', 'skeleton_attrition_loop');
    if (skeletonAttrition) {
        const restTurn = skeletonAttrition.firstRestTurn ?? 99;
        targetRows.push({
            id: 'companion_skeleton_attrition_loop',
            passed: skeletonAttrition.avgActionsPerTurnOpening5 >= 0.4
                && skeletonAttrition.avgActionsPerTurnOpening5 <= 1
                && restTurn >= 1
                && skeletonAttrition.firstFailureMode !== 'spark',
            score: round3(
                Math.abs(skeletonAttrition.avgActionsPerTurnOpening5 - 0.7)
                + Math.abs(restTurn - 2)
            ),
            details: `avg=${round3(skeletonAttrition.avgActionsPerTurnOpening5)} rest=${restTurn} failure=${skeletonAttrition.firstFailureMode}`
        });
    }

    const standardWalking = getResult(results, 'standard_human_standard', 'basic_move_x1');
    const standardRunning = getResult(results, 'standard_human_standard', 'basic_move_x2');
    const standardSprinting = getResult(results, 'standard_human_standard', 'basic_move_x3');
    if (standardWalking && standardRunning && standardSprinting) {
        targetRows.push({
            id: 'standard_human_movement_gradient',
            passed: (standardWalking.firstRestTurn ?? 99) >= 6
                && (standardRunning.firstRestTurn ?? 99) <= 3
                && standardSprinting.firstImmediateBurnTurn === 1,
            score: round3(
                Math.max(0, 6 - (standardWalking.firstRestTurn ?? 0))
                + Math.max(0, (standardRunning.firstRestTurn ?? 99) - 3)
                + (standardSprinting.firstImmediateBurnTurn === 1 ? 0 : 1)
            ),
            details: `walkRest=${standardWalking.firstRestTurn ?? '-'} runRest=${standardRunning.firstRestTurn ?? '-'} sprintBurn=${standardSprinting.firstImmediateBurnTurn ?? '-'}`
        });
    }

    const travelBalanced = getResult(results, 'standard_human_standard', 'move_only_travel');
    const battleBalanced = getResult(results, 'standard_human_standard', 'move_only_battle');
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
