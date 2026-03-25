import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('run controller contract', () => {
  it('owns in-run action handlers and overlay timing', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/use-run-controller.ts'),
      'utf8'
    );

    expect(source).toContain('export interface RunController');
    expect(source).toContain('handleTileClick');
    expect(source).toContain('handleWait');
    expect(source).toContain('handleQuickRestart');
    expect(source).toContain('handleRunLostActionsReady');
    expect(source).toContain('showRunLostOverlay');
  });
});
