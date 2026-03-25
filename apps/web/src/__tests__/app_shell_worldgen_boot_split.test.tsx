import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('app shell worldgen boot split', () => {
  it('keeps worldgen readiness out of the app boot contract', () => {
    const appShell = fs.readFileSync(
      path.resolve(__dirname, '../app/AppShell.tsx'),
      'utf8'
    );
    const bootSession = fs.readFileSync(
      path.resolve(__dirname, '../app/use-boot-session.ts'),
      'utf8'
    );

    expect(appShell).not.toContain('worldgenRuntimeReady');
    expect(appShell).toContain('bootSession.showBootOverlay');
    expect(bootSession).not.toContain('worldgenRuntimeReady');
    expect(bootSession).not.toContain('worldgenWorker');
  });
});
