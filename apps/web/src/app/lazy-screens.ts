import { lazy } from 'react';

type ModuleLoader<T> = () => Promise<T>;

const createCachedLoader = <T>(loader: ModuleLoader<T>): ModuleLoader<T> => {
  let pending: Promise<T> | null = null;
  return () => {
    if (!pending) {
      pending = loader();
    }
    return pending;
  };
};

const loadBiomeSandboxModule = createCachedLoader(() => import('../components/BiomeSandbox'));
const loadHubScreenModule = createCachedLoader(() => import('./HubScreen'));
const loadGameScreenModule = createCachedLoader(() => import('./GameScreen'));
const loadThemeManagerScreenModule = createCachedLoader(() => import('./ThemeManagerScreen'));
const loadSettingsScreenModule = createCachedLoader(() => import('./SettingsScreen'));
const loadLeaderboardScreenModule = createCachedLoader(() => import('./LeaderboardScreen'));
const loadTutorialReplayScreenModule = createCachedLoader(() => import('./TutorialReplayScreen'));

export const LazyBiomeSandbox = lazy(async () => {
  const module = await loadBiomeSandboxModule();
  return { default: module.BiomeSandbox };
});

export const LazyHubScreen = lazy(async () => {
  const module = await loadHubScreenModule();
  return { default: module.HubScreen };
});

export const LazyGameScreen = lazy(async () => {
  const module = await loadGameScreenModule();
  return { default: module.GameScreen };
});

export const LazyThemeManagerScreen = lazy(async () => {
  const module = await loadThemeManagerScreenModule();
  return { default: module.ThemeManagerScreen };
});

export const LazySettingsScreen = lazy(async () => {
  const module = await loadSettingsScreenModule();
  return { default: module.SettingsScreen };
});

export const LazyLeaderboardScreen = lazy(async () => {
  const module = await loadLeaderboardScreenModule();
  return { default: module.LeaderboardScreen };
});

export const LazyTutorialReplayScreen = lazy(async () => {
  const module = await loadTutorialReplayScreenModule();
  return { default: module.TutorialReplayScreen };
});

export const prefetchBiomeSandbox = (): Promise<void> => loadBiomeSandboxModule().then(() => undefined);
export const prefetchHubScreen = (): Promise<void> => loadHubScreenModule().then(() => undefined);
export const prefetchGameScreen = (): Promise<void> => loadGameScreenModule().then(() => undefined);
export const prefetchThemeManagerScreen = (): Promise<void> => loadThemeManagerScreenModule().then(() => undefined);
export const prefetchSettingsScreen = (): Promise<void> => loadSettingsScreenModule().then(() => undefined);
export const prefetchLeaderboardScreen = (): Promise<void> => loadLeaderboardScreenModule().then(() => undefined);
export const prefetchTutorialReplayScreen = (): Promise<void> => loadTutorialReplayScreenModule().then(() => undefined);
