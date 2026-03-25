import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('worldgen worker lazy init', () => {
  it('keeps worker creation behind ensureReady instead of mount-time boot', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/use-worldgen-worker.ts'),
      'utf8'
    );

    expect(source).toContain("phase: 'idle'");
    expect(source).toContain('ensureReady: () => Promise<void>');
    expect(source).toContain("worker.postMessage({ type: 'INITIALIZE' }");
    expect(source).not.toContain("postMessage({ type: 'BOOT' }");
  });
});
