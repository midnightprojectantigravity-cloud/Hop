import { describe, expect, it, vi } from 'vitest';
import { generateHubState } from '@hop/engine';
import { Hub } from '../components/Hub';

type ElementLike = {
  type?: unknown;
  props?: Record<string, unknown> & { children?: unknown };
};

const findElements = (node: unknown, predicate: (element: ElementLike) => boolean): ElementLike[] => {
  if (!node || typeof node !== 'object') return [];
  const element = node as ElementLike;
  const output: ElementLike[] = [];
  if (predicate(element)) output.push(element);
  const children = element.props?.children;
  if (!children) return output;
  if (Array.isArray(children)) {
    for (const child of children) {
      output.push(...findElements(child, predicate));
    }
    return output;
  }
  output.push(...findElements(children, predicate));
  return output;
};

const textOf = (node: unknown): string => {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((entry) => textOf(entry)).join(' ');
  if (typeof node === 'object') {
    const element = node as ElementLike;
    return textOf(element.props?.children);
  }
  return '';
};

describe('hub dedicated routes wiring', () => {
  it('shows dedicated route entry buttons when enabled', () => {
    const hubState = {
      ...generateHubState(),
      selectedLoadoutId: 'VANGUARD'
    };
    const tree = Hub({
      gameState: hubState,
      onSelectLoadout: vi.fn(),
      onStartRun: vi.fn(),
      onOpenArcade: vi.fn(),
      onOpenSettings: vi.fn(),
      onOpenLeaderboard: vi.fn(),
      onOpenTutorials: vi.fn(),
      onLoadScenario: vi.fn(),
      onStartReplay: vi.fn(),
      dedicatedRoutesEnabled: true,
      hubTrainingOnly: true
    });

    const buttons = findElements(tree, (element) => element.type === 'button');
    expect(buttons.some((button) => textOf(button.props?.children).includes('Settings'))).toBe(true);
    expect(buttons.some((button) => textOf(button.props?.children).includes('Leaderboard'))).toBe(true);
    expect(buttons.some((button) => textOf(button.props?.children).includes('Tutorials'))).toBe(true);
  });

  it('hides daily CTA when hub is training-only', () => {
    const hubState = {
      ...generateHubState(),
      selectedLoadoutId: 'VANGUARD'
    };
    const tree = Hub({
      gameState: hubState,
      onSelectLoadout: vi.fn(),
      onStartRun: vi.fn(),
      onOpenArcade: vi.fn(),
      onLoadScenario: vi.fn(),
      onStartReplay: vi.fn(),
      dedicatedRoutesEnabled: true,
      hubTrainingOnly: true
    });
    const buttons = findElements(tree, (element) => element.type === 'button');
    expect(buttons.some((button) => textOf(button.props?.children).trim() === 'Daily')).toBe(false);
  });
});
