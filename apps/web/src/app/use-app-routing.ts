import { useEffect, useMemo, useState } from 'react';

export interface AppRoutingState {
  pathname: string;
  hubPath: string;
  arcadePath: string;
  biomesPath: string;
  themeLabPath: string;
  settingsPath: string;
  leaderboardPath: string;
  tutorialsPath: string;
  isArcadeRoute: boolean;
  isBiomesRoute: boolean;
  isThemeLabRoute: boolean;
  isSettingsRoute: boolean;
  isLeaderboardRoute: boolean;
  isTutorialsRoute: boolean;
  navigateTo: (path: string) => void;
}

const normalizeRoute = (path: string): string => path.toLowerCase().replace(/\/+$/, '');

export interface DerivedAppRouting {
  hubPath: string;
  arcadePath: string;
  biomesPath: string;
  themeLabPath: string;
  settingsPath: string;
  leaderboardPath: string;
  tutorialsPath: string;
  isArcadeRoute: boolean;
  isBiomesRoute: boolean;
  isThemeLabRoute: boolean;
  isSettingsRoute: boolean;
  isLeaderboardRoute: boolean;
  isTutorialsRoute: boolean;
}

export const deriveAppRouting = (pathname: string): DerivedAppRouting => {
  const hubBase = pathname.toLowerCase().startsWith('/hop') ? '/Hop' : '';
  const hubPath = `${hubBase || ''}` || '/';
  const arcadePath = `${hubBase}/Arcade` || '/Arcade';
  const biomesPath = `${hubBase}/Biomes` || '/Biomes';
  const themeLabPath = `${hubBase}/ThemeLab` || '/ThemeLab';
  const settingsPath = `${hubBase}/Settings` || '/Settings';
  const leaderboardPath = `${hubBase}/Leaderboard` || '/Leaderboard';
  const tutorialsPath = `${hubBase}/Tutorials` || '/Tutorials';

  const normalizedPathname = normalizeRoute(pathname);

  const isArcadeRoute = normalizedPathname.endsWith('/arcade') || normalizedPathname.endsWith('/arcarde');
  const isBiomesRoute = normalizedPathname.endsWith('/biomes');
  const isThemeLabRoute =
    normalizedPathname.endsWith('/themelab')
    || normalizedPathname.endsWith('/theme-manager')
    || normalizedPathname.endsWith('/style-guide');
  const isSettingsRoute = normalizedPathname.endsWith('/settings');
  const isLeaderboardRoute = normalizedPathname.endsWith('/leaderboard');
  const isTutorialsRoute = normalizedPathname.endsWith('/tutorials');

  return {
    hubPath,
    arcadePath,
    biomesPath,
    themeLabPath,
    settingsPath,
    leaderboardPath,
    tutorialsPath,
    isArcadeRoute,
    isBiomesRoute,
    isThemeLabRoute,
    isSettingsRoute,
    isLeaderboardRoute,
    isTutorialsRoute
  };
};

export const useAppRouting = (): AppRoutingState => {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setPathname(path);
  };

  const derived = useMemo(() => deriveAppRouting(pathname), [pathname]);

  return {
    pathname,
    navigateTo,
    ...derived
  };
};
