import type { JuiceSignaturePayloadV1 } from '@hop/engine';
import {
    EXACT_SIGNATURE_PHASE_RECIPES,
    EXACT_SIGNATURE_RECIPES,
    FAMILY_PRIMITIVE_ELEMENT_PHASE_RECIPES,
    FAMILY_PRIMITIVE_PHASE_RECIPES,
    FAMILY_PRIMITIVE_RECIPES,
    type JuiceRecipe
} from './juice-library';

export interface ResolvedJuiceRecipe {
    key: string;
    ttlMs: number;
    recipe: JuiceRecipe;
    payload: JuiceSignaturePayloadV1;
}

export interface ResolveJuiceRecipeArgs {
    payload: JuiceSignaturePayloadV1;
    reducedMotion: boolean;
}

const legacyMirroredAllowed = new Set(['impact', 'flash', 'spearTrail', 'shake']);

const lookupRecipe = (payload: JuiceSignaturePayloadV1): { key: string; recipe: JuiceRecipe } => {
    const exactPhaseKey = `${payload.signature}|${payload.phase}`;
    const exactPhase = EXACT_SIGNATURE_PHASE_RECIPES[exactPhaseKey];
    if (exactPhase) return { key: `sigp:${exactPhaseKey}`, recipe: exactPhase };

    const exact = EXACT_SIGNATURE_RECIPES[payload.signature];
    if (exact) return { key: `sig:${payload.signature}`, recipe: exact };

    const elementPhaseKey = `${payload.family}|${payload.primitive}|${payload.element || 'neutral'}|${payload.phase}`;
    const elementPhase = FAMILY_PRIMITIVE_ELEMENT_PHASE_RECIPES[elementPhaseKey];
    if (elementPhase) return { key: `fpel:${elementPhaseKey}`, recipe: elementPhase };

    const phaseKey = `${payload.family}|${payload.primitive}|${payload.phase}`;
    const phase = FAMILY_PRIMITIVE_PHASE_RECIPES[phaseKey];
    if (phase) return { key: `fpp:${phaseKey}`, recipe: phase };

    const primitiveKey = `${payload.family}|${payload.primitive}`;
    const primitive = FAMILY_PRIMITIVE_RECIPES[primitiveKey];
    if (primitive) return { key: `fp:${primitiveKey}`, recipe: primitive };

    return { key: 'fallback:none', recipe: { rendererId: 'none', ttlMs: 1 } };
};

export const resolveJuiceRecipe = ({ payload, reducedMotion }: ResolveJuiceRecipeArgs): ResolvedJuiceRecipe | null => {
    const { key, recipe } = lookupRecipe(payload);

    if (
        recipe.skipIfLegacyMirrored
        && payload.meta?.legacyMirrored
        && payload.meta?.legacyJuiceId
        && legacyMirroredAllowed.has(String(payload.meta.legacyJuiceId))
    ) {
        return null;
    }

    let ttlMs = Math.max(1, Number(payload.timing?.ttlMs ?? payload.timing?.durationMs ?? recipe.ttlMs));
    if (reducedMotion) ttlMs = Math.max(1, Math.floor(ttlMs * 0.7));

    return { key, ttlMs, recipe, payload };
};
