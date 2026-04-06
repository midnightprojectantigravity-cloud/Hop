import { useEffect } from 'react';
import {
  prefetchBiomeSandbox,
  prefetchDungeonLabScreen,
  prefetchGameScreen,
  prefetchHubScreen,
  prefetchLeaderboardScreen,
  prefetchSettingsScreen,
  prefetchThemeManagerScreen,
  prefetchTutorialReplayScreen
} from './lazy-screens';

export const useRoutePrefetch = ({
  dedicatedHubRoutesEnabled,
  gameStatus,
  isArcadeRoute,
  isBiomesRoute,
  isThemeLabRoute,
  isDungeonLabRoute,
  isLeaderboardRoute,
  isSettingsRoute,
  isTutorialsRoute
}: {
  dedicatedHubRoutesEnabled: boolean;
  gameStatus: 'hub' | 'playing' | 'choosing_upgrade' | 'won' | 'lost';
  isArcadeRoute: boolean;
  isBiomesRoute: boolean;
  isThemeLabRoute: boolean;
  isDungeonLabRoute: boolean;
  isLeaderboardRoute: boolean;
  isSettingsRoute: boolean;
  isTutorialsRoute: boolean;
}) => {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let cancelled = false;

    const runPrefetch = () => {
      if (cancelled) return;

      if (isBiomesRoute) {
        void prefetchHubScreen();
        void prefetchGameScreen();
        void prefetchThemeManagerScreen();
        if (dedicatedHubRoutesEnabled) {
          void prefetchSettingsScreen();
          void prefetchLeaderboardScreen();
          void prefetchTutorialReplayScreen();
        }
        return;
      }

      if (isThemeLabRoute) {
        void prefetchHubScreen();
        void prefetchGameScreen();
        void prefetchBiomeSandbox();
        void prefetchDungeonLabScreen();
        if (dedicatedHubRoutesEnabled) {
          void prefetchSettingsScreen();
          void prefetchLeaderboardScreen();
          void prefetchTutorialReplayScreen();
        }
        return;
      }

      if (isDungeonLabRoute) {
        void prefetchHubScreen();
        void prefetchGameScreen();
        void prefetchBiomeSandbox();
        void prefetchThemeManagerScreen();
        if (dedicatedHubRoutesEnabled) {
          void prefetchSettingsScreen();
          void prefetchLeaderboardScreen();
          void prefetchTutorialReplayScreen();
        }
        return;
      }

      if (isSettingsRoute) {
        void prefetchHubScreen();
        void prefetchLeaderboardScreen();
        void prefetchTutorialReplayScreen();
        return;
      }

      if (isLeaderboardRoute) {
        void prefetchHubScreen();
        void prefetchSettingsScreen();
        void prefetchTutorialReplayScreen();
        return;
      }

      if (isTutorialsRoute) {
        void prefetchHubScreen();
        void prefetchSettingsScreen();
        void prefetchLeaderboardScreen();
        return;
      }

      if (gameStatus === 'hub') {
        void prefetchGameScreen();
        void prefetchThemeManagerScreen();
        void prefetchDungeonLabScreen();
        if (!isArcadeRoute) {
          void prefetchBiomeSandbox();
        }
        if (dedicatedHubRoutesEnabled) {
          void prefetchSettingsScreen();
          void prefetchLeaderboardScreen();
          void prefetchTutorialReplayScreen();
        }
        return;
      }

      void prefetchHubScreen();
      if (dedicatedHubRoutesEnabled) {
        void prefetchSettingsScreen();
        void prefetchLeaderboardScreen();
        void prefetchTutorialReplayScreen();
      }
      void prefetchThemeManagerScreen();
      void prefetchDungeonLabScreen();
      if (!isArcadeRoute && gameStatus !== 'lost') {
        void prefetchBiomeSandbox();
      }
    };

    if (typeof (window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    }).requestIdleCallback === 'function') {
      const idleWindow = window as Window & {
        requestIdleCallback: (callback: () => void, options?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      const idleHandle = idleWindow.requestIdleCallback(runPrefetch, { timeout: 700 });
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(idleHandle);
      };
    }

    const timeoutHandle = window.setTimeout(runPrefetch, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutHandle);
    };
  }, [
    dedicatedHubRoutesEnabled,
    gameStatus,
    isArcadeRoute,
    isBiomesRoute,
    isThemeLabRoute,
    isDungeonLabRoute,
    isLeaderboardRoute,
    isSettingsRoute,
    isTutorialsRoute
  ]);
};
