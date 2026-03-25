import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('boot session contract', () => {
  it('keeps shell and asset boot orchestration outside AppShell', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/use-boot-session.ts'),
      'utf8'
    );

    expect(source).toContain('export interface BootSession');
    expect(source).toContain('deriveBootState');
    expect(source).toContain("emitUiMetric('boot_shell_ready_ms'");
    expect(source).toContain("emitUiMetric('boot_asset_manifest_ready_ms'");
    expect(source).toContain("emitUiMetric('boot_ready_ms'");
    expect(source).toContain('showBootOverlay');
    expect(source).not.toContain('worldgenRuntimeReady');
    expect(source).not.toContain('Promise.allSettled');
  });
});
