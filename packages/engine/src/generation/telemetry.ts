import type { GameState } from '../types';
import { hashString, stableStringify } from './hash';
import type {
    CurrentFloorSummary,
    DirectorState,
    FloorOutcomeBuckets,
    FloorOutcomeSnapshot,
    GenerationSpecInput,
    GenerationState,
    OutcomeHistoryQueue,
    RunTelemetryCounters,
    SceneSignature
} from './schema';

export const createEmptyRunTelemetry = (): RunTelemetryCounters => ({
    damageTaken: 0,
    healingReceived: 0,
    forcedDisplacementsTaken: 0,
    controlIncidents: 0,
    hazardDamageEvents: 0,
    sparkSpent: 0,
    sparkRecovered: 0,
    manaSpent: 0,
    manaRecovered: 0,
    exhaustionGained: 0,
    exhaustionCleared: 0,
    sparkBurnHpLost: 0,
    redlineActions: 0,
    exhaustedTurns: 0,
    sparkOutageBlocks: 0,
    manaOutageBlocks: 0,
    restTurns: 0,
    actionsTaken: 0
});

export const createEmptyDirectorState = (): DirectorState => ({
    tensionBand: 0,
    fatigueBand: 0,
    resourceStressBand: 0,
    hazardPressureBand: 0,
    combatDominanceBand: 0,
    recoveryBand: 0,
    redlineBand: 0,
    noveltyDebt: 0,
    narrativeMemory: {
        recentSceneIds: [],
        motifCounts: {},
        evidenceCounts: {}
    }
});

const cloneRunTelemetry = (value?: Partial<RunTelemetryCounters>): RunTelemetryCounters => ({
    damageTaken: Number(value?.damageTaken || 0),
    healingReceived: Number(value?.healingReceived || 0),
    forcedDisplacementsTaken: Number(value?.forcedDisplacementsTaken || 0),
    controlIncidents: Number(value?.controlIncidents || 0),
    hazardDamageEvents: Number(value?.hazardDamageEvents || 0),
    sparkSpent: Number(value?.sparkSpent || 0),
    sparkRecovered: Number(value?.sparkRecovered || 0),
    manaSpent: Number(value?.manaSpent || 0),
    manaRecovered: Number(value?.manaRecovered || 0),
    exhaustionGained: Number(value?.exhaustionGained || 0),
    exhaustionCleared: Number(value?.exhaustionCleared || 0),
    sparkBurnHpLost: Number(value?.sparkBurnHpLost || 0),
    redlineActions: Number(value?.redlineActions || 0),
    exhaustedTurns: Number(value?.exhaustedTurns || 0),
    sparkOutageBlocks: Number(value?.sparkOutageBlocks || 0),
    manaOutageBlocks: Number(value?.manaOutageBlocks || 0),
    restTurns: Number(value?.restTurns || 0),
    actionsTaken: Number(value?.actionsTaken || 0)
});

const resolveAssignedFamilyId = (state: GenerationState, floor: number): string =>
    state.spec?.authoredFloors?.[floor]?.floorFamilyId
    || state.spec?.floorFamilyAssignments?.[floor]
    || '';

export const buildDirectorEntropyKey = (
    runSeed: string,
    specHash: string,
    currentFloorIndex: number,
    recentOutcomeQueue: OutcomeHistoryQueue,
    familyAssignmentId: string = ''
): string => hashString(stableStringify({
    runSeed,
    specHash,
    currentFloorIndex,
    familyAssignmentId,
    snapshots: recentOutcomeQueue.map(item => item.snapshotId)
}));

export const createGenerationState = (
    runSeed: string,
    spec?: GenerationSpecInput
): GenerationState => {
    const specHash = hashString(stableStringify(spec || {}));
    return {
        runSeed,
        specHash,
        spec,
        currentFloorIndex: 1,
        directorEntropyKey: buildDirectorEntropyKey(runSeed, specHash, 1, [], spec?.floorFamilyAssignments?.[1] || ''),
        directorState: createEmptyDirectorState(),
        currentTelemetry: {
            floor: 1,
            baselineTurnsSpent: 0,
            baselineHazardBreaches: 0,
            baselineKills: 0,
            baselineCombatEventCount: 0,
            baselinePlayerHp: 0,
            baselinePlayerMaxHp: 0,
            baselineRunTelemetry: createEmptyRunTelemetry()
        },
        currentFloorSummary: undefined,
        recentOutcomeQueue: [],
        artifactDigest: undefined,
        sceneSignatureHistory: []
    };
};

