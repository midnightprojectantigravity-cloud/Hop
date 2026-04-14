import { describe, expect, it } from 'vitest';
import { resolveDeathDecalAssetId } from '../visual/asset-selectors';

describe('asset selectors', () => {
  it('uses bones decal when the player has a bone-affiliated skill', () => {
    const actor = {
      activeSkills: [
        { id: 'RAISE_DEAD', deathDecalVariant: 'bones' }
      ]
    };

    expect(resolveDeathDecalAssetId(actor as any)).toBe('unit.skeleton.bones.01');
  });

  it('falls back to blood when no bone-affiliated skill is present', () => {
    expect(resolveDeathDecalAssetId({ activeSkills: [] } as any)).toBe('decal.combat.blood.01');
  });
});
