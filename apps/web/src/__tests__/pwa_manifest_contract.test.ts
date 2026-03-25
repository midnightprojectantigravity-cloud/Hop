import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('pwa manifest contract', () => {
  it('ships a standalone manifest with Hop scope and icons', () => {
    const manifestPath = path.resolve(__dirname, '../../public/manifest.webmanifest');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      start_url: string;
      scope: string;
      display: string;
      icons: Array<{ src: string }>;
    };

    expect(manifest.start_url).toBe('/Hop/');
    expect(manifest.scope).toBe('/Hop/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.map((icon) => icon.src)).toContain('/Hop/pwa/icon-192.svg');
    expect(manifest.icons.map((icon) => icon.src)).toContain('/Hop/pwa/icon-512.svg');
  });
});
