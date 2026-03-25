import { describe, expect, it } from 'vitest';
import {
  advanceTutorialSession,
  createTutorialSession,
  readTutorialProgress,
  resetTutorialProgress,
  shouldPromptForTutorial,
  writeTutorialProgress
} from '../app/tutorial/tutorial-state-machine';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.has(key) ? (this.values.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('tutorial state machine', () => {
  it('advances across the three-step sequence', () => {
    const first = createTutorialSession();
    expect(first.stepIndex).toBe(0);
    const second = advanceTutorialSession(first);
    expect(second?.stepIndex).toBe(1);
    const third = second ? advanceTutorialSession(second) : null;
    expect(third?.stepIndex).toBe(2);
    expect(third ? advanceTutorialSession(third) : null).toBeNull();
  });

  it('persists and resets tutorial progress', () => {
    const storage = new MemoryStorage();
    writeTutorialProgress({
      completed: true,
      skipped: false,
      lastStepId: 'wait'
    }, storage);
    expect(readTutorialProgress(storage)).toEqual({
      completed: true,
      skipped: false,
      lastStepId: 'wait'
    });
    expect(resetTutorialProgress(storage)).toEqual({
      completed: false,
      skipped: false,
      lastStepId: null
    });
  });

  it('prompts only when tutorial has not been completed or skipped', () => {
    expect(shouldPromptForTutorial({ completed: false, skipped: false, lastStepId: null })).toBe(true);
    expect(shouldPromptForTutorial({ completed: true, skipped: false, lastStepId: 'wait' })).toBe(false);
    expect(shouldPromptForTutorial({ completed: false, skipped: true, lastStepId: null })).toBe(false);
  });
});
