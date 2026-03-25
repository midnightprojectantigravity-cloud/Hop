import { describe, expect, it, vi } from 'vitest';
import { generateInitialState, recomputeVisibility, type ActionResourcePreview, type IresTurnProjection } from '@hop/engine';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiVitalsGlyph } from '../components/ui/ui-vitals-glyph';

const buildProjection = (): IresTurnProjection => ({
  spark: { current: 100, projected: 82, delta: -18 },
  mana: { current: 10, projected: 10, delta: 0 },
  exhaustion: { current: 22, projected: 39, delta: 17 },
  sparkStateBefore: 'rested',
  sparkStateAfter: 'base',
  projectedSparkRecoveryIfEndedNow: 84,
  stateAfter: 'base',
  actionCountAfter: 1,
  wouldRest: false
});

const buildResourcePreview = (): ActionResourcePreview => ({
  primaryResource: 'spark',
  primaryCost: 20,
  sparkDelta: -18,
  manaDelta: 0,
  exhaustionDelta: 17,
  tempoSparkCost: 8,
  skillSparkSurcharge: 10,
  sparkCostTotal: 18,
  manaCost: 0,
  sparkBurnHpDelta: 0,
  tax: 8,
  effectiveBfi: 5,
  nextActionCount: 1,
  bandAfter: 'base',
  modeBefore: 'travel',
  modeAfter: 'travel',
  travelRecoveryApplied: true,
  turnProjection: buildProjection()
});

describe('UiVitalsGlyph', () => {
  it('renders the spark core, hp wing, mana wing, and exhaustion plaque in mobile glance mode', () => {
    const gameState = recomputeVisibility({
      ...generateInitialState(1, 'ui-vitals-glyph'),
      enemies: []
    });
    const html = renderToStaticMarkup(
      <UiVitalsGlyph
        gameState={gameState}
        layoutMode="mobile_portrait"
        showDetail={false}
        onToggleDetail={vi.fn()}
        resourcePreview={buildResourcePreview()}
        turnFlowMode="protected_single"
        overdriveArmed={false}
      />
    );

    expect(html).toContain('Spark');
    expect(html).toContain('HP');
    expect(html).toContain('MP');
    expect(html).toContain('aria-label="State rested"');
    expect(html).not.toContain('Travel Mode');
    expect(html).not.toContain('Alert Off');
    expect(html).not.toContain('Protected');
    expect(html).not.toContain('Auto-End: 1');
    expect(html).toContain('aria-expanded="false"');
  });

  it('shows the detail card when expanded', () => {
    const gameState = recomputeVisibility({
      ...generateInitialState(1, 'ui-vitals-glyph-expanded'),
      enemies: []
    });
    const html = renderToStaticMarkup(
      <UiVitalsGlyph
        gameState={gameState}
        layoutMode="tablet"
        showDetail
        onToggleDetail={vi.fn()}
        resourcePreview={buildResourcePreview()}
        turnFlowMode="protected_single"
        overdriveArmed
      />
    );

    expect(html).toContain('Projected Turn State');
    expect(html).toContain('Close vitals details');
    expect(html).toContain('Turn Flow');
    expect(html).toContain('Overdrive: chaining enabled');
    expect(html).toContain('INFO');
    expect(html).toContain('Tempo Ladder');
    expect(html).toContain('Travel recovery applies');
  });
});
