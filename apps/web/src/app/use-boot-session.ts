import { useEffect, useMemo, useRef, useState } from 'react';
import { emitUiMetric } from './ui-telemetry';
import { deriveBootState, type BootState } from './boot-state';
import type { UiMotionMode } from './ui-preferences';

export interface BootSession {
  bootState: BootState;
  showBootOverlay: boolean;
}

export const useBootSession = ({
  assetManifestReady,
  motionMode,
  dispatchSensory
}: {
  assetManifestReady: boolean;
  motionMode: UiMotionMode;
  dispatchSensory: (payload: {
    id: 'ui-confirm';
    intensity: 1.0;
    priority: 'low';
    context: 'hub';
  }) => void;
}): BootSession => {
  const bootStartedAtRef = useRef(Date.now());
  const shellMetricSentRef = useRef(false);
  const assetMetricSentRef = useRef(false);
  const bootMetricSentRef = useRef(false);
  const bootSensorySentRef = useRef(false);
  const [shellReady, setShellReady] = useState(false);
  const [showBootOverlay, setShowBootOverlay] = useState(true);

  useEffect(() => {
    setShellReady(true);
  }, []);

  useEffect(() => {
    if (!shellReady || shellMetricSentRef.current) return;
    emitUiMetric('boot_shell_ready_ms', Date.now() - bootStartedAtRef.current);
    shellMetricSentRef.current = true;
  }, [shellReady]);

  useEffect(() => {
    if (!assetManifestReady) return;
    if (assetMetricSentRef.current) return;
    emitUiMetric('boot_asset_manifest_ready_ms', Date.now() - bootStartedAtRef.current, {
      hasAssetManifest: true
    });
    assetMetricSentRef.current = true;
  }, [assetManifestReady]);

  const appReady = shellReady && assetManifestReady;

  useEffect(() => {
    if (!appReady || bootMetricSentRef.current) return;
    emitUiMetric('boot_ready_ms', Date.now() - bootStartedAtRef.current, {
      hasAssetManifest: assetManifestReady
    });
    bootMetricSentRef.current = true;
  }, [appReady, assetManifestReady]);

  useEffect(() => {
    if (!appReady || bootSensorySentRef.current) return;
    dispatchSensory({
      id: 'ui-confirm',
      intensity: 1.0,
      priority: 'low',
      context: 'hub'
    });
    bootSensorySentRef.current = true;
  }, [appReady, dispatchSensory]);

  useEffect(() => {
    if (!appReady) {
      setShowBootOverlay(true);
      return;
    }
    const timeout = window.setTimeout(() => {
      setShowBootOverlay(false);
    }, motionMode === 'reduced' ? 120 : 320);
    return () => window.clearTimeout(timeout);
  }, [appReady, motionMode]);

  const bootState = useMemo(() => deriveBootState({
    shellReady,
    assetManifestReady
  }), [assetManifestReady, shellReady]);

  return {
    bootState,
    showBootOverlay
  };
};
