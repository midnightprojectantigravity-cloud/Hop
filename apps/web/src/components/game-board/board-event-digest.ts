import type { GameState, Point, SimulationEvent, TimelineEvent } from '@hop/engine';
import type { JuiceSignaturePayloadV1 } from '@hop/engine';
import { recordDebugPerfCounter } from '../../app/perf/debug-perf-runtime';
import { collectCameraCuePlan, type CameraCuePlan } from './board-juice-camera-cues';

type VisualEvent = NonNullable<GameState['visualEvents']>[number];

export interface BoardEventDigest {
  visualEventsRef: ReadonlyArray<VisualEvent>;
  timelineEventsRef: ReadonlyArray<TimelineEvent>;
  simulationEventsRef: ReadonlyArray<SimulationEvent>;
  visualEventsSignature: string;
  timelineEventsSignature: string;
  simulationEventsSignature: string;
  signatureVisualEvents: ReadonlyArray<VisualEvent>;
  legacyVfxVisualEvents: ReadonlyArray<VisualEvent>;
  movementTraceEvents: ReadonlyArray<VisualEvent>;
  timelineDeathEvents: ReadonlyArray<{ id: string; position: Point }>;
  deathDecalVisualEvents: ReadonlyArray<{ id: string; position: Point }>;
  damageSimulationEvents: ReadonlyArray<SimulationEvent>;
  simulationPoseEvents: ReadonlyArray<SimulationEvent>;
  cameraCuePlan: CameraCuePlan;
  juiceDebugPayloads: ReadonlyArray<{
    sequenceId: string;
    signature: string;
    phase: string;
    primitive: string;
    index: number;
  }>;
}

const stableSerialize = (value: unknown): string => {
  if (value === null) return 'null';
  const valueType = typeof value;
  if (valueType === 'string') return JSON.stringify(value);
  if (valueType === 'number' || valueType === 'boolean') return String(value);
  if (valueType === 'bigint') return `${(value as bigint).toString()}n`;
  if (valueType === 'undefined') return 'undefined';
  if (valueType === 'function') return '[Function]';
  if (Array.isArray(value)) {
    return `[${value.map(item => stableSerialize(item)).join(',')}]`;
  }
  if (value instanceof Date) {
    return `Date(${value.toISOString()})`;
  }
  if (value instanceof Set) {
    return `Set(${Array.from(value).map(item => stableSerialize(item)).join(',')})`;
  }
  if (value instanceof Map) {
    return `Map(${Array.from(value.entries()).map(([key, entryValue]) => `${stableSerialize(key)}=>${stableSerialize(entryValue)}`).join(',')})`;
  }
  if (valueType === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((key) => {
      const entryValue = obj[key];
      return `${JSON.stringify(key)}:${stableSerialize(entryValue)}`;
    }).join(',')}}`;
  }
  return String(value);
};

const resolveEventPoint = (payload: any): Point | null => {
  if (!payload) return null;
  const point = payload.position || payload.destination || payload.origin || payload.target;
  if (point && typeof point.q === 'number' && typeof point.r === 'number' && typeof point.s === 'number') {
    return point;
  }
  return null;
};

export const buildBoardEventDigest = ({
  visualEvents = [],
  timelineEvents = [],
  simulationEvents = [],
}: {
  visualEvents?: ReadonlyArray<VisualEvent>;
  timelineEvents?: ReadonlyArray<TimelineEvent>;
  simulationEvents?: ReadonlyArray<SimulationEvent>;
}): BoardEventDigest => {
  recordDebugPerfCounter('eventDigestBuildCount');
  const visualEventsSignature = stableSerialize(visualEvents);
  const timelineEventsSignature = stableSerialize(timelineEvents);
  const simulationEventsSignature = stableSerialize(simulationEvents);

  const signatureVisualEvents: VisualEvent[] = [];
  const legacyVfxVisualEvents: VisualEvent[] = [];
  const movementTraceEvents: VisualEvent[] = [];
  const timelineDeathEvents: Array<{ id: string; position: Point }> = [];
  const deathDecalVisualEvents: Array<{ id: string; position: Point }> = [];
  const damageSimulationEvents: SimulationEvent[] = [];
  const simulationPoseEvents: SimulationEvent[] = [];
  const cameraCueVisualEvents: VisualEvent[] = [];
  const juiceDebugPayloads: Array<{
    sequenceId: string;
    signature: string;
    phase: string;
    primitive: string;
    index: number;
  }> = [];

  for (let i = 0; i < visualEvents.length; i++) {
    const event = visualEvents[i]!;
    if (event.type === 'juice_signature') {
      signatureVisualEvents.push(event);
      cameraCueVisualEvents.push(event);
      const payload = event.payload as JuiceSignaturePayloadV1 | undefined;
      if (payload?.protocol === 'juice-signature/v1') {
        juiceDebugPayloads.push({
          sequenceId: payload.meta?.sequenceId || `seq-missing-${i}`,
          signature: payload.signature,
          phase: payload.phase,
          primitive: payload.primitive,
          index: i,
        });
      }
      continue;
    }

    if (event.type === 'shake' || event.type === 'freeze') {
      cameraCueVisualEvents.push(event);
    }
    if (event.type === 'kinetic_trace') {
      movementTraceEvents.push(event);
    }
    if (event.type === 'vfx') {
      const vfxType = event.payload?.type;
      if (
        vfxType === 'impact'
        || vfxType === 'flash'
        || vfxType === 'spear_trail'
        || vfxType === 'vaporize'
        || vfxType === 'lava_ripple'
        || vfxType === 'explosion_ring'
      ) {
        legacyVfxVisualEvents.push(event);
      }
      if (vfxType === 'vaporize' || vfxType === 'explosion_ring') {
        const point = resolveEventPoint(event.payload);
        if (point) {
          deathDecalVisualEvents.push({
            id: `${vfxType}-${i}`,
            position: point,
          });
        }
      }
    }
  }

  for (const timelineEvent of timelineEvents) {
    if (timelineEvent.phase !== 'DEATH_RESOLVE') continue;
    const point = resolveEventPoint(timelineEvent.payload);
    if (!point) continue;
    timelineDeathEvents.push({
      id: timelineEvent.id,
      position: point,
    });
  }

  for (const simulationEvent of simulationEvents) {
    if (simulationEvent.type === 'DamageTaken') {
      damageSimulationEvents.push(simulationEvent);
      simulationPoseEvents.push(simulationEvent);
      continue;
    }
    if (simulationEvent.type === 'RestTriggered') {
      simulationPoseEvents.push(simulationEvent);
    }
  }

  return {
    visualEventsRef: visualEvents,
    timelineEventsRef: timelineEvents,
    simulationEventsRef: simulationEvents,
    visualEventsSignature,
    timelineEventsSignature,
    simulationEventsSignature,
    signatureVisualEvents,
    legacyVfxVisualEvents,
    movementTraceEvents,
    timelineDeathEvents,
    deathDecalVisualEvents,
    damageSimulationEvents,
    simulationPoseEvents,
    cameraCuePlan: collectCameraCuePlan(cameraCueVisualEvents),
    juiceDebugPayloads,
  };
};
