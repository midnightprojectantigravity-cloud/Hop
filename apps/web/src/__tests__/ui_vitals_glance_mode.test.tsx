import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateInitialState, recomputeVisibility } from '@hop/engine';
import { UiVitalsGlance } from '../components/ui/ui-vitals-glance';
import { SettingsScreen } from '../app/SettingsScreen';

const buildGameState = (seed: string) => recomputeVisibility({
  ...generateInitialState(1, seed),
  enemies: []
});

describe('ui vitals glance mode', () => {
  it('renders the compact glyph in glance mode', () => {
    const html = renderToStaticMarkup(
      <UiVitalsGlance
        gameState={buildGameState('ui-vitals-glance')}
        layoutMode="mobile_portrait"
        mode="glance"
        onSetMode={vi.fn()}
        turnFlowMode="protected_single"
        overdriveArmed={false}
      />
    );

    expect(html).toContain('Toggle vitals details');
    expect(html).toContain('Spark');
    expect(html).toContain('aria-label="State');
    expect(html).not.toContain('Compact Vitals');
  });

  it('renders the full detail card in full mode', () => {
    const html = renderToStaticMarkup(
      <UiVitalsGlance
        gameState={buildGameState('ui-vitals-full')}
        layoutMode="mobile_portrait"
        mode="full"
        onSetMode={vi.fn()}
        turnFlowMode="protected_single"
        overdriveArmed={false}
      />
    );

    expect(html).toContain('Compact Vitals');
    expect(html).toContain('Vitals INFO');
    expect(html).toContain('Turn Flow');
  });

  it('exposes the vitals mode toggle in settings', () => {
    const html = renderToStaticMarkup(
      <SettingsScreen
        uiPreferences={{
          colorMode: 'parchment',
          motionMode: 'snappy',
          hudDensity: 'compact',
          mobileLayout: 'portrait_primary',
          turnFlowMode: 'protected_single',
          overdriveUiMode: 'per_turn_arm',
          audioEnabled: true,
          hapticsEnabled: true,
          vitalsMode: 'glance'
        }}
        onSetColorMode={vi.fn()}
        onSetMotionMode={vi.fn()}
        onSetHudDensity={vi.fn()}
        onSetTurnFlowMode={vi.fn()}
        onSetAudioEnabled={vi.fn()}
        onSetHapticsEnabled={vi.fn()}
        onSetVitalsMode={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain('Vitals Display');
    expect(html).toContain('Glance + Expand');
  });
});