export const ensureGenerationState = (
    input: GenerationState | undefined,
    runSeed: string,
    spec?: GenerationSpecInput
): GenerationState => {
    const base = createGenerationState(runSeed, spec);
    const next = {
        ...base,
        ...input,
        spec: input?.spec || spec,
        specHash: input?.specHash || base.specHash,
        directorState: {
            ...base.directorState,
            ...(input?.directorState || {})
        },
        currentTelemetry: {
            floor: input?.currentTelemetry?.floor ?? input?.currentFloorIndex ?? 1,
            baselineTurnsSpent: input?.currentTelemetry?.baselineTurnsSpent ?? 0,
            baselineHazardBreaches: input?.currentTelemetry?.baselineHazardBreaches ?? 0,
            baselineKills: input?.currentTelemetry?.baselineKills ?? 0,
            baselineCombatEventCount: input?.currentTelemetry?.baselineCombatEventCount ?? 0,
            baselinePlayerHp: input?.currentTelemetry?.baselinePlayerHp ?? 0,
            baselinePlayerMaxHp: input?.currentTelemetry?.baselinePlayerMaxHp ?? 0,
            baselineRunTelemetry: cloneRunTelemetry(input?.currentTelemetry?.baselineRunTelemetry)
        },
        recentOutcomeQueue: (input?.recentOutcomeQueue || []).slice(-3),
        sceneSignatureHistory: (input?.sceneSignatureHistory || []).slice(-4)
    };
    return {
        ...next,
        directorEntropyKey: input?.directorEntropyKey
            || buildDirectorEntropyKey(
                next.runSeed,
                next.specHash,
                next.currentFloorIndex,
                next.recentOutcomeQueue,
                resolveAssignedFamilyId(next, next.currentFloorIndex)
            )
    };
};

const clampBucket = (value: number, maxBucket: number): number =>
    Math.max(0, Math.min(maxBucket, value));

const bucketByScale = (value: number, scale: number, maxBucket: number): number => {
    if (!Number.isFinite(value) || scale <= 0) return 0;
    return clampBucket(Math.floor(value / scale), maxBucket);
};

export const initializeFloorTelemetry = (
    generationState: GenerationState,
    state: Pick<GameState, 'floor' | 'turnsSpent' | 'hazardBreaches' | 'kills' | 'combatScoreEvents' | 'player' | 'runTelemetry'>
): GenerationState => ({
    ...generationState,
    currentFloorIndex: state.floor,
    directorEntropyKey: buildDirectorEntropyKey(
        generationState.runSeed,
        generationState.specHash,
        state.floor,
        generationState.recentOutcomeQueue,
        resolveAssignedFamilyId(generationState, state.floor)
    ),
    currentTelemetry: {
        floor: state.floor,
        baselineTurnsSpent: state.turnsSpent || 0,
        baselineHazardBreaches: state.hazardBreaches || 0,
        baselineKills: state.kills || 0,
        baselineCombatEventCount: state.combatScoreEvents?.length || 0,
        baselinePlayerHp: state.player.hp,
        baselinePlayerMaxHp: state.player.maxHp,
        baselineRunTelemetry: cloneRunTelemetry(state.runTelemetry)
    }
});

