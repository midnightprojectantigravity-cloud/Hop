import type {
  VisualAssetEntry,
  VisualAssetManifest,
  VisualBiomeThemePreset,
  VisualBiomeWallsProfile,
  VisualBiomeWallsThemeOverride
} from '../../visual/asset-manifest';
import { getBiomeThemePreset } from '../../visual/asset-manifest';

const SANDBOX_MOUNTAIN_FALLBACK_HINT = 'biome.volcano.mountain.03.webp';

const isMountainCandidate = (asset: VisualAssetEntry, themeKey: string): boolean => {
  if (asset.type !== 'prop') return false;
  const id = asset.id.toLowerCase();
  const tags = new Set((asset.tags || []).map(tag => tag.toLowerCase()));
  if (!id.includes('mountain') && !tags.has('mountain')) return false;
  if (!asset.theme) return true;
  const assetTheme = asset.theme.toLowerCase();
  return assetTheme === themeKey || assetTheme === 'core';
};

export interface ResolvedBiomeSandboxMountainAssets {
  themePreset?: VisualBiomeThemePreset;
  wallsProfile?: Partial<VisualBiomeWallsProfile>;
  wallsThemeOverride?: Partial<VisualBiomeWallsThemeOverride>;
  mountainCandidates: VisualAssetEntry[];
  presetMountainPath: string;
  mountainPath: string;
  selectedMountainAsset?: VisualAssetEntry;
  templateMountainAsset?: VisualAssetEntry;
}

export const resolveBiomeSandboxMountainAssets = (
  manifest: VisualAssetManifest,
  theme: string
): ResolvedBiomeSandboxMountainAssets => {
  const themeKey = String(theme || '').toLowerCase();
  const themePreset = getBiomeThemePreset(manifest, themeKey) as VisualBiomeThemePreset | undefined;
  const wallsProfile = (themePreset?.walls || manifest.walls) as Partial<VisualBiomeWallsProfile> | undefined;
  const wallsThemeOverride = (
    themePreset?.walls
      ? themePreset.walls
      : manifest.walls?.themes?.[themeKey]
  ) as Partial<VisualBiomeWallsThemeOverride> | undefined;
  const mountainCandidates = (manifest.assets || [])
    .filter(asset => isMountainCandidate(asset, themeKey))
    .sort((a, b) => a.id.localeCompare(b.id));
  const presetMountainPath = String(
    wallsThemeOverride?.mountainPath
    ?? wallsProfile?.mountainPath
    ?? ''
  ).trim();
  const fallbackMountainAsset = mountainCandidates.find(
    asset => asset.path.toLowerCase().includes(SANDBOX_MOUNTAIN_FALLBACK_HINT)
  ) || mountainCandidates[0];
  const mountainPath = presetMountainPath || fallbackMountainAsset?.path || '';
  const selectedMountainAsset = mountainCandidates.find(asset => asset.path === mountainPath) || fallbackMountainAsset;

  return {
    themePreset,
    wallsProfile,
    wallsThemeOverride,
    mountainCandidates,
    presetMountainPath,
    mountainPath,
    selectedMountainAsset,
    templateMountainAsset: selectedMountainAsset || fallbackMountainAsset
  };
};
