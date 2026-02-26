import { useMemo } from 'react';
import type { BiomeSandboxPathSets } from '../BiomeSandbox';
import type { VisualAssetManifest, VisualBiomeTextureLayer } from '../../visual/asset-manifest';

export const useBiomeSandboxPathSets = (assetManifest: VisualAssetManifest | null): BiomeSandboxPathSets => (
  useMemo(() => {
    const undercurrent = new Set<string>();
    const crust = new Set<string>();
    const detail = new Set<string>();
    const mountain = new Set<string>();
    if (!assetManifest) {
      return { undercurrent: [] as string[], crust: [] as string[], detail: [] as string[], mountain: [] as string[] };
    }

    const registerLayerPaths = (layer?: VisualBiomeTextureLayer) => {
      if (!layer) return;
      if (layer.default) {
        undercurrent.add(layer.default);
        crust.add(layer.default);
        detail.add(layer.default);
      }
      for (const value of Object.values(layer.themes || {})) {
        undercurrent.add(value);
        crust.add(value);
        detail.add(value);
      }
    };

    registerLayerPaths(assetManifest.biomeLayers?.undercurrent);
    registerLayerPaths(assetManifest.biomeLayers?.crust);
    for (const preset of Object.values(assetManifest.biomePresets || {})) {
      registerLayerPaths(preset?.biomeLayers?.undercurrent);
      registerLayerPaths(preset?.biomeLayers?.crust);
      if (preset?.biomeMaterials?.crust?.detailA) registerLayerPaths(preset.biomeMaterials.crust.detailA);
      if (preset?.biomeMaterials?.crust?.detailB) registerLayerPaths(preset.biomeMaterials.crust.detailB);
    }
    if (assetManifest.biomeUnderlay) {
      if (assetManifest.biomeUnderlay.default) crust.add(assetManifest.biomeUnderlay.default);
      for (const value of Object.values(assetManifest.biomeUnderlay.themes || {})) crust.add(value);
    }
    if (assetManifest.biomeMaterials?.crust?.detailA) registerLayerPaths(assetManifest.biomeMaterials.crust.detailA);
    if (assetManifest.biomeMaterials?.crust?.detailB) registerLayerPaths(assetManifest.biomeMaterials.crust.detailB);

    for (const asset of assetManifest.assets || []) {
      const tags = new Set((asset.tags || []).map(tag => tag.toLowerCase()));
      const isMountain = asset.type === 'prop' && (asset.id.toLowerCase().includes('mountain') || tags.has('mountain'));
      if (tags.has('floor') || tags.has('stone') || tags.has('void') || tags.has('frozen') || tags.has('inferno')) {
        crust.add(asset.path);
        detail.add(asset.path);
      }
      if (tags.has('lava') || tags.has('hazard') || tags.has('fire') || tags.has('quicksand')) {
        undercurrent.add(asset.path);
      }
      if (asset.type === 'decal' || asset.type === 'prop' || asset.type === 'tile') {
        detail.add(asset.path);
      }
      if (isMountain) {
        mountain.add(asset.path);
      }
    }
    if (assetManifest.walls?.mountainPath) {
      mountain.add(assetManifest.walls.mountainPath);
    }
    for (const override of Object.values(assetManifest.walls?.themes || {})) {
      if (override?.mountainPath) {
        mountain.add(override.mountainPath);
      }
    }
    for (const preset of Object.values(assetManifest.biomePresets || {})) {
      if (preset?.walls?.mountainPath) {
        mountain.add(preset.walls.mountainPath);
      }
      for (const override of Object.values(preset?.walls?.themes || {})) {
        if (override?.mountainPath) {
          mountain.add(override.mountainPath);
        }
      }
    }

    return {
      undercurrent: Array.from(undercurrent).sort((a, b) => a.localeCompare(b)),
      crust: Array.from(crust).sort((a, b) => a.localeCompare(b)),
      detail: Array.from(detail).sort((a, b) => a.localeCompare(b)),
      mountain: Array.from(mountain).sort((a, b) => a.localeCompare(b))
    };
  }, [assetManifest])
);
