import { describe, expect, it, vi } from 'vitest';
import { ReplayControlsOverlay } from '../app/AppOverlays';

type ElementLike = {
  type?: unknown;
  props?: Record<string, unknown> & { children?: unknown };
};

const findElements = (
  node: unknown,
  predicate: (element: ElementLike) => boolean
): ElementLike[] => {
  if (!node || typeof node !== 'object') return [];
  const element = node as ElementLike;
  const out: ElementLike[] = [];
  if (predicate(element)) out.push(element);
  const children = element.props?.children;
  if (!children) return out;
  if (Array.isArray(children)) {
    for (const child of children) {
      out.push(...findElements(child, predicate));
    }
    return out;
  }
  out.push(...findElements(children, predicate));
  return out;
};

describe('replay controls overlay layout', () => {
  it('pins replay controls to top on mobile and bottom on larger screens', () => {
    const tree = ReplayControlsOverlay({
      isReplayMode: true,
      replayIndex: 1,
      replayLength: 10,
      replayActive: false,
      onToggleReplay: vi.fn(),
      onStepReplay: vi.fn(),
      onJumpReplay: vi.fn(),
      onCloseReplay: vi.fn()
    });

    expect(tree).toBeTruthy();
    const className = String((tree as { props?: { className?: string } })?.props?.className ?? '');
    expect(className).toContain('top-3');
    expect(className).toContain('sm:bottom-12');
    expect(className).not.toContain('bottom-3');
  });

  it('renders timeline pips and wires jump callback', () => {
    const onJumpReplay = vi.fn();
    const tree = ReplayControlsOverlay({
      isReplayMode: true,
      replayIndex: 2,
      replayLength: 12,
      replayActive: false,
      onToggleReplay: vi.fn(),
      onStepReplay: vi.fn(),
      onJumpReplay,
      onCloseReplay: vi.fn()
    });

    const jumpButtons = findElements(
      tree,
      (element) =>
        element.type === 'button'
        && typeof element.props?.onClick === 'function'
        && String(element.props?.title || '').startsWith('Jump to')
    );
    expect(jumpButtons.length).toBeGreaterThan(1);
    (jumpButtons[0]?.props?.onClick as () => void)();
    expect(onJumpReplay).toHaveBeenCalledTimes(1);
  });
});
