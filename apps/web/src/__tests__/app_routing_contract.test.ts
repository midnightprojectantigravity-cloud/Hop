import { describe, expect, it } from 'vitest';
import { deriveAppRouting } from '../app/use-app-routing';

describe('app routing contract', () => {
  it('derives dedicated hub-adjacent paths and route booleans', () => {
    const routed = deriveAppRouting('/Hop/Settings');
    expect(routed.homePath).toBe('/Hop');
    expect(routed.hubPath).toBe('/Hop/Hub');
    expect(routed.arcadePath).toBe('/Hop/Arcade');
    expect(routed.biomesPath).toBe('/Hop/Biomes');
    expect(routed.themeLabPath).toBe('/Hop/ThemeLab');
    expect(routed.settingsPath).toBe('/Hop/Settings');
    expect(routed.leaderboardPath).toBe('/Hop/Leaderboard');
    expect(routed.tutorialsPath).toBe('/Hop/Tutorials');
    expect(routed.isSettingsRoute).toBe(true);
    expect(routed.isArcadeRoute).toBe(false);
    expect(routed.isHubRoute).toBe(false);
  });

  it('treats Hop root and legacy arcade paths as arcade home routes', () => {
    const home = deriveAppRouting('/Hop');
    expect(home.homePath).toBe('/Hop');
    expect(home.hubPath).toBe('/Hop/Hub');
    expect(home.isArcadeRoute).toBe(true);
    expect(home.isHubRoute).toBe(false);

    const arcade = deriveAppRouting('/Arcade');
    expect(arcade.homePath).toBe('/');
    expect(arcade.hubPath).toBe('/Hub');
    expect(arcade.isArcadeRoute).toBe(true);
    expect(arcade.isBiomesRoute).toBe(false);
    expect(arcade.isThemeLabRoute).toBe(false);
  });

  it('recognizes the dedicated strategic hub route', () => {
    const routed = deriveAppRouting('/Hop/Hub');

    expect(routed.isHubRoute).toBe(true);
    expect(routed.isArcadeRoute).toBe(false);
  });

  it('recognizes the theme manager route aliases', () => {
    expect(deriveAppRouting('/ThemeLab').isThemeLabRoute).toBe(true);
    expect(deriveAppRouting('/theme-manager').isThemeLabRoute).toBe(true);
    expect(deriveAppRouting('/style-guide').isThemeLabRoute).toBe(true);
  });
});
