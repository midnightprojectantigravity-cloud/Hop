import type {
    Point,
    SynapseThreatPreview,
    UnifiedPowerScoreEntry
} from '@hop/engine';

export type SynapseSelection =
    | { mode: 'empty' }
    | { mode: 'tile'; tile: Point }
    | { mode: 'entity'; actorId: string };

export type SynapsePulse = {
    actorId: string;
    token: number;
} | null;

export const EMPTY_SYNAPSE_SELECTION: SynapseSelection = { mode: 'empty' };
export const DELTA_VISUAL_THRESHOLD = 5;
export const SYNAPSE_PULSE_DURATION_MS = 900;

export interface SynapseDeltaEntry {
    upsDelta: number;
    stateDelta: number;
}

export type SynapseDeltaDirection = 'up' | 'down' | 'none';

export type SynapseScoreSnapshot = Record<string, {
    ups: number;
    stateScore: number;
}>;

export const resolveSynapsePreview = (
    preview: { synapse?: SynapseThreatPreview } | undefined
): SynapseThreatPreview | null => preview?.synapse || null;

export const buildSynapseScoreSnapshot = (
    unitScores: UnifiedPowerScoreEntry[]
): SynapseScoreSnapshot => {
    const snapshot: SynapseScoreSnapshot = {};
    for (const score of unitScores) {
        snapshot[score.actorId] = {
            ups: Number(score.ups || 0),
            stateScore: Number(score.stateScore || 0)
        };
    }
    return snapshot;
};

export const buildSynapseDeltaMap = (
    previous: SynapseScoreSnapshot | null,
    current: SynapseScoreSnapshot
): Record<string, SynapseDeltaEntry> => {
    const deltas: Record<string, SynapseDeltaEntry> = {};
    for (const actorId of Object.keys(current)) {
        const cur = current[actorId];
        const prev = previous?.[actorId];
        deltas[actorId] = {
            upsDelta: prev ? (cur.ups - prev.ups) : 0,
            stateDelta: prev ? Number((cur.stateScore - prev.stateScore).toFixed(4)) : 0
        };
    }
    return deltas;
};

export const resolveSynapseDeltaDirection = (
    delta: number,
    threshold: number = DELTA_VISUAL_THRESHOLD
): SynapseDeltaDirection => {
    if (delta >= threshold) return 'up';
    if (delta <= -threshold) return 'down';
    return 'none';
};
