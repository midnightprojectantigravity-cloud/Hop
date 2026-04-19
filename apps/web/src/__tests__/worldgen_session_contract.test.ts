import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('worldgen session contract', () => {
  it('centralizes lazy init, run-start, pending floor, and arcade gate orchestration', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/use-worldgen-session.ts'),
      'utf8'
    );

    expect(source).toContain('export interface WorldgenSessionController');
    expect(source).toContain('usePendingFloorWorldgen');
    expect(source).toContain('ensureWorldgenReady');
    expect(source).toContain('worldgenWarmState');
    expect(source).toContain('compileRunStart');
    expect(source).not.toContain('handleEnterArcadeSplash');
    expect(source).not.toContain('handleOpenHubFromArcadeSplash');
    expect(source).not.toContain('resolveArcadeSplashStartRunRequest');
  });
});
