import type { JuiceEffect } from './juice-types';
import { getEffectLifetimeMs } from './juice-manager-utils';

export const resolveNextCleanupDelayMs = (effects: JuiceEffect[], now: number): number => {
    let nextExpiryMs = Infinity;
    for (const effect of effects) {
        if (effect.startTime > now) {
            const untilStart = effect.startTime - now;
            if (untilStart > 0 && untilStart < nextExpiryMs) {
                nextExpiryMs = untilStart;
            }
            continue;
        }
        const age = now - effect.startTime;
        const remaining = getEffectLifetimeMs(effect) - age;
        if (remaining > 0 && remaining < nextExpiryMs) {
            nextExpiryMs = remaining;
        }
    }
    return nextExpiryMs;
};

