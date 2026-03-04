import { describe, expect, it } from 'vitest';
import { resolveArcadeSelectionInteraction } from '../components/ArcadeHub';

describe('arcade selection interaction', () => {
  it('uses explicit two-step flow when enabled', () => {
    const result = resolveArcadeSelectionInteraction({
      twoStepSelection: true,
      selectedLoadoutId: null,
      clickedLoadoutId: 'VANGUARD'
    });
    expect(result.nextSelectedLoadoutId).toBe('VANGUARD');
    expect(result.launchLoadoutId).toBeNull();
  });

  it('launches immediately when two-step flow is disabled', () => {
    const result = resolveArcadeSelectionInteraction({
      twoStepSelection: false,
      selectedLoadoutId: 'HUNTER',
      clickedLoadoutId: 'VANGUARD'
    });
    expect(result.nextSelectedLoadoutId).toBe('HUNTER');
    expect(result.launchLoadoutId).toBe('VANGUARD');
  });
});

