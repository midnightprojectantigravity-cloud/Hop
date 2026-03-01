import { generateInitialState, gameReducer, fingerprintFromState } from '../src/logic';
import type { Action } from '../src/types';

const originalLog = console.log.bind(console);
if (process.env.VERBOSE_ANALYSIS !== '1') {
    console.log = () => undefined;
    console.warn = () => undefined;
}

const seed = process.argv[2] || 'mvp-replay-gate-seed';
const floor = Number(process.argv[3] || 1);

const replayActions: Action[] = [
    { type: 'WAIT' },
    { type: 'ADVANCE_TURN' },
    { type: 'WAIT' },
    { type: 'ADVANCE_TURN' },
    { type: 'WAIT' },
    { type: 'ADVANCE_TURN' }
];

const run = (): string => {
    let state = generateInitialState(floor, seed, seed);
    for (const action of replayActions) {
        state = gameReducer(state, action);
    }
    return fingerprintFromState(state);
};

const left = run();
const right = run();
const ok = left === right;

originalLog(JSON.stringify({
    seed,
    floor,
    actions: replayActions.length,
    ok,
    left,
    right
}, null, 2));

if (!ok) {
    process.exitCode = 2;
}
