import { describe, expect, it, vi } from 'vitest';
import { generateHubState } from '@hop/engine';
import { Hub } from '../components/Hub';

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

describe('hub start journey wiring', () => {
  it('shows no start controls when no archetype is selected', () => {
    const hubState = generateHubState();
    const tree = Hub({
      gameState: hubState,
      capabilityPassivesEnabled: false,
      onCapabilityPassivesEnabledChange: vi.fn(),
      movementRuntimeEnabled: false,
      onMovementRuntimeEnabledChange: vi.fn(),
      onSelectLoadout: vi.fn(),
      onStartRun: vi.fn(),
      onOpenArcade: vi.fn(),
      onLoadScenario: vi.fn(),
      onStartReplay: vi.fn()
    });

    const buttons = findElements(tree, (element) => element.type === 'button');
    const hasStartRun = buttons.some((button) => textOf(button.props?.children).includes('Start Run'));
    expect(hasStartRun).toBe(false);
  });

  it('routes start and daily CTA buttons to the proper modes', () => {
    const hubState = {
      ...generateHubState(),
      selectedLoadoutId: 'VANGUARD'
    };
    const onStartRun = vi.fn();

    const tree = Hub({
      gameState: hubState,
      capabilityPassivesEnabled: false,
      onCapabilityPassivesEnabledChange: vi.fn(),
      movementRuntimeEnabled: false,
      onMovementRuntimeEnabledChange: vi.fn(),
      onSelectLoadout: vi.fn(),
      onStartRun,
      onOpenArcade: vi.fn(),
      onLoadScenario: vi.fn(),
      onStartReplay: vi.fn()
    });

    const buttons = findElements(
      tree,
      (element) => element.type === 'button' && typeof element.props?.onClick === 'function'
    );

    const startButton = buttons.find((button) => textOf(button.props?.children).includes('Start Run'));
    const dailyButton = buttons.find((button) => textOf(button.props?.children).trim() === 'Daily');

    expect(startButton).toBeTruthy();
    expect(dailyButton).toBeTruthy();

    (startButton?.props?.onClick as (() => void))();
    (dailyButton?.props?.onClick as (() => void))();

    expect(onStartRun).toHaveBeenNthCalledWith(1, 'normal');
    expect(onStartRun).toHaveBeenNthCalledWith(2, 'daily');
  });
});
