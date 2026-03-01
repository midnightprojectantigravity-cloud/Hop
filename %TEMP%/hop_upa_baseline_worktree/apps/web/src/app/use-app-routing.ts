import { useEffect, useMemo, useState } from 'react';

export interface AppRoutingState {
  pathname: string;
  hubPath: string;
  arcadePath: string;
  biomesPath: string;
  isArcadeRoute: boolean;
  isBiomesRoute: boolean;
  navigateTo: (path: string) => void;
}

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

  const derived = useMemo(() => {
    const hubBase = pathname.toLowerCase().startsWith('/hop') ? '/Hop' : '';
    const hubPath = `${hubBase || ''}` || '/';
    const arcadePath = `${hubBase}/Arcade` || '/Arcade';
    const biomesPath = `${hubBase}/Biomes` || '/Biomes';
    const pathnameLower = pathname.toLowerCase();
    const normalizedPathname = pathnameLower.replace(/\/+$/, '');
    const isArcadeRoute = normalizedPathname.endsWith('/arcade') || normalizedPathname.endsWith('/arcarde');
    const isBiomesRoute = normalizedPathname.endsWith('/biomes');

    return {
      hubPath,
      arcadePath,
      biomesPath,
      isArcadeRoute,
      isBiomesRoute,
    };
  }, [pathname]);

  return {
    pathname,
    navigateTo,
    ...derived,
  };
};
