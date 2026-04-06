import { Suspense } from 'react';
import type { GameState } from '@hop/engine';
import type { VisualAssetManifest } from '../visual/asset-manifest';
import type { ReplayRecord } from '../components/ReplayManager';
import type { UiPreferencesV2 } from './ui-preferences';
import { LazyBiomeSandbox, LazyDungeonLabScreen, LazyThemeManagerScreen } from './lazy-screens';
import { ScreenTransitionShell } from './screen-transition-shell';
import { AppScreenFallback } from './route-shell-shared';

export const UtilityRouteShell = ({
  assetManifest,
  uiPreferences,
  isBiomesRoute,
  isThemeLabRoute,
  isDungeonLabRoute,
  hubPath,
  homePath,
  navigateTo,
  patchUiPreferences,
  onStartReplay
}: {
  assetManifest: VisualAssetManifest | null;
  uiPreferences: UiPreferencesV2;
  isBiomesRoute: boolean;
  isThemeLabRoute: boolean;
  isDungeonLabRoute: boolean;
  hubPath: string;
  homePath: string;
  navigateTo: (path: string) => void;
  patchUiPreferences: (patch: Partial<UiPreferencesV2>) => void;
  onStartReplay: (record: ReplayRecord & { initState?: GameState }) => void;
}) => {
  if (isBiomesRoute) {
    return (
      <ScreenTransitionShell motionMode={uiPreferences.motionMode} screenId="biomes">
        <Suspense fallback={<AppScreenFallback label="Loading Sandbox..." />}>
          <LazyBiomeSandbox
            assetManifest={assetManifest}
            onBack={() => navigateTo(hubPath)}
          />
        </Suspense>
      </ScreenTransitionShell>
    );
  }

  if (isThemeLabRoute) {
    return (
      <ScreenTransitionShell motionMode={uiPreferences.motionMode} screenId="theme-lab">
        <Suspense fallback={<AppScreenFallback label="Loading Theme Lab..." />}>
          <LazyThemeManagerScreen
            uiPreferences={uiPreferences}
            onSetColorMode={(colorMode) => patchUiPreferences({ colorMode })}
            onSetMotionMode={(motionMode) => patchUiPreferences({ motionMode })}
            onSetHudDensity={(hudDensity) => patchUiPreferences({ hudDensity })}
            onBack={() => navigateTo(hubPath)}
          />
        </Suspense>
      </ScreenTransitionShell>
    );
  }

  if (isDungeonLabRoute) {
    return (
      <ScreenTransitionShell motionMode={uiPreferences.motionMode} screenId="dungeon-lab">
        <Suspense fallback={<AppScreenFallback label="Loading Dungeon Lab..." />}>
          <LazyDungeonLabScreen
            assetManifest={assetManifest}
            onBack={() => navigateTo(hubPath)}
            onStartReplay={(record) => {
              onStartReplay(record);
              navigateTo(homePath);
            }}
          />
        </Suspense>
      </ScreenTransitionShell>
    );
  }

  return null;
};
