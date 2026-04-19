import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateHubState } from '@hop/engine';
import { HubRouteShell } from '../app/HubRouteShell';

vi.mock('../app/lazy-screens', () => ({
  LazyHubScreen: ({ homePath }: { homePath: string }) => <div>Strategic Hub {homePath}</div>,
  LazyLeaderboardScreen: () => <div>Leaderboard Screen</div>,
  LazySettingsScreen: () => <div>Settings Screen</div>,
  LazyTutorialReplayScreen: () => <div>Tutorials Screen</div>
}));

const baseProps = {
  gameState: generateHubState(),
  homePath: '/Hop',
  isArcadeRoute: false,
  isHubRoute: true,
  isSettingsRoute: false,
  isLeaderboardRoute: false,
  isTutorialsRoute: false,
  hubPath: '/Hop/Hub',
  biomesPath: '/Hop/Biomes',
  themeLabPath: '/Hop/ThemeLab',
  dungeonLabPath: '/Hop/DungeonLab',
  settingsPath: '/Hop/Settings',
  leaderboardPath: '/Hop/Leaderboard',
  tutorialsPath: '/Hop/Tutorials',
  replayError: null,
  tutorialInstructions: null,
  uiPreferences: {
    colorMode: 'parchment' as const,
    motionMode: 'snappy' as const,
    hudDensity: 'compact' as const,
    mobileLayout: 'portrait_primary' as const,
    turnFlowMode: 'protected_single' as const,
    overdriveUiMode: 'per_turn_arm' as const,
    audioEnabled: true,
    hapticsEnabled: true,
    vitalsMode: 'glance' as const
  },
  dedicatedRoutesEnabled: false,
  navigateTo: vi.fn(),
  patchUiPreferences: vi.fn(),
  mapShape: 'diamond' as const,
  onMapShapeChange: vi.fn(),
  mapSize: { width: 9, height: 11 },
  onMapSizeChange: vi.fn(),
  onSelectLoadout: vi.fn(),
  onStartRun: vi.fn(),
  onLoadScenario: vi.fn(),
  onStartReplay: vi.fn(),
  onDismissTutorial: vi.fn(),
  onStartGuidedTutorial: vi.fn(),
  tutorialOnboardingState: {
    dismissed: true
  },
  tutorialProgress: {
    completed: true,
    skipped: false,
    lastStepId: null
  },
  activeTutorialSession: null,
  onDismissTutorialOnboarding: vi.fn(),
  onResetTutorialProgress: vi.fn(),
  onSkipTutorial: vi.fn(),
  worldgenUiError: null,
  worldgenProgressLabel: undefined,
  worldgenStatusLine: undefined,
  onDismissWorldgenError: vi.fn(),
  worldgenInitialized: false,
  worldgenWarmState: 'idle' as const,
  onLaunchArcade: vi.fn(),
};

describe('hub route shell route split', () => {
  it('renders the arcade biome chooser on the arcade home route', () => {
    const html = renderToStaticMarkup(
      <HubRouteShell
        {...baseProps}
        isArcadeRoute
        isHubRoute={false}
      />
    );

    expect(html).toContain('Choose a biome-backed run on the splash backdrop');
    expect(html).toContain('Vanguard + Inferno');
    expect(html).toContain('Hunter + Void');
    expect(html).toContain('Hub');
    expect(html).toContain('Start Vanguard');
    expect(html).toContain('Start Hunter');
  });

  it('renders the strategic hub screen on the dedicated hub route', () => {
    const html = renderToStaticMarkup(<HubRouteShell {...baseProps} />);

    expect(html).toContain('Strategic Hub /Hop');
    expect(html).not.toContain('ASHES');
  });

  it('shows the first-load onboarding story before the tutorial for pristine progress', () => {
    const html = renderToStaticMarkup(
      <HubRouteShell
        {...baseProps}
        tutorialOnboardingState={{ dismissed: false }}
        tutorialProgress={{ completed: false, skipped: false, lastStepId: null }}
      />
    );

    expect(html).toContain('First Dawn In Hop');
    expect(html).toContain('The March Begins In Ash');
    expect(html).toContain('Start Tutorial');
    expect(html).toContain('Continue To Hub');
  });
});
