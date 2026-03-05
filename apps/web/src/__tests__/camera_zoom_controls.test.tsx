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
      <CameraZoomControls activePreset={11} onSelectPreset={() => {}} />
    );

    expect(html).toContain('Zoom out to 11 tiles wide');
    expect(html).toContain('Zoom in to 7 tiles wide');
    expect(html).not.toContain('Fit');
    expect(html).not.toContain('zoom-7');
    expect(html).not.toContain('zoom-11');
  });

  it('maps minus to 11 and plus to 7 presets', () => {
    const onSelectPreset = vi.fn();
    const tree = CameraZoomControls({
      activePreset: 11,
      onSelectPreset
    });

    const buttons = findElements(
      tree,
      (element) => element.type === 'button' && typeof element.props?.onClick === 'function'
    );
    const minus = buttons.find((button) => String(button.props?.['aria-label'] || '').includes('Zoom out'));
    const plus = buttons.find((button) => String(button.props?.['aria-label'] || '').includes('Zoom in'));

    expect(minus).toBeTruthy();
    expect(plus).toBeTruthy();

    (minus?.props?.onClick as () => void)();
    (plus?.props?.onClick as () => void)();
    expect(onSelectPreset).toHaveBeenCalledTimes(2);
    expect(onSelectPreset.mock.calls[0][0]).toBe(11);
    expect(onSelectPreset.mock.calls[1][0]).toBe(7);
  });
});
