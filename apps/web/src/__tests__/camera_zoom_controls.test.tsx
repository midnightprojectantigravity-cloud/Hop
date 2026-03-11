import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CameraZoomControls } from '../components/game-board/CameraZoomControls';

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

describe('camera zoom controls', () => {
  it('renders only icon plus/minus controls', () => {
    const html = renderToStaticMarkup(
      <CameraZoomControls
        activeMode="tactical"
        isDetached={false}
        onSelectMode={() => {}}
        onRecenter={() => {}}
      />
    );

    expect(html).toContain('Zoom out to tactical view');
    expect(html).toContain('Zoom in to action view');
    expect(html).not.toContain('Fit');
    expect(html).not.toContain('zoom-7');
    expect(html).not.toContain('zoom-11');
  });

  it('maps minus to tactical, plus to action, and lens to recenter', () => {
    const onSelectMode = vi.fn();
    const onRecenter = vi.fn();
    const tree = CameraZoomControls({
      activeMode: 'tactical',
      isDetached: true,
      onSelectMode,
      onRecenter
    });

    const buttons = findElements(
      tree,
      (element) => element.type === 'button' && typeof element.props?.onClick === 'function'
    );
    const lens = buttons.find((button) => String(button.props?.['aria-label'] || '').includes('Recenter'));
    const minus = buttons.find((button) => String(button.props?.['aria-label'] || '').includes('Zoom out'));
    const plus = buttons.find((button) => String(button.props?.['aria-label'] || '').includes('Zoom in'));

    expect(lens).toBeTruthy();
    expect(minus).toBeTruthy();
    expect(plus).toBeTruthy();

    (lens?.props?.onClick as () => void)();
    (minus?.props?.onClick as () => void)();
    (plus?.props?.onClick as () => void)();
    expect(onRecenter).toHaveBeenCalledTimes(1);
    expect(onSelectMode).toHaveBeenCalledTimes(2);
    expect(onSelectMode.mock.calls[0][0]).toBe('tactical');
    expect(onSelectMode.mock.calls[1][0]).toBe('action');
  });
});
