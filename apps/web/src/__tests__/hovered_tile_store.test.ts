import { describe, expect, it, vi } from 'vitest';
import { createHoveredTileStore } from '../components/game-board/hovered-tile-store';

const hex = (q: number, r: number, s: number) => ({ q, r, s });

describe('hovered tile store', () => {
  it('notifies subscribers only when the hovered tile actually changes', () => {
    const store = createHoveredTileStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setHoveredTile(hex(1, 0, -1));
    store.setHoveredTile(hex(1, 0, -1));
    store.setHoveredTile(hex(2, 0, -2));
    store.clear();
    store.clear();
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(3);
    expect(store.getSnapshot()).toBeNull();
  });
});
