import type { Actor, GameState, Point, VisualEvent } from '../../types';
import { TILE_SIZE } from '../../constants';
import { getDirectionFromTo, hexDistance, hexToPixel } from '../../hex';
import type {
    EmitJuiceSignatureParams,
    JuiceAnchor,
    JuiceAnchorRef,
    JuiceElement,
    JuiceIntensity,
    JuicePhase,
    JuiceSignaturePayloadV1,
    JuiceSignatureTemplate,
    WorldPoint
} from '../../types/juice-signature';
import type { JuiceEffectID } from '../../types/registry';

const SQRT3 = Math.sqrt(3);

const resolveActorById = (state: GameState, actorId?: string): Actor | undefined => {
    if (!actorId) return undefined;
    if (state.player.id === actorId) return state.player;
    return state.enemies.find(e => e.id === actorId) || state.companions?.find(e => e.id === actorId);
};

const makeAnchorFromActor = (actor?: Actor): JuiceAnchor | undefined => {
    if (!actor) return undefined;
    return {
        actorId: actor.id,
        hex: actor.position
    };
};

export const getHexEdgeContactWorld = (
    fromHex?: Point,
    toHex?: Point,
    size: number = TILE_SIZE
): WorldPoint | undefined => {
    if (!fromHex || !toHex) return undefined;
    if (hexDistance(fromHex, toHex) !== 1) return undefined;

    const dir = getDirectionFromTo(fromHex, toHex);
    if (dir < 0) return undefined;

    const from = hexToPixel(fromHex, size);
    const edgeOffsets: WorldPoint[] = [
        { x: size, y: 0 },
        { x: size / 2, y: -(SQRT3 * size) / 2 },
        { x: -size / 2, y: -(SQRT3 * size) / 2 },
        { x: -size, y: 0 },
        { x: -size / 2, y: (SQRT3 * size) / 2 },
        { x: size / 2, y: (SQRT3 * size) / 2 }
    ];
    const offset = edgeOffsets[dir];
    return offset ? { x: from.x + offset.x, y: from.y + offset.y } : undefined;
};

export const resolveJuiceAnchor = (
    state: GameState,
    params: EmitJuiceSignatureParams,
    ref?: JuiceAnchorRef
): JuiceAnchor | undefined => {
    if (!ref) return undefined;

    switch (ref.kind) {
        case 'source_actor':
            return makeAnchorFromActor(resolveActorById(state, params.sourceId));
        case 'target_actor':
            return makeAnchorFromActor(resolveActorById(state, params.targetId));
        case 'source_hex':
            return params.sourceHex ? { hex: params.sourceHex } : undefined;
        case 'target_hex':
            return params.targetHex ? { hex: params.targetHex } : undefined;
        case 'contact_hex':
            return params.contactHex ? { hex: params.contactHex } : undefined;
        case 'contact_world':
            if (!params.contactWorld && !params.contactHex) return undefined;
            return {
                world: params.contactWorld,
                hex: params.contactHex
            };
        case 'custom_hex':
            return { hex: ref.hex };
        case 'custom_world':
            return { world: ref.world };
        default:
            return undefined;
    }
};

export const buildJuiceSequenceId = (
    state: GameState,
    params: { sourceId?: string; skillId?: string; phase?: JuicePhase; salt?: string }
): string => {
    const turn = state.turnNumber || 0;
    const stackTick = state.stackTrace?.length || 0;
    const src = params.sourceId || 'env';
    const skill = params.skillId || 'none';
    const phase = params.phase || 'instant';
    const salt = params.salt ? `.${params.salt}` : '';
    return `t${turn}.k${stackTick}.${src}.${skill}.${phase}${salt}`;
};

const INTENSITY_ORDER: JuiceIntensity[] = ['low', 'medium', 'high', 'extreme'];

export const deriveJuiceIntensity = (
    base: JuiceIntensity = 'medium',
    context: { momentum?: number; lethal?: boolean; blocked?: boolean; massDelta?: number } = {}
): JuiceIntensity => {
    if (context.lethal) return 'extreme';
    let idx = INTENSITY_ORDER.indexOf(base);
    if (idx < 0) idx = 1;

    if ((context.momentum || 0) >= 4 || (context.massDelta || 0) >= 4) {
        idx = Math.min(INTENSITY_ORDER.length - 1, idx + 1);
    }
    if (context.blocked && idx < 2) {
        idx = 2;
    }

    return INTENSITY_ORDER[idx];
};

