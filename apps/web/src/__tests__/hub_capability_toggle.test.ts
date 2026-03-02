import { describe, expect, it, vi } from 'vitest';
import { generateHubState } from '@hop/engine';
import { Hub } from '../components/Hub';
import { buildStartRunPayload } from '../app/start-run-overrides';

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

describe('hub capability-passives toggle interaction', () => {
  it('toggles enabled state and bridges into START_RUN payload overrides', () => {
    const hubState = generateHubState();
    let capabilityPassivesEnabled = false;
    let movementRuntimeEnabled = false;
    const onCapabilityPassivesEnabledChange = vi.fn((enabled: boolean) => {
      capabilityPassivesEnabled = enabled;
    });
    const onMovementRuntimeEnabledChange = vi.fn((enabled: boolean) => {
      movementRuntimeEnabled = enabled;
    });

    const tree = Hub({
      gameState: hubState,
      capabilityPassivesEnabled,
      onCapabilityPassivesEnabledChange,
      movementRuntimeEnabled,
      onMovementRuntimeEnabledChange,
      onSelectLoadout: vi.fn(),
      onStartRun: vi.fn(),
      onOpenArcade: vi.fn(),
      onLoadScenario: vi.fn(),
      onStartReplay: vi.fn()
    });

    const toggleButtons = findElements(
      tree,
      (element) => element.type === 'button' && Object.prototype.hasOwnProperty.call(element.props || {}, 'aria-pressed')
    );
    expect(toggleButtons.length).toBeGreaterThanOrEqual(2);

    (toggleButtons[0].props?.onClick as (() => void))();
    expect(onCapabilityPassivesEnabledChange).toHaveBeenCalledWith(true);
    expect(capabilityPassivesEnabled).toBe(true);

    (toggleButtons[1].props?.onClick as (() => void))();
    expect(onMovementRuntimeEnabledChange).toHaveBeenCalledWith(true);
    expect(movementRuntimeEnabled).toBe(true);

    const payload = buildStartRunPayload({
      loadoutId: 'VANGUARD',
      mode: 'normal',
      capabilityPassivesEnabled,
      movementRuntimeEnabled
    });
    expect(payload.rulesetOverrides?.capabilities?.loadoutPassivesEnabled).toBe(true);
    expect(payload.rulesetOverrides?.capabilities?.movementRuntimeEnabled).toBe(true);
  });
});
