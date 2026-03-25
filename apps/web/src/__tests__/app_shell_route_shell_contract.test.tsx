import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('app shell route shell contract', () => {
  it('delegates boot, tutorial, worldgen, run, and route rendering to extracted modules', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/AppShell.tsx'),
      'utf8'
    );

    expect(source).toContain("from './use-boot-session'");
    expect(source).toContain("from './use-tutorial-session'");
    expect(source).toContain("from './use-worldgen-session'");
    expect(source).toContain("from './use-run-controller'");
    expect(source).toContain('<UtilityRouteShell');
    expect(source).toContain('<HubRouteShell');
    expect(source).toContain('<RunRouteShell');
  });
});
