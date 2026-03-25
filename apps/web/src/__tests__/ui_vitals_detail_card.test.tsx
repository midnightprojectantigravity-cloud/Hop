import { describe, expect, it } from 'vitest';
import { generateInitialState, recomputeVisibility, type ActionResourcePreview, type IresTurnProjection } from '@hop/engine';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiVitalsDetailCard } from '../components/ui/ui-vitals-detail-card';

const buildProjection = (): IresTurnProjection => ({
  spark: { current: 100, projected: 70, delta: -30 },
  mana: { current: 10, projected: 5, delta: -5 },
  exhaustion: { current: 18, projected: 44, delta: 26 },
  sparkStateBefore: 'rested',
  sparkStateAfter: 'base',
  projectedSparkRecoveryIfEndedNow: 84,
  stateAfter: 'base',
  actionCountAfter: 2,
  wouldRest: false
});

const buildResourcePreview = (): ActionResourcePreview => ({
  primaryResource: 'spark',
  primaryCost: 30,
  sparkDelta: -30,
  manaDelta: -5,
  exhaustionDelta: 26,
  tempoSparkCost: 13,
  skillSparkSurcharge: 17,
  sparkCostTotal: 30,
  manaCost: 5,
  sparkBurnHpDelta: 14,
  tax: 13,
  effectiveBfi: 6,
  nextActionCount: 2,
  bandAfter: 'exhausted',
  modeBefore: 'battle',
  modeAfter: 'battle',
  travelRecoveryApplied: false,
  turnProjection: buildProjection()
});

describe('UiVitalsDetailCard', () => {
  it('renders INFO fields, fibonacci rows, and projected resource math', () => {
    const gameState = recomputeVisibility({
      ...generateInitialState(1, 'ui-vitals-detail-card'),
      enemies: []
    });
    const html = renderToStaticMarkup(
      <UiVitalsDetailCard
        gameState={gameState}
        resourcePreview={buildResourcePreview()}
        compact
      />
    );

    expect(html).toContain('Projected Turn State');
    expect(html).toContain('Vitals INFO');
    expect(html).toContain('Tap outside to close');
    expect(html).toContain('Tempo: +13 SP');
    expect(html).toContain('Skill: +17 SP');
    expect(html).toContain('Total Spark Cost: 30 SP');
    expect(html).toContain('Mana Cost: 5 MP');
    expect(html).toContain('Spark: 100 to 70 (-30)');
    expect(html).toContain('State: rested to base');
    expect(html).toContain('Recover If Ended Now: +84 SP');
    expect(html).toContain('Spark Burn: 14 HP');
    expect(html).toContain('BFI');
    expect(html).toContain('Next Tempo');
    expect(html).toContain('Tempo Ladder');
  });
});
