import { describe, expect, it } from 'vitest';
import { canSelectSkillForTutorialStep } from '../app/tutorial/tutorial-gates';

describe('tutorial skill selection gates', () => {
  it('allows skill selection when no guided tutorial step is active', () => {
    expect(canSelectSkillForTutorialStep(null, 'FIREBALL')).toBe(true);
    expect(canSelectSkillForTutorialStep(null, 'JUMP')).toBe(true);
  });

  it('blocks skill selection outside the attack tutorial step', () => {
    expect(canSelectSkillForTutorialStep('movement', 'FIREBALL')).toBe(false);
    expect(canSelectSkillForTutorialStep('wait', 'FIREBALL')).toBe(false);
  });

  it('allows only non-movement skills during the attack tutorial step', () => {
    expect(canSelectSkillForTutorialStep('attack', 'FIREBALL')).toBe(true);
    expect(canSelectSkillForTutorialStep('attack', 'BASIC_MOVE')).toBe(false);
    expect(canSelectSkillForTutorialStep('attack', 'DASH')).toBe(false);
  });
});
