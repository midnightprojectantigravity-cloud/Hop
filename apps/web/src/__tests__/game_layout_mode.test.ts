import { describe, expect, it } from 'vitest';
import { resolveBottomDockHeightPx, resolveHudScale, resolveLayoutMode } from '../app/GameScreen';

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

  it('resolves shared hud scale within clamped bounds', () => {
    expect(resolveHudScale(360, 800)).toBeCloseTo(0.923, 3);
    expect(resolveHudScale(390, 844)).toBe(1);
    expect(resolveHudScale(412, 915)).toBeCloseTo(1.056, 3);
    expect(resolveHudScale(768, 1024)).toBe(1.24);
  });

  it('resolves bottom dock height from viewport ratio with clamp range', () => {
    expect(resolveBottomDockHeightPx(360, 800)).toBe(216);
    expect(resolveBottomDockHeightPx(390, 844)).toBe(228);
    expect(resolveBottomDockHeightPx(412, 915)).toBe(247);
    expect(resolveBottomDockHeightPx(768, 1024)).toBe(246);
  });
});