const inferElementFromLegacyJuiceId = (effectId: JuiceEffectID): JuiceElement => {
    const id = String(effectId).toLowerCase();
    if (id.includes('fire') || id.includes('lava') || id.includes('explosion')) return 'fire';
    if (id.includes('kinetic') || id.includes('momentum') || id.includes('wallcrack')) return 'kinetic';
    if (id.includes('void')) return 'void';
    if (id.includes('arcane')) return 'arcane';
    if (id.includes('hidden') || id.includes('shadow')) return 'shadow';
    return 'neutral';
};

export const getLegacyJuiceSignatureTemplate = (
    effectId: JuiceEffectID,
    options: { color?: string; text?: string } = {}
): JuiceSignatureTemplate => {
    const element = inferElementFromLegacyJuiceId(effectId);

    const base: JuiceSignatureTemplate = {
        signature: `UI.SPAWN.${element.toUpperCase()}.${String(effectId).toUpperCase()}`,
        family: 'ui',
        primitive: 'spawn',
        phase: 'instant',
        element,
        variant: effectId,
        intensity: 'medium'
    };

    switch (effectId) {
        case 'impact':
            return {
                ...base,
                signature: 'ATK.STRIKE.PHYSICAL.IMPACT',
                family: 'attack',
                primitive: 'strike',
                phase: 'impact',
                element: 'physical',
                variant: 'impact',
                targetRef: { kind: 'target_hex' },
                contactRef: { kind: 'contact_world' }
            };
        case 'flash':
            return {
                ...base,
                signature: `ATK.BLAST.${(options.color ? 'ARCANE' : 'NEUTRAL')}.FLASH`,
                family: 'attack',
                primitive: 'blast',
                phase: 'impact',
                element: options.color ? 'arcane' : 'neutral',
                variant: 'flash',
                targetRef: { kind: 'target_hex' }
            };
        case 'spearTrail':
            return {
                ...base,
                signature: 'ATK.SHOOT.PHYSICAL.SPEAR_TRAIL',
                family: 'attack',
                primitive: 'shoot',
                phase: 'travel',
                element: 'physical',
                variant: 'spear',
                sourceRef: { kind: 'source_hex' },
                targetRef: { kind: 'target_hex' }
            };
        case 'explosion_ring':
            return {
                ...base,
                signature: 'ATK.BLAST.FIRE.EXPLOSION_RING',
                family: 'attack',
                primitive: 'blast',
                phase: 'impact',
                element: 'fire',
                variant: 'explosion_ring',
                targetRef: { kind: 'target_hex' },
                intensity: 'high'
            };
        case 'lavaRipple':
            return {
                ...base,
                signature: 'ENV.HAZARD.FIRE.LAVA_RIPPLE',
                family: 'environment',
                primitive: 'hazard_burst',
                phase: 'impact',
                element: 'fire',
                variant: 'lava_ripple',
                targetRef: { kind: 'target_hex' }
            };
        case 'lavaSink':
            return {
                ...base,
                signature: 'ENV.HAZARD.FIRE.SINK',
                family: 'environment',
                primitive: 'hazard_burst',
                phase: 'impact',
                element: 'fire',
                variant: 'lava_sink',
                targetRef: { kind: 'target_hex' },
                intensity: 'high'
            };
        case 'wallCrack':
            return {
                ...base,
                signature: 'ENV.COLLISION.KINETIC.WALL_CRACK',
                family: 'environment',
                primitive: 'collision',
                phase: 'impact',
                element: 'kinetic',
                variant: 'wall_crack',
                contactRef: { kind: 'contact_world' },
                targetRef: { kind: 'target_hex' },
                intensity: 'high'
            };
        case 'kineticWave':
            return {
                ...base,
                signature: 'ATK.PULSE.KINETIC.WAVE',
                family: 'attack',
                primitive: 'pulse',
                phase: 'impact',
                element: 'kinetic',
                variant: 'kinetic_wave',
                targetRef: { kind: 'target_hex' }
            };
        case 'dashBlur':
            return {
                ...base,
                signature: 'MOVE.DASH.NEUTRAL.BLUR',
                family: 'movement',
                primitive: 'dash',
                phase: 'travel',
                element: 'neutral',
                variant: 'dash_blur',
                sourceRef: { kind: 'source_hex' },
                targetRef: { kind: 'target_hex' }
            };
        case 'hiddenFade':
            return {
                ...base,
                signature: 'STATE.FADE.SHADOW.HIDDEN',
                family: 'status',
                primitive: 'state_fade',
                phase: 'instant',
                element: 'shadow',
                variant: 'hidden_fade',
                targetRef: { kind: 'target_hex' }
            };
        case 'combat_text':
            return {
                ...base,
                signature: 'UI.TEXT.NEUTRAL.POPUP',
                family: 'ui',
                primitive: 'text',
                phase: 'instant',
                element: 'neutral',
                variant: 'combat_text',
                targetRef: { kind: 'target_hex' }
            };
        case 'shake':
            return {
                ...base,
                signature: 'UI.SHAKE.NEUTRAL.CAMERA',
                family: 'ui',
                primitive: 'shake',
                phase: 'instant',
                element: 'neutral',
                variant: 'camera_shake'
            };
        case 'freeze':
            return {
                ...base,
                signature: 'UI.FREEZE.NEUTRAL.HITSTOP',
                family: 'ui',
                primitive: 'freeze',
                phase: 'instant',
                element: 'neutral',
                variant: 'freeze'
            };
        case 'stunBurst':
            return {
                ...base,
                signature: 'STATE.APPLY.NEUTRAL.STUN_BURST',
                family: 'status',
                primitive: 'status_apply',
                phase: 'impact',
                element: 'neutral',
                variant: 'stun_burst',
                targetRef: { kind: 'target_hex' }
            };
        default:
            return {
                ...base,
                signature: `UI.SPAWN.${element.toUpperCase()}.${String(effectId).toUpperCase()}`,
                variant: String(effectId).toLowerCase()
            };
    }
};

