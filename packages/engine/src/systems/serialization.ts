/**
 * Safe serialization helpers for ActionLog / Replay export.
 * Handles BigInt and other non-JSON types by converting them to strings with markers,
 * and provides a companion parse function to restore them when importing.
 */
import type { GameState } from '../types';

const BIGINT_MARKER = '__BIGINT__:';

export const safeStringify = (value: any): string => {
    return JSON.stringify(value, (_key, val) => {
        if (typeof val === 'bigint') {
            return BIGINT_MARKER + val.toString();
        }
        // Dates -> ISO
        if (val instanceof Date) return { __DATE__: val.toISOString() };
        return val;
    });
};

export const safeParse = (text: string): any => {
    return JSON.parse(text, (_key, val) => {
        if (typeof val === 'string' && val.startsWith(BIGINT_MARKER)) {
            try { return BigInt(val.slice(BIGINT_MARKER.length)); } catch { return val; }
        }
        if (val && typeof val === 'object' && Object.keys(val).length === 1 && val.__DATE__) {
            return new Date(val.__DATE__);
        }
        return val;
    });
};

export const serializeActionLogForExport = (state: GameState) => {
    return safeStringify({ actionLog: state.actionLog, meta: { seed: state.rngSeed, floor: state.floor } });
};

export const parseImportedActionLog = (text: string) => {
    return safeParse(text);
};

export default {
    safeStringify,
    safeParse,
    serializeActionLogForExport,
    parseImportedActionLog,
};