export const quantizeFloorOutcome = (
    state: Pick<GameState, 'floor' | 'turnsSpent' | 'hazardBreaches' | 'kills' | 'combatScoreEvents' | 'player' | 'runTelemetry'>,
    telemetry: GenerationState['currentTelemetry'],
    summary?: CurrentFloorSummary
): FloorOutcomeSnapshot => {
    const floorTurns = Math.max(0, (state.turnsSpent || 0) - telemetry.baselineTurnsSpent);
    const floorHazards = Math.max(0, (state.hazardBreaches || 0) - telemetry.baselineHazardBreaches);
    const floorKills = Math.max(0, (state.kills || 0) - telemetry.baselineKills);
    const combatEvents = Math.max(0, (state.combatScoreEvents?.length || 0) - telemetry.baselineCombatEventCount);
    const runTelemetryDelta: RunTelemetryCounters = {
        damageTaken: Math.max(0, (state.runTelemetry?.damageTaken || 0) - telemetry.baselineRunTelemetry.damageTaken),
        healingReceived: Math.max(0, (state.runTelemetry?.healingReceived || 0) - telemetry.baselineRunTelemetry.healingReceived),
        forcedDisplacementsTaken: Math.max(0, (state.runTelemetry?.forcedDisplacementsTaken || 0) - telemetry.baselineRunTelemetry.forcedDisplacementsTaken),
        controlIncidents: Math.max(0, (state.runTelemetry?.controlIncidents || 0) - telemetry.baselineRunTelemetry.controlIncidents),
        hazardDamageEvents: Math.max(0, (state.runTelemetry?.hazardDamageEvents || 0) - telemetry.baselineRunTelemetry.hazardDamageEvents),
        sparkSpent: Math.max(0, (state.runTelemetry?.sparkSpent || 0) - telemetry.baselineRunTelemetry.sparkSpent),
        sparkRecovered: Math.max(0, (state.runTelemetry?.sparkRecovered || 0) - telemetry.baselineRunTelemetry.sparkRecovered),
        manaSpent: Math.max(0, (state.runTelemetry?.manaSpent || 0) - telemetry.baselineRunTelemetry.manaSpent),
        manaRecovered: Math.max(0, (state.runTelemetry?.manaRecovered || 0) - telemetry.baselineRunTelemetry.manaRecovered),
        exhaustionGained: Math.max(0, (state.runTelemetry?.exhaustionGained || 0) - telemetry.baselineRunTelemetry.exhaustionGained),
        exhaustionCleared: Math.max(0, (state.runTelemetry?.exhaustionCleared || 0) - telemetry.baselineRunTelemetry.exhaustionCleared),
        sparkBurnHpLost: Math.max(0, (state.runTelemetry?.sparkBurnHpLost || 0) - telemetry.baselineRunTelemetry.sparkBurnHpLost),
        redlineActions: Math.max(0, (state.runTelemetry?.redlineActions || 0) - telemetry.baselineRunTelemetry.redlineActions),
        exhaustedTurns: Math.max(0, (state.runTelemetry?.exhaustedTurns || 0) - telemetry.baselineRunTelemetry.exhaustedTurns),
        sparkOutageBlocks: Math.max(0, (state.runTelemetry?.sparkOutageBlocks || 0) - telemetry.baselineRunTelemetry.sparkOutageBlocks),
        manaOutageBlocks: Math.max(0, (state.runTelemetry?.manaOutageBlocks || 0) - telemetry.baselineRunTelemetry.manaOutageBlocks),
        restTurns: Math.max(0, (state.runTelemetry?.restTurns || 0) - telemetry.baselineRunTelemetry.restTurns),
        actionsTaken: Math.max(0, (state.runTelemetry?.actionsTaken || 0) - telemetry.baselineRunTelemetry.actionsTaken)
    };
    const parTurns = Math.max(1, summary?.parTurnTarget || 12);
    const paceBps = Math.floor((floorTurns * 10000) / parTurns);
    const hpDeficitBps = Math.floor(((state.player.maxHp - state.player.hp) * 10000) / Math.max(1, state.player.maxHp));
    const killsPerTenTurns = Math.floor((floorKills * 10) / Math.max(1, floorTurns));

    const bucketIds: FloorOutcomeBuckets = {
        completionPace: bucketByScale(paceBps, 2500, 4),
        resourceStress: bucketByScale(
            hpDeficitBps
            + (runTelemetryDelta.damageTaken * 150)
            + (runTelemetryDelta.sparkBurnHpLost * 400)
            + (runTelemetryDelta.exhaustionGained * 20)
            + (runTelemetryDelta.redlineActions * 500)
            + (runTelemetryDelta.exhaustedTurns * 400)
            + (runTelemetryDelta.sparkOutageBlocks * 250)
            + (runTelemetryDelta.manaOutageBlocks * 200),
            2500,
            4
        ),
        hazardPressure: bucketByScale(floorHazards + runTelemetryDelta.hazardDamageEvents, 2, 4),
        controlStability: bucketByScale(runTelemetryDelta.forcedDisplacementsTaken + runTelemetryDelta.controlIncidents + Math.max(0, floorTurns - parTurns), 3, 4),
        combatDominance: bucketByScale(killsPerTenTurns, 2, 4),
        recoveryUse: bucketByScale(
            runTelemetryDelta.healingReceived
            + runTelemetryDelta.restTurns
            + Math.floor(runTelemetryDelta.sparkRecovered / 25)
            + Math.floor(runTelemetryDelta.manaRecovered / 5)
            + Math.floor(runTelemetryDelta.exhaustionCleared / 25)
            + Math.max(0, combatEvents - floorKills),
            2,
            4
        )
    };

    return {
        floorIndex: state.floor,
        snapshotId: hashString(stableStringify(bucketIds)),
        bucketIds
    };
};

const weightedBand = (
    queue: OutcomeHistoryQueue,
    select: (snapshot: FloorOutcomeSnapshot) => number
): number => {
    const weights = [3, 2, 1];
    let weightedSum = 0;
    let weightSum = 0;

    for (let i = 0; i < queue.length; i++) {
        const weight = weights[i] || 1;
        weightedSum += select(queue[queue.length - 1 - i]) * weight;
        weightSum += weight;
    }

    return weightSum === 0 ? 0 : Math.floor(weightedSum / weightSum);
};

