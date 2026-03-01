import { describe, expect, it } from 'vitest';
import { generateInitialState } from '@hop/engine';
import { getEntityAilmentBadges } from '../components/entity/entity-ailment-badges';

describe('entity ailment badges', () => {
  it('returns top counters sorted by magnitude', () => {
    const state = generateInitialState(1, 'entity-ailment-badges-seed');
    const components = new Map(state.player.components || []);
    components.set('ailments', {
      type: 'ailments',
      counters: {
        burn: 4,
        poison: 11,
        wet: 2,
        bleed: 6
      }
    });
    state.player = {
      ...state.player,
      components
    };

    const badges = getEntityAilmentBadges(state.player, 3);
    expect(badges.map(b => `${b.ailment}:${b.count}`)).toEqual(['poison:11', 'bleed:6', 'burn:4']);
  });
});

