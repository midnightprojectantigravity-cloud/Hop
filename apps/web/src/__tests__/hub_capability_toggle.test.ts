import { describe, expect, it, vi } from 'vitest';
import { generateHubState } from '@hop/engine';
import { Hub } from '../components/Hub';
import { buildStartRunPayload } from '../app/start-run-overrides';

type ElementLike = {
  type?: unknown;
  props?: Record<string, unknown> & { children?: unknown };
};

const findElement = (
  node: unknown,
  predicate: (element: ElementLike) => boolean
): ElementLike | null => {
  if (!node || typeof node !== 'object') return null;
  const element = node as ElementLike;
  if (predicate(element)) return element;
  const children = element.props?.children;
  if (!children) return null;

  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return null;
  }

  return findElement(children, predicate);
};

describe('hub capability-passives toggle interaction', () => {
  it('toggles enabled state and bridges into START_RUN payload overrides', () => {
    const hubState = generateHubState();
    let capabilityPassivesEnabled = false;
    const onCapabilityPassivesEnabledChange = vi.fn((enabled: boolean) => {
      capabilityPassivesEnabled = enabled;
    });

    const tree = Hub({
      gameState: hubState,
      capabilityPassivesEnabled,
      onCapabilityPassivesEnabledChange,
      onSelectLoadout: vi.fn(),
      onStartRun: vi.fn(),
      onOpenArcade: vi.fn(),
      onLoadScenario: vi.fn(),
      onStartReplay: vi.fn()
    });

    const toggleButton = findElement(
      tree,
      (element) => element.type === 'button' && Object.prototype.hasOwnProperty.call(element.props || {}, 'aria-pressed')
    );
    expect(toggleButton).toBeTruthy();

    (toggleButton?.props?.onClick as (() => void))();
    expect(onCapabilityPassivesEnabledChange).toHaveBeenCalledWith(true);
    expect(capabilityPassivesEnabled).toBe(true);

    const payload = buildStartRunPayload({
      loadoutId: 'VANGUARD',
      mode: 'normal',
      capabilityPassivesEnabled
    });
    expect(payload.rulesetOverrides?.capabilities?.loadoutPassivesEnabled).toBe(true);
  });
});

