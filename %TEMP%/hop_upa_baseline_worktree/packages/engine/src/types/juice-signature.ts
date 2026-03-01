import type { Point } from '../types';
import type { JuiceEffectID } from './registry';

export type WorldPoint = { x: number; y: number };

export type JuiceProtocolVersion = 'juice-signature/v1';

export type JuicePrimitiveFamily =
    | 'movement'
    | 'attack'
    | 'status'
    | 'environment'
    | 'ui';

export type JuicePrimitiveType =
    | 'slide'
    | 'dash'
    | 'leap'
    | 'blink'
    | 'strike'
    | 'shoot'
    | 'blast'
    | 'pulse'
    | 'collision'
    | 'status_apply'
    | 'status_tick'
    | 'state_fade'
    | 'hazard_tick'
    | 'hazard_burst'
    | 'trap_trigger'
    | 'pickup'
    | 'spawn'
    | 'despawn'
    | 'text'
    | 'shake'
    | 'freeze';

export type JuicePhase =
    | 'telegraph'
    | 'anticipation'
    | 'travel'
    | 'impact'
    | 'aftermath'
    | 'instant';

export type JuiceElement =
    | 'physical'
    | 'kinetic'
    | 'fire'
    | 'arcane'
    | 'void'
    | 'poison'
    | 'holy'
    | 'shadow'
    | 'neutral';

export type JuiceIntensity = 'low' | 'medium' | 'high' | 'extreme';

export type JuiceAnchor = {
    actorId?: string;
    hex?: Point;
    world?: WorldPoint;
};

export type JuiceAreaShape =
    | { kind: 'hex'; center: Point }
    | { kind: 'ring'; center: Point; radius: number }
    | { kind: 'line'; from: Point; to: Point }
    | { kind: 'path'; points: Point[] }
    | { kind: 'cluster'; points: Point[] };

export type JuiceCameraCue = {
    shake?: JuiceIntensity;
    kick?: 'none' | 'light' | 'medium' | 'heavy';
    freezeMs?: number;
};

export type JuiceTimingCue = {
    delayMs?: number;
    durationMs?: number;
    ttlMs?: number;
};

export type JuiceFlags = {
    lethal?: boolean;
    blocked?: boolean;
    crit?: boolean;
    preview?: boolean;
    persistent?: boolean;
    hiddenSource?: boolean;
};

export type JuiceMeta = {
    skillId?: string;
    sourceId?: string;
    targetId?: string;
    reason?: string;
    statusId?: string;
    turnNumber?: number;
    stackTick?: number;
    sequenceId?: string;
    legacyJuiceId?: JuiceEffectID | string;
    legacyMirrored?: boolean;
};

export interface JuiceSignaturePayloadV1 {
    protocol: JuiceProtocolVersion;
    signature: string;
    family: JuicePrimitiveFamily;
    primitive: JuicePrimitiveType;
    phase: JuicePhase;

    element?: JuiceElement;
    variant?: string;
    intensity?: JuiceIntensity;

    source?: JuiceAnchor;
    target?: JuiceAnchor;
    contact?: JuiceAnchor;

    area?: JuiceAreaShape;
    direction?: Point;
    path?: Point[];

    text?: {
        value: string;
        tone?: 'damage' | 'heal' | 'status' | 'system';
        color?: string;
    };

    camera?: JuiceCameraCue;
    timing?: JuiceTimingCue;
    flags?: JuiceFlags;
    meta?: JuiceMeta;
}

export type JuiceAnchorRef =
    | { kind: 'source_actor' }
    | { kind: 'target_actor' }
    | { kind: 'source_hex' }
    | { kind: 'target_hex' }
    | { kind: 'contact_hex' }
    | { kind: 'contact_world' }
    | { kind: 'custom_hex'; hex: Point }
    | { kind: 'custom_world'; world: WorldPoint };

export type JuiceSignatureTemplate = Omit<
    JuiceSignaturePayloadV1,
    'protocol' | 'source' | 'target' | 'contact' | 'meta'
> & {
    sourceRef?: JuiceAnchorRef;
    targetRef?: JuiceAnchorRef;
    contactRef?: JuiceAnchorRef;
};

export type EmitJuiceSignatureParams = {
    template: JuiceSignatureTemplate;
    sourceId?: string;
    targetId?: string;
    skillId?: string;
    reason?: string;

    sourceHex?: Point;
    targetHex?: Point;
    contactHex?: Point;
    contactWorld?: WorldPoint;
    path?: Point[];
    direction?: Point;

    phase?: JuicePhase;
    sequenceId?: string;
    intensity?: JuiceIntensity;
    text?: JuiceSignaturePayloadV1['text'];
    flags?: JuiceFlags;
    timing?: JuiceTimingCue;
    camera?: JuiceCameraCue;
    area?: JuiceAreaShape;
    variant?: string;
    element?: JuiceElement;
    signature?: string;
    meta?: Partial<JuiceMeta>;
};
