import type {
    CompilerBudgetProfile,
    CompilerPass,
    CompilerProgress,
    CompilerSession as CompilerSessionContract,
    CompilerSessionInput,
    CompilerSessionResult,
    CompilerSessionState,
    CompilerStepResult,
    GenerationDebugSnapshot
} from './schema';

const PASS_ORDER: CompilerPass[] = [
    'normalizeSpec',
    'accumulateFloorTelemetry',
    'quantizeFloorOutcome',
    'updateRunDirectorState',
    'resolveFloorIntent',
    'resolveNarrativeSceneRequest',
    'buildTopologicalBlueprint',
    'reserveSpatialBudget',
    'emitPathProgram',
    'embedSpatialPlan',
    'resolveModulePlan',
    'registerSpatialClaims',
    'realizeArenaArtifact',
    'realizeSceneEvidence',
    'closeUnresolvedGaskets',
    'classifyPathLandmarks',
    'buildTacticalPathNetwork',
    'buildVisualPathNetwork',
    'verifyArenaArtifact',
    'finalizeGenerationState'
];

interface CompilerPassApi {
    initializeState: (input: CompilerSessionInput) => CompilerSessionState;
    runPass: (state: CompilerSessionState, pass: CompilerPass) => CompilerSessionState;
    getResult: (state: CompilerSessionState) => CompilerSessionResult | undefined;
    getDebugSnapshot: (state: CompilerSessionState) => GenerationDebugSnapshot | undefined;
}

let compilerPassApi: CompilerPassApi | null = null;

export const registerCompilerPassApi = (api: CompilerPassApi): void => {
    compilerPassApi = api;
};

export const createCompilerSession = (
    input: CompilerSessionInput,
    _budgetProfile?: CompilerBudgetProfile
): WorldCompilerSession => {
    if (!compilerPassApi) {
        throw new Error('World compiler pass API has not been registered.');
    }
    return new WorldCompilerSession(input, compilerPassApi);
};

export class WorldCompilerSession implements CompilerSessionContract {
    private passIndex = 0;

    private readonly stateApi: CompilerPassApi;

    private state: CompilerSessionState;

    constructor(input: CompilerSessionInput, stateApi: CompilerPassApi) {
        this.stateApi = stateApi;
        this.state = stateApi.initializeState(input);
    }

    isComplete(): boolean {
        return this.passIndex >= PASS_ORDER.length || !!this.stateApi.getResult(this.state);
    }

    getProgress(): CompilerProgress {
        if (this.isComplete()) {
            return {
                pass: PASS_ORDER[PASS_ORDER.length - 1]!,
                percent: 100
            };
        }

        const safeIndex = Math.min(this.passIndex, PASS_ORDER.length - 1);
        return {
            pass: PASS_ORDER[safeIndex]!,
            percent: Math.floor((this.passIndex / PASS_ORDER.length) * 100)
        };
    }

    step(maxOps: number = 1): CompilerStepResult {
        const ops = Math.max(1, Math.floor(maxOps));
        for (let i = 0; i < ops && !this.isComplete(); i += 1) {
            const pass = PASS_ORDER[this.passIndex]!;
            this.state = this.stateApi.runPass(this.state, pass);
            this.passIndex += 1;
            if (this.stateApi.getResult(this.state)) {
                this.passIndex = PASS_ORDER.length;
                break;
            }
        }

        const progress = this.getProgress();
        return {
            done: this.isComplete(),
            pass: progress.pass,
            progress
        };
    }

    getResult(): CompilerSessionResult | undefined {
        return this.stateApi.getResult(this.state);
    }

    getDebugSnapshot(): GenerationDebugSnapshot | undefined {
        return this.stateApi.getDebugSnapshot(this.state);
    }

    getState(): CompilerSessionState {
        return this.state;
    }
}
