// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { GameBoard } from '../components/GameBoard';
import { TILE_SIZE, SkillRegistry, generateInitialState, hexToPixel, type Point } from '@hop/engine';

const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 600;

const parseViewBox = (value: string | null): { x: number; y: number; width: number; height: number } => {
  const [x, y, width, height] = (value || '0 0 1 1').split(/\s+/).map(Number);
  return { x, y, width, height };
};

const getForwardScreenPoint = (svg: SVGSVGElement, worldPoint: { x: number; y: number }) => {
  const rect = svg.getBoundingClientRect();
  const viewBox = parseViewBox(svg.getAttribute('viewBox'));
  const scale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height);
  const renderedWidth = viewBox.width * scale;
  const renderedHeight = viewBox.height * scale;
  const offsetX = rect.left + ((rect.width - renderedWidth) / 2);
  const offsetY = rect.top + ((rect.height - renderedHeight) / 2);

  return {
    x: offsetX + ((worldPoint.x - viewBox.x) * scale),
    y: offsetY + ((worldPoint.y - viewBox.y) * scale),
  };
};

describe('game board skill click', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let resizeObserverCallback: ResizeObserverCallback | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.documentElement.dataset.motion = 'snappy';
    container = document.createElement('div');
    document.body.appendChild(container);

    if (!window.PointerEvent) {
      // jsdom lacks PointerEvent, but the board only uses mouse-specific fields in this test.
      (window as typeof window & { PointerEvent?: typeof MouseEvent }).PointerEvent = MouseEvent as unknown as typeof PointerEvent;
    }

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => window.setTimeout(() => cb(Date.now()), 0));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));

    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }

      observe(target: Element) {
        resizeObserverCallback?.([
          {
            target,
            contentRect: DOMRect.fromRect({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }),
          } as ResizeObserverEntry,
        ], this as unknown as ResizeObserver);
      }

      disconnect() {}
      unobserve() {}
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);

    const rect = DOMRect.fromRect({
      x: 0,
      y: 0,
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
    });

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => rect);
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockImplementation(() => rect);

    Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
      configurable: true,
      value: function getScreenCTM(this: SVGSVGElement) {
        const svg = this;
        return {
          inverse() {
            return {
              transformPoint(point: { x: number; y: number }) {
                const bounds = svg.getBoundingClientRect();
                const viewBox = parseViewBox(svg.getAttribute('viewBox'));
                const scale = Math.min(bounds.width / viewBox.width, bounds.height / viewBox.height);
                const renderedWidth = viewBox.width * scale;
                const renderedHeight = viewBox.height * scale;
                const offsetX = bounds.left + ((bounds.width - renderedWidth) / 2);
                const offsetY = bounds.top + ((bounds.height - renderedHeight) / 2);

                return {
                  x: viewBox.x + ((point.x - offsetX) / scale),
                  y: viewBox.y + ((point.y - offsetY) / scale),
                };
              },
            };
          },
        } as unknown as DOMMatrix;
      },
    });

    Object.defineProperty(SVGSVGElement.prototype, 'createSVGPoint', {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        matrixTransform(matrix: { transformPoint: (point: { x: number; y: number }) => { x: number; y: number } }) {
          return matrix.transformPoint({ x: this.x, y: this.y });
        },
      } as SVGPoint),
    });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete document.documentElement.dataset.motion;
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('dispatches a tile click for a selected skill target', async () => {
    const gameState = generateInitialState(1, 'game-board-skill-click');
    const jumpTarget = SkillRegistry.get('JUMP')?.getValidTargets?.(gameState, gameState.player.position)?.[0];

    expect(jumpTarget).toBeTruthy();

    const onMove = vi.fn();
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <GameBoard
          gameState={gameState}
          onMove={onMove}
          selectedSkillId="JUMP"
          showMovementRange={false}
        />
      );
    });

    await act(async () => {
      vi.runAllTimers();
    });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    const worldPoint = hexToPixel(jumpTarget as Point, TILE_SIZE);
    const screenPoint = getForwardScreenPoint(svg as SVGSVGElement, worldPoint);
    const pointerInit = {
      bubbles: true,
      button: 0,
      pointerId: 1,
      pointerType: 'mouse',
      clientX: screenPoint.x,
      clientY: screenPoint.y,
    };

    await act(async () => {
      svg?.dispatchEvent(new window.PointerEvent('pointerdown', pointerInit));
      svg?.dispatchEvent(new window.PointerEvent('pointerup', pointerInit));
      vi.runAllTimers();
    });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(jumpTarget, undefined);
  });
});
