import { describe, expect, it } from 'vitest';
import { resolveLayoutMode } from '../app/GameScreen';

describe('game layout mode breakpoints', () => {
  it('resolves mobile portrait for narrow portrait phones', () => {
    expect(resolveLayoutMode(360, 780)).toBe('mobile_portrait');
    expect(resolveLayoutMode(390, 844)).toBe('mobile_portrait');
    expect(resolveLayoutMode(430, 932)).toBe('mobile_portrait');
  });

  it('resolves tablet for medium widths and narrow landscape', () => {
    expect(resolveLayoutMode(700, 360)).toBe('tablet');
    expect(resolveLayoutMode(768, 1024)).toBe('tablet');
  });

  it('resolves desktop command center at and above 1200px width', () => {
    expect(resolveLayoutMode(1199, 900)).toBe('tablet');
    expect(resolveLayoutMode(1200, 800)).toBe('desktop_command_center');
    expect(resolveLayoutMode(1280, 800)).toBe('desktop_command_center');
    expect(resolveLayoutMode(1440, 900)).toBe('desktop_command_center');
  });
});
