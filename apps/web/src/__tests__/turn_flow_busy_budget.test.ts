import { describe, expect, it } from 'vitest';
import {
  POST_COMMIT_BUSY_WAIT_TIMEOUT_MS,
  POST_COMMIT_MIN_LOCK_MS,
  POST_COMMIT_RECHECK_INTERVAL_MS,
  resolvePostCommitExpectedBusyWaitBudgetMs,
} from '../app/use-turn-flow-coordinator';

describe('turn flow busy wait budget', () => {
  it('does not wait for a busy signal when the action has no blocking budget', () => {
    expect(resolvePostCommitExpectedBusyWaitBudgetMs(0)).toBe(0);
    expect(resolvePostCommitExpectedBusyWaitBudgetMs(-20)).toBe(0);
  });

  it('adds a small slack window for real blocking budgets', () => {
    expect(resolvePostCommitExpectedBusyWaitBudgetMs(40)).toBe(80);
    expect(resolvePostCommitExpectedBusyWaitBudgetMs(180)).toBe(210);
    expect(POST_COMMIT_MIN_LOCK_MS).toBe(100);
    expect(POST_COMMIT_RECHECK_INTERVAL_MS).toBe(60);
  });

  it('caps long waits at the busy timeout ceiling', () => {
    expect(resolvePostCommitExpectedBusyWaitBudgetMs(4_000)).toBe(POST_COMMIT_BUSY_WAIT_TIMEOUT_MS);
  });
});
