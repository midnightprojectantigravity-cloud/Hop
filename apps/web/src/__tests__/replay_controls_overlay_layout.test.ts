import { describe, expect, it, vi } from 'vitest';
import { ReplayControlsOverlay } from '../app/AppOverlays';

describe('replay controls overlay layout', () => {
  it('pins replay controls to top on mobile and bottom on larger screens', () => {
    const tree = ReplayControlsOverlay({
      isReplayMode: true,
      replayIndex: 1,
      replayLength: 10,
      replayActive: false,
      onToggleReplay: vi.fn(),
      onStepReplay: vi.fn(),
      onCloseReplay: vi.fn()
    });

    expect(tree).toBeTruthy();
    const className = String((tree as { props?: { className?: string } })?.props?.className ?? '');
    expect(className).toContain('top-3');
    expect(className).toContain('sm:bottom-12');
    expect(className).not.toContain('bottom-3');
  });
});
