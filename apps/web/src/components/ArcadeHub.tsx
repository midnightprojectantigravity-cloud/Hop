import React from 'react';
import type { FloorTheme } from '@hop/engine';
import { DEFAULT_LOADOUTS } from '../../../../packages/engine/src/systems/loadout';
import type { Loadout } from '@hop/engine';
import splashPlaceholderImage from '../assets/ui/splash-placeholder.webp';

export interface ArcadeBiomeChoice {
  loadoutId: string;
  themeId: FloorTheme;
  contentThemeId: FloorTheme;
  label: string;
  description: string;
}

export const ARCADE_BIOME_CHOICES: ArcadeBiomeChoice[] = [
  {
    loadoutId: 'VANGUARD',
    themeId: 'inferno',
    contentThemeId: 'inferno',
    label: 'Vanguard + Inferno',
    description: 'Current arena baseline. Red ground, lava undercurrents, and inferno clutter.'
  },
  {
    loadoutId: 'HUNTER',
    themeId: 'void',
    contentThemeId: 'inferno',
    label: 'Hunter + Void',
    description: 'Black void treatment with poison tiles instead of lava, plus a darker biome presentation.'
  }
];

interface ArcadeHubProps {
  onBack: () => void;
  onLaunchArcade: (loadoutId: string, themeId: FloorTheme, contentThemeId: FloorTheme) => void;
}

const getLoadout = (loadoutId: string): Loadout | undefined => DEFAULT_LOADOUTS[loadoutId];

export const ArcadeHub: React.FC<ArcadeHubProps> = ({ onBack, onLaunchArcade }) => {
  return (
    <div
      className="relative isolate w-full h-full flex flex-col overflow-hidden bg-[var(--surface-app)]"
      style={{
        backgroundImage: `url(${splashPlaceholderImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,24,39,0.28),rgba(5,7,15,0.86)_60%),linear-gradient(180deg,rgba(6,9,18,0.24),rgba(6,9,18,0.74))]" />
      <header className="surface-panel-material torn-edge-shell relative z-10 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 lg:px-12 py-3 bg-[rgba(10,12,20,0.82)] backdrop-blur-xl">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight font-[var(--font-heading)]">
            Hop <span className="text-[var(--accent-royal)]">Arcade</span>
          </h1>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)] mt-1">
            Choose a biome-backed run on the splash backdrop
          </div>
        </div>
        <button
          onClick={onBack}
          className="w-full sm:w-auto min-h-11 px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-hover)] hover:bg-[var(--surface-panel)] text-xs font-black uppercase tracking-widest"
        >
          Hub
        </button>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 sm:mb-10">
            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight font-[var(--font-heading)] mb-3">
              Arcade <span className="text-[var(--accent-royal)]">Biome Draft</span>
            </h2>
            <p className="text-[var(--text-secondary)] max-w-3xl">
              Pick one of the two bundled archetype and biome combinations. The chosen theme is threaded through run start and the rest of the floor transitions.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            {ARCADE_BIOME_CHOICES.map((choice) => {
              const loadout = getLoadout(choice.loadoutId);
              const glyph = choice.loadoutId.slice(0, 1);
              const launchLabel = choice.loadoutId === 'HUNTER' ? 'Start Hunter' : 'Start Vanguard';
              return (
                <button
                  key={choice.loadoutId}
                  type="button"
                  onClick={() => onLaunchArcade(choice.loadoutId, choice.themeId, choice.contentThemeId)}
                  className="group text-left rounded-[2rem] border border-[var(--border-subtle)] bg-gradient-to-br from-[rgba(20,25,37,0.82)] to-[rgba(9,12,18,0.90)] p-5 sm:p-6 transition-all hover:brightness-105 hover:scale-[1.01] backdrop-blur-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl border border-[var(--border-subtle)] bg-[rgba(17,24,39,0.75)] flex items-center justify-center text-3xl sm:text-4xl font-black text-[var(--accent-brass)] shadow-[0_0_35px_rgba(180,141,80,0.25)]">
                      {glyph}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--text-muted)]">
                        Biome Choice
                      </div>
                      <div className="text-xl sm:text-2xl font-black uppercase tracking-tight truncate mt-1">
                        {choice.label}
                      </div>
                      <div className="mt-2 inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[rgba(17,24,39,0.72)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent-royal)]">
                        {choice.themeId}
                      </div>
                      <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
                        {choice.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 sm:items-end">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">Starting Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {(loadout?.startingSkills || []).slice(0, 6).map((skill) => (
                          <span
                            key={skill}
                            className="text-[10px] px-2 py-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel)] font-bold tracking-wide"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--text-muted)]">Launch</div>
                      <div className="text-sm font-black uppercase tracking-widest text-[var(--accent-royal)] group-hover:opacity-85">
                        {launchLabel}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};
