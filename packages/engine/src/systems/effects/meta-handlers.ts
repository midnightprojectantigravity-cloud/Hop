import { tagMessage } from '../engine-messages';
import type { AtomicEffectHandlerMap } from './types';

export const metaEffectHandlers: AtomicEffectHandlerMap = {
    Message: (state, effect, _context, api) => {
        let nextState = state;
        nextState.message = [...nextState.message, tagMessage(effect.text, 'INFO', 'SYSTEM')].slice(-50);
        nextState = api.appendSimulationEvent(nextState, {
            type: 'MessageLogged',
            payload: { text: effect.text }
        });
        return nextState;
    },
    GameOver: (state) => ({
        ...state,
        gameStatus: 'lost'
    })
};
