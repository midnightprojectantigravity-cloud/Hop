/**
 * Safe serialization helpers for ActionLog / Replay export.
 * Handles BigInt and other non-JSON types by converting them to strings with markers,
 * and provides a companion parse function to restore them when importing.
 */
import type { GameState } from '../types';

const BIGINT_MARKER = '__BIGINT__:';
const MAP_MARKER = '__MAP__:';
const SET_MARKER = '__SET__:';

export const safeStringify = (value: any): string => {
    return JSON.stringify(value, (_key, val) => {
        if (typeof val === 'bigint') {
            return BIGINT_MARKER + val.toString();
        }
        if (val instanceof Map) {
            return { [MAP_MARKER]: Array.from(val.entries()) };
        }
        if (val instanceof Set) {
            return { [SET_MARKER]: Array.from(val.values()) };
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
        if (val && typeof val === 'object') {
            if (val[MAP_MARKER]) return new Map(val[MAP_MARKER]);
            if (val[SET_MARKER]) return new Set(val[SET_MARKER]);
            if (Object.keys(val).length === 1 && val.__DATE__) {
                return new Date(val.__DATE__);
            }
        }
        return val;
    });
};

/**
 * Converts GameState to a plain JSON-friendly object for debugging/logging.
 * Recursively converts Maps to Objects and Sets to Arrays.
 */
export const gameStateToJSON = (val: any): any => {
    if (val instanceof Map) {
        const obj: any = {};
        for (const [k, v] of val.entries()) {
            obj[k] = gameStateToJSON(v);
        }
        return obj;
    }
    if (val instanceof Set) {
        return Array.from(val).map(gameStateToJSON);
    }
    if (Array.isArray(val)) {
        return val.map(gameStateToJSON);
    }
    if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
        const obj: any = {};
        for (const k in val) {
            obj[k] = gameStateToJSON(val[k]);
        }
        return obj;
    }
    return val;
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
    gameStateToJSON,
    serializeActionLogForExport,
    parseImportedActionLog,
};
