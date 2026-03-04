import { describe, expect, it, vi } from 'vitest';
import { RunLostOverlay } from '../app/AppOverlays';

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

const textOf = (node: unknown): string => {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((n) => textOf(n)).join(' ');
  if (typeof node === 'object') {
    const element = node as ElementLike;
    return textOf(element.props?.children);
  }
  return '';
};

describe('run lost overlay actions', () => {
  it('renders nothing when hidden', () => {
    const tree = RunLostOverlay({
      visible: false,
      onQuickRestart: vi.fn(),
      onViewReplay: vi.fn()
    });
    expect(tree).toBeNull();
  });

  it('wires quick restart and view replay buttons', () => {
    const onQuickRestart = vi.fn();
    const onViewReplay = vi.fn();

    const tree = RunLostOverlay({
      visible: true,
      onQuickRestart,
      onViewReplay
    });

    const buttons = findElements(
      tree,
      (element) => element.type === 'button' && typeof element.props?.onClick === 'function'
    );

    const quickRestartButton = buttons.find((button) => textOf(button.props?.children).includes('Quick Restart'));
    const viewReplayButton = buttons.find((button) => textOf(button.props?.children).includes('View Replay'));

    expect(quickRestartButton).toBeTruthy();
    expect(viewReplayButton).toBeTruthy();

    (quickRestartButton?.props?.onClick as (() => void))();
    (viewReplayButton?.props?.onClick as (() => void))();

    expect(onQuickRestart).toHaveBeenCalledTimes(1);
    expect(onViewReplay).toHaveBeenCalledTimes(1);
  });

  it('triggers onActionsReady callback when visible', () => {
    const onActionsReady = vi.fn();
    RunLostOverlay({
      visible: true,
      onQuickRestart: vi.fn(),
      onViewReplay: vi.fn(),
      onActionsReady
    });
    expect(onActionsReady).toHaveBeenCalledTimes(1);
  });
});
