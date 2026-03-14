import { describe, expect, it } from 'vitest';
import { createHex, generateInitialState, type ActionResourcePreview, type IresTurnProjection } from '@hop/engine';
import { renderToStaticMarkup } from 'react-dom/server';
import PreviewOverlay from '../components/PreviewOverlay';

const buildProjection = (): IresTurnProjection => ({
  spark: { current: 100, projected: 105, delta: 5 },
  mana: { current: 10, projected: 10, delta: 0 },
  exhaustion: { current: 20, projected: 10, delta: -10 },
  stateAfter: 'base',
  actionCountAfter: 0,
  wouldRest: false
});

const buildResourcePreview = (overrides: Partial<ActionResourcePreview> = {}): ActionResourcePreview => ({
  primaryResource: 'spark',
  primaryCost: 20,
  sparkDelta: 5,
  manaDelta: 0,
  exhaustionDelta: -10,
  sparkBurnHpDelta: 0,
  tax: 5,
  effectiveBfi: 4,
  nextActionCount: 0,
  bandAfter: 'base',
  modeBefore: 'travel',
  modeAfter: 'travel',
  travelRecoveryApplied: true,
  turnProjection: buildProjection(),
  ...overrides
});

describe('PreviewOverlay', () => {
  it('shows a travel recovery note when travel settlement applies', () => {
    const gameState = generateInitialState(1, 'preview-overlay-travel');
    const target = createHex(4, 7);
    const html = renderToStaticMarkup(
      <svg>
        <PreviewOverlay
          gameState={gameState}
          selectedSkillId={null}
          showMovementRange={false}
          hoveredTile={null}
          enginePreviewGhost={{
            path: [gameState.player.position, target],
            aoe: [],
            hasEnemy: false,
            target,
            resourcePreview: buildResourcePreview(),
            turnProjection: buildProjection()
          }}
        />
      </svg>
    );

    expect(html).toContain('Travel recovery applies');
  });

  it('shows a combat-trigger note when the move would flip alert on', () => {
    const gameState = generateInitialState(1, 'preview-overlay-alert-trigger');
    const target = createHex(4, 2);
    const html = renderToStaticMarkup(
      <svg>
        <PreviewOverlay
          gameState={gameState}
          selectedSkillId={null}
          showMovementRange={false}
          hoveredTile={null}
          enginePreviewGhost={{
            path: [gameState.player.position, target],
            aoe: [],
            hasEnemy: false,
            target,
            resourcePreview: buildResourcePreview({
              sparkDelta: -20,
              exhaustionDelta: 15,
              nextActionCount: 1,
              modeAfter: 'battle',
              travelRecoveryApplied: false,
              travelRecoverySuppressedReason: 'alert_triggered',
              turnProjection: {
                ...buildProjection(),
                spark: { current: 100, projected: 80, delta: -20 },
                exhaustion: { current: 20, projected: 35, delta: 15 },
                actionCountAfter: 1
              }
            }),
            turnProjection: {
              ...buildProjection(),
              spark: { current: 100, projected: 80, delta: -20 },
              exhaustion: { current: 20, projected: 35, delta: 15 },
              actionCountAfter: 1
            }
          }}
        />
      </svg>
    );

    expect(html).toContain('Combat triggered');
  });
});
