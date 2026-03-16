import { describe, expect, it } from 'vitest';
import { resolveMeaningfulActionType, shouldArmAutoEndForAction } from '../app/turn-flow-policy';

describe('turn flow policy', () => {
  it('treats move and skill as meaningful player actions', () => {
    expect(resolveMeaningfulActionType({ type: 'MOVE', payload: { q: 0, r: 0, s: 0 } })).toBe('MOVE');
    expect(resolveMeaningfulActionType({ type: 'USE_SKILL', payload: { skillId: 'BASIC_MOVE' } })).toBe('USE_SKILL');
    expect(resolveMeaningfulActionType({ type: 'WAIT' })).toBeNull();
  });

  it('arms auto-end only in protected single mode while overdrive is idle', () => {
    expect(shouldArmAutoEndForAction({
      turnFlowMode: 'protected_single',
      overdriveState: 'idle',
      action: { type: 'MOVE', payload: { q: 0, r: 0, s: 0 } }
    })).toBe(true);

    expect(shouldArmAutoEndForAction({
      turnFlowMode: 'protected_single',
      overdriveState: 'armed',
      action: { type: 'MOVE', payload: { q: 0, r: 0, s: 0 } }
    })).toBe(false);

    expect(shouldArmAutoEndForAction({
      turnFlowMode: 'manual_chain',
      overdriveState: 'idle',
      action: { type: 'MOVE', payload: { q: 0, r: 0, s: 0 } }
    })).toBe(false);
  });
});
