import {
  advanceGenerationStateFromCompletedFloor,
  createDailySeed,
  createGenerationState,
  createHex,
  createCompilerSession,
  getModuleRegistrySnapshot,
  toDateKey,
  validateDefaultWorldgenSpec,
} from '@hop/engine';
import type { CompilerSessionInput, TransitionCompileContext, StartRunCompileContext } from '@hop/engine';
import type { WorldgenWorkerRequest, WorldgenWorkerResponse } from './worldgen-worker-protocol';

const snapshot = getModuleRegistrySnapshot();
const specFindings = validateDefaultWorldgenSpec();
const bootError = specFindings.find((finding) => finding.severity === 'error');
const workerScope = self as unknown as Worker;

const emitBoot = () => {
  const response: WorldgenWorkerResponse = bootError
    ? {
        type: 'BOOT_ERROR',
        registryVersion: snapshot.registryVersion,
        specSchemaVersion: snapshot.specSchemaVersion,
        error: bootError.message
      }
    : {
        type: 'BOOT_OK',
        registryVersion: snapshot.registryVersion,
        specSchemaVersion: snapshot.specSchemaVersion,
        moduleCount: snapshot.moduleCount
      };
  workerScope.postMessage(response);
};

const postCompileOk = (requestId: string, artifact: import('@hop/engine').CompiledFloorArtifact) => {
  workerScope.postMessage({
    type: 'COMPILE_OK',
    requestId,
    artifact
  } satisfies WorldgenWorkerResponse, [artifact.tileBaseIds.buffer]);
};

const buildStartRunSessionInput = (
  context: StartRunCompileContext
): { input: CompilerSessionInput; runSeed: string; resolvedDate?: string } => {
  const resolvedDate = context.mode === 'daily' ? toDateKey(context.date) : context.date;
  const runSeed = context.mode === 'daily'
    ? (context.seed || createDailySeed(resolvedDate!))
    : (context.seed || String(Date.now()));

  return {
    runSeed,
    resolvedDate,
    input: {
      floor: 1,
      seed: runSeed,
      options: {
        gridWidth: context.mapSize?.width,
        gridHeight: context.mapSize?.height,
        mapShape: context.mapShape,
        generationSpec: context.generationSpec,
        generationState: createGenerationState(runSeed, context.generationSpec)
      }
    }
  };
};

const buildPendingFloorSessionInput = (
  context: TransitionCompileContext
): CompilerSessionInput => {
  const advancedGenerationState = advanceGenerationStateFromCompletedFloor({
    floor: context.floor - 1,
    turnsSpent: context.playerCarryover.turnsSpent || 0,
    hazardBreaches: context.playerCarryover.hazardBreaches || 0,
    kills: context.playerCarryover.kills || 0,
    combatScoreEvents: (context.playerCarryover.combatScoreEvents || []) as any,
    player: {
      id: 'player',
      type: 'player',
      position: createHex(0, 0),
      hp: context.playerCarryover.hp,
      maxHp: context.playerCarryover.maxHp,
      speed: 1,
      factionId: 'player',
      statusEffects: [],
      temporaryArmor: 0,
      activeSkills: [],
      components: new Map()
    },
    runTelemetry: context.runTelemetry,
    generationState: context.generationState
  });

  return {
    floor: context.floor,
    seed: `${advancedGenerationState.runSeed}:${context.floor}`,
    options: {
      gridWidth: context.mapSize.width,
      gridHeight: context.mapSize.height,
      mapShape: context.mapShape,
      generationSpec: advancedGenerationState.spec,
      generationState: advancedGenerationState
    }
  };
};

const runSessionToArtifact = (
  requestId: string,
  input: CompilerSessionInput
) => {
  const session = createCompilerSession(input);
  while (!session.isComplete()) {
    const step = session.step(1);
    workerScope.postMessage({
      type: 'PROGRESS',
      requestId,
      progress: step.progress
    } satisfies WorldgenWorkerResponse);
  }
  const result = session.getResult();
  if (!result) {
    throw new Error('World compiler session completed without a result.');
  }
  if (result.failure) {
    throw new Error(result.failure.diagnostics[0] || result.failure.code);
  }
  return result;
};

workerScope.onmessage = (event: MessageEvent<WorldgenWorkerRequest>) => {
  const message = event.data;
  if (!message) return;

  if (message.type === 'BOOT') {
    emitBoot();
    return;
  }

  if (bootError) {
    workerScope.postMessage({
      type: 'COMPILE_ERROR',
      requestId: 'requestId' in message ? message.requestId : undefined,
      error: bootError.message
    } satisfies WorldgenWorkerResponse);
    return;
  }

  try {
    if (message.type === 'COMPILE_RUN_START') {
      const { input, runSeed, resolvedDate } = buildStartRunSessionInput(message.payload);
      const result = runSessionToArtifact(message.requestId, input);
      postCompileOk(message.requestId, {
        ...result.artifact,
        mode: 'start_run',
        runSeed,
        loadoutId: message.payload.loadoutId,
        runMode: message.payload.mode || 'normal',
        runDate: resolvedDate,
        rulesetOverrides: message.payload.rulesetOverrides,
        ...(message.payload.includeDebug ? {} : { debugSnapshot: undefined })
      });
      return;
    }
    if (message.type === 'COMPILE_PENDING_FLOOR') {
      const result = runSessionToArtifact(message.requestId, buildPendingFloorSessionInput(message.payload));
      postCompileOk(message.requestId, {
        ...result.artifact,
        mode: 'floor_transition',
        ...(message.payload.includeDebug ? {} : { debugSnapshot: undefined })
      });
    }
  } catch (error) {
    workerScope.postMessage({
      type: 'COMPILE_ERROR',
      requestId: 'requestId' in message ? message.requestId : undefined,
      error: error instanceof Error ? error.message : 'Worldgen compile failed'
    } satisfies WorldgenWorkerResponse);
  }
};
