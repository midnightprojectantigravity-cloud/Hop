import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('worldgen worker protocol contract', () => {
  it('uses initialize-first messages and omits boot registry metadata', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/worldgen-worker-protocol.ts'),
      'utf8'
    );

    expect(source).toContain("type: 'INITIALIZE'");
    expect(source).toContain("type: 'INITIALIZE_OK'");
    expect(source).toContain("type: 'INITIALIZE_ERROR'");
    expect(source).not.toContain("type: 'BOOT'");
    expect(source).not.toContain("type: 'BOOT_OK'");
    expect(source).not.toContain("type: 'BOOT_ERROR'");
    expect(source).not.toContain('registryVersion');
    expect(source).not.toContain('specSchemaVersion');
    expect(source).not.toContain('moduleCount');
  });
});
