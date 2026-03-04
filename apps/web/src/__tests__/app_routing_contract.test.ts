import { describe, expect, it } from 'vitest';
import { deriveAppRouting } from '../app/use-app-routing';

describe('app routing contract', () => {
  it('derives dedicated hub-adjacent paths and route booleans', () => {
    const routed = deriveAppRouting('/Hop/Settings');
    expect(routed.hubPath).toBe('/Hop');
    expect(routed.arcadePath).toBe('/Hop/Arcade');
    expect(routed.biomesPath).toBe('/Hop/Biomes');
    expect(routed.settingsPath).toBe('/Hop/Settings');
    expect(routed.leaderboardPath).toBe('/Hop/Leaderboard');
    expect(routed.tutorialsPath).toBe('/Hop/Tutorials');
    expect(routed.isSettingsRoute).toBe(true);
    expect(routed.isArcadeRoute).toBe(false);
  });

  it('keeps legacy route behavior intact', () => {
    const arcade = deriveAppRouting('/Arcade');
    expect(arcade.hubPath).toBe('/');
    expect(arcade.isArcadeRoute).toBe(true);
    expect(arcade.isBiomesRoute).toBe(false);
  });
});

