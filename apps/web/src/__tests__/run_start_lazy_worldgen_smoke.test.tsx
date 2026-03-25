import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('run start lazy worldgen smoke', () => {
  it('warms worldgen before compiling a new run', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/use-worldgen-session.ts'),
      'utf8'
    );

    expect(source).toContain("ensureWorldgenReady('start_run')");
    expect(source).toContain('compileRunStart(context)');
  });
});
