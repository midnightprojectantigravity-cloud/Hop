// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArcadeHub, ARCADE_BIOME_CHOICES } from '../components/ArcadeHub';

describe('arcade biome chooser', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
    vi.restoreAllMocks();
  });

  it('exposes the Vanguard + Inferno and Hunter + Void proof choices', () => {
    expect(ARCADE_BIOME_CHOICES).toEqual([
      expect.objectContaining({ loadoutId: 'VANGUARD', themeId: 'inferno', contentThemeId: 'inferno' }),
      expect.objectContaining({ loadoutId: 'HUNTER', themeId: 'void', contentThemeId: 'inferno' })
    ]);
  });

  it('launches the selected loadout with its bundled biome theme', async () => {
    const onLaunchArcade = vi.fn();

    await act(async () => {
      root?.render(
        <ArcadeHub
          onBack={vi.fn()}
          onLaunchArcade={onLaunchArcade}
        />
      );
    });

    const hunterCard = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Start Hunter')
    ) as HTMLButtonElement | undefined;

    expect(hunterCard).toBeTruthy();

    await act(async () => {
      hunterCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onLaunchArcade).toHaveBeenCalledWith('HUNTER', 'void', 'inferno');
  });
});
