import { useMemo } from 'react';
import { useAppRouting } from './use-app-routing';
import { readUiFeatureFlags } from './ui-feature-flags';
import { useUiPreferences } from './ui-preferences';

export const useAppSession = () => {
  const { preferences: uiPreferences, patchPreferences: patchUiPreferences } = useUiPreferences();
  const routing = useAppRouting();
  const featureFlags = useMemo(() => readUiFeatureFlags(), []);

  return {
    uiPreferences,
    patchUiPreferences,
    featureFlags,
    ...routing
  };
};