const pushSceneHistory = (history: SceneSignature[], scene?: SceneSignature): SceneSignature[] => {
    if (!scene) return history.slice(-4);
    return [...history, scene].slice(-4);
};

const updateNarrativeMemory = (
    directorState: DirectorState,
    scene?: SceneSignature
): DirectorState['narrativeMemory'] => {
    const base = directorState.narrativeMemory || createEmptyDirectorState().narrativeMemory;
    if (!scene) return base;

    return {
        recentSceneIds: [...base.recentSceneIds, scene.sceneId].slice(-4),
        motifCounts: {
            ...base.motifCounts,
            [scene.motif]: (base.motifCounts[scene.motif] || 0) + 1
        },
        evidenceCounts: {
            ...base.evidenceCounts,
            [scene.primaryEvidence]: (base.evidenceCounts[scene.primaryEvidence] || 0) + 1
        }
    };
};

export const advanceGenerationStateFromCompletedFloor = (
    state: Pick<GameState, 'floor' | 'turnsSpent' | 'hazardBreaches' | 'kills' | 'combatScoreEvents' | 'player' | 'generationState' | 'runTelemetry'> & {
        generationState?: GenerationState;
    }
): GenerationState => {
    const current = ensureGenerationState(
        state.generationState,
        state.generationState?.runSeed || '0',
        state.generationState?.spec
    );
    const snapshot = quantizeFloorOutcome(state, current.currentTelemetry, current.currentFloorSummary);
    const recentOutcomeQueue = [...current.recentOutcomeQueue, snapshot].slice(-3);
    const nextFloor = state.floor + 1;
    const redlineActionsDelta = Math.max(0, (state.runTelemetry?.redlineActions || 0) - (current.currentTelemetry.baselineRunTelemetry.redlineActions || 0));
    const sparkBurnDamageDelta = Math.max(0, (state.runTelemetry?.sparkBurnHpLost || 0) - (current.currentTelemetry.baselineRunTelemetry.sparkBurnHpLost || 0));
    const exhaustedTurnsDelta = Math.max(0, (state.runTelemetry?.exhaustedTurns || 0) - (current.currentTelemetry.baselineRunTelemetry.exhaustedTurns || 0));

    return {
        ...current,
        currentFloorIndex: nextFloor,
        directorEntropyKey: buildDirectorEntropyKey(
            current.runSeed,
            current.specHash,
            nextFloor,
            recentOutcomeQueue,
            resolveAssignedFamilyId(current, nextFloor)
        ),
        directorState: {
            ...current.directorState,
            tensionBand: weightedBand(recentOutcomeQueue, item => item.bucketIds.completionPace),
            fatigueBand: weightedBand(recentOutcomeQueue, item => item.bucketIds.controlStability),
            resourceStressBand: weightedBand(recentOutcomeQueue, item => item.bucketIds.resourceStress),
            hazardPressureBand: weightedBand(recentOutcomeQueue, item => item.bucketIds.hazardPressure),
            combatDominanceBand: weightedBand(recentOutcomeQueue, item => item.bucketIds.combatDominance),
            recoveryBand: weightedBand(recentOutcomeQueue, item => item.bucketIds.recoveryUse),
            redlineBand: bucketByScale(
                (snapshot.bucketIds.resourceStress * 2)
                + redlineActionsDelta
                + sparkBurnDamageDelta
                + exhaustedTurnsDelta,
                3,
                4
            ),
            noveltyDebt: Math.max(
                0,
                (current.directorState?.noveltyDebt || 0)
                + (snapshot.bucketIds.completionPace >= 3 ? 1 : 0)
                - (snapshot.bucketIds.recoveryUse >= 2 ? 1 : 0)
            ),
            narrativeMemory: updateNarrativeMemory(current.directorState, current.currentFloorSummary?.sceneSignature)
        },
        recentOutcomeQueue,
        sceneSignatureHistory: pushSceneHistory(current.sceneSignatureHistory, current.currentFloorSummary?.sceneSignature),
        currentTelemetry: {
            floor: nextFloor,
            baselineTurnsSpent: state.turnsSpent || 0,
            baselineHazardBreaches: state.hazardBreaches || 0,
            baselineKills: state.kills || 0,
            baselineCombatEventCount: state.combatScoreEvents?.length || 0,
            baselinePlayerHp: state.player.hp,
            baselinePlayerMaxHp: state.player.maxHp,
            baselineRunTelemetry: cloneRunTelemetry(state.runTelemetry)
        }
    };
};
