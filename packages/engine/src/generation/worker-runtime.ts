import type {
    CompiledFloorArtifact,
    CompilerProgress,
    CompilerSession as EngineCompilerSession,
    CompilerSessionInput,
    CompilerSessionResult,
    CompilerStepResult,
    GenerationMapShape,
    StartRunCompileContext,
    TransitionCompileContext
} from './schema';
import type { GameState } from '../types';
import { ENGINE_CONTRACT_VERSION } from '../contract-version';
import { createHex } from '../hex';
import { createDailySeed, toDateKey } from '../systems/run-objectives';
import { createCompilerSession } from './session';
import { advanceGenerationStateFromCompletedFloor, createGenerationState } from './telemetry';
import './compiler';

export const WORLDGEN_RUNTIME_API_VERSION = 'worldgen-worker-runtime-v1';

export interface WorldgenRuntimeInfo {
    contractVersion: string;
    runtimeApiVersion: string;
}

export interface WorldgenCompileSession {
    isComplete(): boolean;
    step(maxOps?: number): CompilerStepResult;
    getProgress(): CompilerProgress;
    getResult(): CompilerSessionResult | undefined;
}

type ArtifactDecorator = (artifact: CompiledFloorArtifact) => CompiledFloorArtifact;

class DecoratedWorldgenCompileSession implements WorldgenCompileSession {
    private readonly session: EngineCompilerSession;

    private readonly decorateArtifact: ArtifactDecorator;

    constructor(session: EngineCompilerSession, decorateArtifact: ArtifactDecorator) {
        this.session = session;
        this.decorateArtifact = decorateArtifact;
    }

    isComplete(): boolean {
        return this.session.isComplete();
    }

    step(maxOps?: number): CompilerStepResult {
        return this.session.step(maxOps);
    }

    getProgress(): CompilerProgress {
        return this.session.getProgress();
    }

    getResult(): CompilerSessionResult | undefined {
        const result = this.session.getResult();
        if (!result) return undefined;
        return {
            ...result,
            artifact: this.decorateArtifact(result.artifact)
        };
    }
}

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
                mapShape: context.mapShape as GenerationMapShape | undefined,
                theme: context.themeId,
                contentTheme: context.contentThemeId || context.themeId,
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
        combatScoreEvents: (context.playerCarryover.combatScoreEvents || []) as GameState['combatScoreEvents'],
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
            mapShape: context.mapShape as GenerationMapShape,
            theme: context.themeId,
            contentTheme: context.contentThemeId || context.themeId,
            generationSpec: advancedGenerationState.spec,
            generationState: advancedGenerationState
        }
    };
};

export const initializeWorldgenRuntime = (): WorldgenRuntimeInfo => ({
    contractVersion: ENGINE_CONTRACT_VERSION,
    runtimeApiVersion: WORLDGEN_RUNTIME_API_VERSION
});

export const createStartRunCompileSession = (
    context: StartRunCompileContext
): WorldgenCompileSession => {
    const { input, runSeed, resolvedDate } = buildStartRunSessionInput(context);
    const session = createCompilerSession(input);
    return new DecoratedWorldgenCompileSession(session, (artifact) => ({
        ...artifact,
        mode: 'start_run',
        runSeed,
        loadoutId: context.loadoutId,
        runMode: context.mode || 'normal',
        runDate: resolvedDate,
        rulesetOverrides: context.rulesetOverrides,
        ...(context.includeDebug ? {} : { debugSnapshot: undefined })
    }));
};

export const createPendingFloorCompileSession = (
    context: TransitionCompileContext
): WorldgenCompileSession => {
    const session = createCompilerSession(buildPendingFloorSessionInput(context));
    return new DecoratedWorldgenCompileSession(session, (artifact) => ({
        ...artifact,
        mode: 'floor_transition',
        ...(context.includeDebug ? {} : { debugSnapshot: undefined })
    }));
};
