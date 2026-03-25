import { Suspense } from 'react';
import type { VisualAssetManifest } from '../visual/asset-manifest';
import type { UiPreferencesV2 } from './ui-preferences';
import { LazyBiomeSandbox, LazyThemeManagerScreen } from './lazy-screens';
import { ScreenTransitionShell } from './screen-transition-shell';
import { AppScreenFallback } from './route-shell-shared';

export const UtilityRouteShell = ({
  assetManifest,
  uiPreferences,
  isBiomesRoute,
  isThemeLabRoute,
  hubPath,
  navigateTo,
  patchUiPreferences
}: {
  assetManifest: VisualAssetManifest | null;
  uiPreferences: UiPreferencesV2;
  isBiomesRoute: boolean;
  isThemeLabRoute: boolean;
  hubPath: string;
  navigateTo: (path: string) => void;
  patchUiPreferences: (patch: Partial<UiPreferencesV2>) => void;
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

  return null;
};