export const createJuiceSignatureEvent = (
    state: GameState,
    params: EmitJuiceSignatureParams
): { type: 'juice_signature'; payload: JuiceSignaturePayloadV1 } => {
    const t = params.template;
    const phase = params.phase || t.phase || 'instant';
    const sequenceId = params.sequenceId || buildJuiceSequenceId(state, {
        sourceId: params.sourceId,
        skillId: params.skillId,
        phase
    });
    const source = resolveJuiceAnchor(state, params, t.sourceRef);
    const target = resolveJuiceAnchor(state, params, t.targetRef);
    const contact = resolveJuiceAnchor(state, params, t.contactRef);

    const payload: JuiceSignaturePayloadV1 = {
        protocol: 'juice-signature/v1',
        signature: params.signature || t.signature,
        family: t.family,
        primitive: t.primitive,
        phase,
        element: params.element || t.element,
        variant: params.variant || t.variant,
        intensity: params.intensity || t.intensity,
        source,
        target,
        contact,
        area: params.area || t.area,
        direction: params.direction || t.direction,
        path: params.path || t.path,
        text: params.text || t.text,
        camera: params.camera || t.camera,
        timing: params.timing || t.timing,
        flags: { ...(t.flags || {}), ...(params.flags || {}) },
        meta: {
            turnNumber: state.turnNumber || 0,
            stackTick: state.stackTrace?.length || 0,
            sequenceId,
            sourceId: params.sourceId,
            targetId: params.targetId,
            skillId: params.skillId,
            reason: params.reason,
            ...(params.meta || {})
        }
    };

    if (payload.flags && Object.keys(payload.flags).length === 0) delete payload.flags;
    if (payload.meta && Object.keys(payload.meta).length === 0) delete payload.meta;

    return { type: 'juice_signature', payload };
};

export const appendJuiceSignature = (state: GameState, params: EmitJuiceSignatureParams): GameState => {
    const event = createJuiceSignatureEvent(state, params) as VisualEvent;
    return {
        ...state,
        visualEvents: [...(state.visualEvents || []), event]
    };
};
