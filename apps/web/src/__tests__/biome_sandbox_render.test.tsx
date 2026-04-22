// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisualAssetManifest } from '../visual/asset-manifest';

vi.mock('../components/GameBoard', () => ({
  GameBoard: ({ gameState }: { gameState: { theme: string; tiles: Map<string, { traits: Set<string> }> } }) => {
    const hazardTile = Array.from(gameState.tiles.values()).find((tile) =>
      tile.traits.has('TOXIC') || tile.traits.has('LAVA')
    );
    const hazardKind = hazardTile?.traits.has('TOXIC')
      ? 'TOXIC'
      : hazardTile?.traits.has('LAVA')
        ? 'LAVA'
        : 'NONE';

    return <div data-testid="mock-board" data-theme={gameState.theme} data-hazard={hazardKind} />;
  }
}));

import { BiomeSandbox } from '../components/BiomeSandbox';

describe('biome sandbox render', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let assetManifest: VisualAssetManifest;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const currentDir = dirname(fileURLToPath(import.meta.url));
    assetManifest = JSON.parse(
      readFileSync(resolve(currentDir, '../../public/assets/manifest.json'), 'utf8')
    ) as VisualAssetManifest;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
    vi.restoreAllMocks();
  });

  it('shows only manifest-backed presets and rebuilds the preview when the theme changes', async () => {
    await act(async () => {
      root?.render(
        <BiomeSandbox
          assetManifest={assetManifest}
          onBack={vi.fn()}
        />
      );
    });

    const select = Array.from(container.querySelectorAll('select')).find((element) =>
      Array.from((element as HTMLSelectElement).options || []).some((option) => option.value === 'void')
    ) as HTMLSelectElement | undefined;
    expect(select).toBeTruthy();
    expect(Array.from(select?.options || []).map((option) => option.value)).toEqual(['inferno', 'void']);

    const boardBefore = container.querySelector('[data-testid="mock-board"]') as HTMLElement | null;
    expect(boardBefore?.dataset.theme).toBe('inferno');
    expect(boardBefore?.dataset.hazard).toBe('LAVA');

    await act(async () => {
      if (!select) return;
      select.value = 'void';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const boardAfter = container.querySelector('[data-testid="mock-board"]') as HTMLElement | null;
    expect(boardAfter?.dataset.theme).toBe('void');
    expect(boardAfter?.dataset.hazard).toBe('TOXIC');
    expect(container.textContent).toContain('Theme: void');
  });
});
