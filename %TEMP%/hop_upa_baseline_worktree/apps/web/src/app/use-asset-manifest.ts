import { useEffect, useState } from 'react';
import { loadAssetManifest } from '../visual/asset-manifest';
import type { VisualAssetManifest } from '../visual/asset-manifest';

export const useAssetManifest = () => {
  const [assetManifest, setAssetManifest] = useState<VisualAssetManifest | null>(null);

  useEffect(() => {
    let isActive = true;
    void loadAssetManifest().then((manifest) => {
      if (!isActive) return;
      setAssetManifest(manifest);
      (window as any).__HOP_ASSET_MANIFEST = manifest;
    });
    return () => {
      isActive = false;
    };
  }, []);

  return assetManifest;
};
