import { describe, expect, it } from 'vitest';
import type { JuiceSignaturePayloadV1 } from '@hop/engine';
import { resolveJuiceRecipe } from '../visual/juice-resolver';

const makePayload = (signature: string, primitive: JuiceSignaturePayloadV1['primitive'], phase: JuiceSignaturePayloadV1['phase']): JuiceSignaturePayloadV1 => ({
  protocol: 'juice-signature/v1',
  signature,
  family: 'status',
  primitive,
  phase,
  element: 'shadow'
});

describe('juice resolver blinded signatures', () => {
  it('resolves blinded apply signature to hidden fade renderer', () => {
    const payload = makePayload('STATE.APPLY.SHADOW.BLINDED', 'status_apply', 'impact');
    const resolved = resolveJuiceRecipe({ payload, reducedMotion: false });
    expect(resolved?.recipe.rendererId).toBe('hidden_fade');
  });

  it('resolves blinded expire signature to generic ring renderer', () => {
    const payload = makePayload('STATE.EXPIRE.SHADOW.BLINDED', 'status_tick', 'aftermath');
    const resolved = resolveJuiceRecipe({ payload, reducedMotion: false });
    expect(resolved?.recipe.rendererId).toBe('generic_ring');
  });
});
