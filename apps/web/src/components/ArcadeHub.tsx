import React from 'react';
import { DEFAULT_LOADOUTS } from '@hop/engine';
import type { Loadout } from '@hop/engine';

interface ArcadeHubProps {
  onBack: () => void;
  onLaunchArcade: (loadoutId: string) => void;
  twoStepSelection?: boolean;
}

export const resolveArcadeSelectionInteraction = ({
  twoStepSelection,
  selectedLoadoutId,
  clickedLoadoutId
}: {
  twoStepSelection: boolean;
  selectedLoadoutId: string | null;
  clickedLoadoutId: string;
}): { nextSelectedLoadoutId: string | null; launchLoadoutId: string | null } => {
  if (twoStepSelection) {
    return {
      nextSelectedLoadoutId: clickedLoadoutId,
      launchLoadoutId: null
    };
  }
  return {
    nextSelectedLoadoutId: selectedLoadoutId ?? clickedLoadoutId,
    launchLoadoutId: clickedLoadoutId
  };
};

const ARCHETYPE_ART: Record<string, string> = {
  VANGUARD: 'V',
  HUNTER: 'H',
  FIREMAGE: 'F',
  NECROMANCER: 'N',
  SKIRMISHER: 'S',
};

const hashString = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
};

const toDateKey = (date = new Date()): string => date.toISOString().slice(0, 10);

const buildDailyPair = (loadouts: Loadout[], dateKey: string): [Loadout, Loadout] => {
  if (loadouts.length < 2) {
    throw new Error('Arcade mode requires at least two loadouts.');
  }

  const seedA = hashString(`arcade-a:${dateKey}`);
  const firstIdx = seedA % loadouts.length;
  const first = loadouts[firstIdx]!;

  const remaining = loadouts.filter(l => l.id !== first.id);
  const seedB = hashString(`arcade-b:${dateKey}`);
  const secondIdx = seedB % remaining.length;
  const second = remaining[secondIdx]!;

  return [first, second];
};

export const ArcadeHub: React.FC<ArcadeHubProps> = ({ onBack, onLaunchArcade, twoStepSelection = false }) => {
  const allLoadouts = React.useMemo(() => Object.values(DEFAULT_LOADOUTS), []);
  const dateKey = React.useMemo(() => toDateKey(), []);
  const [left, right] = React.useMemo(() => buildDailyPair(allLoadouts, dateKey), [allLoadouts, dateKey]);
  const pair = React.useMemo(() => [left, right], [left, right]);
  const [selectedLoadoutId, setSelectedLoadoutId] = React.useState<string | null>(twoStepSelection ? null : left.id);
  const selectedLoadout = pair.find((entry) => entry.id === selectedLoadoutId) || null;

  return (
    <div className="surface-app-material w-full h-full flex flex-col bg-[var(--surface-app)]">
      <header className="surface-panel-material torn-edge-shell border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 lg:px-12 py-3 bg-[color:var(--surface-panel)] backdrop-blur-xl z-30">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight font-[var(--font-heading)]">
            Hop <span className="text-[var(--accent-royal)]">Arcade</span>
          </h1>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)] mt-1">Daily Draft {dateKey}</div>
        </div>
        <button
          onClick={onBack}
          className="w-full sm:w-auto min-h-11 px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-hover)] hover:bg-[var(--surface-panel)] text-xs font-black uppercase tracking-widest"
        >
          Back to Strategic Hub
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 sm:mb-10">
            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight font-[var(--font-heading)] mb-3">Arcade Mode</h2>
            <p className="text-[var(--text-secondary)] max-w-3xl">
              Pick one of two daily archetypes and run the seeded challenge. Both options share the same seed for fair comparison.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {pair.map((loadout, idx) => {
              const mirrored = idx === 1;
              const glyph = ARCHETYPE_ART[loadout.id] || loadout.id.slice(0, 1);
              const isSelected = selectedLoadoutId === loadout.id;
              return (
                <button
                  key={loadout.id}
                  onClick={() => {
                    const interaction = resolveArcadeSelectionInteraction({
                      twoStepSelection,
                      selectedLoadoutId,
                      clickedLoadoutId: loadout.id
                    });
                    setSelectedLoadoutId(interaction.nextSelectedLoadoutId);
                    if (interaction.launchLoadoutId) {
                      onLaunchArcade(interaction.launchLoadoutId);
                    }
                  }}
                  className={`w-full text-left group rounded-3xl border transition-all p-4 sm:p-6 ${
                    isSelected
                      ? 'border-[var(--accent-royal)] bg-[var(--accent-royal-soft)]'
                      : 'border-[var(--border-subtle)] bg-gradient-to-r from-[var(--surface-panel-hover)] to-[var(--surface-panel-muted)] hover:brightness-105'
                  }`}
                >
                  <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 ${mirrored ? 'sm:flex-row-reverse' : ''}`}>
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div
                        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] flex items-center justify-center text-3xl sm:text-4xl font-black text-[var(--accent-brass)] shadow-[0_0_35px_rgba(180,141,80,0.25)] ${mirrored ? '-scale-x-100' : ''}`}
                      >
                        {glyph}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--text-muted)]">Daily Archetype</div>
                        <div className="text-xl sm:text-2xl font-black uppercase tracking-tight truncate">{loadout.name}</div>
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">Starting Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {loadout.startingSkills.slice(0, 6).map(skill => (
                          <span key={skill} className="text-[10px] px-2 py-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel)] font-bold tracking-wide">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-left sm:text-right sm:min-w-[150px]">
                      <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--text-muted)]">Launch</div>
                      <div className="text-sm font-black uppercase tracking-widest text-[var(--accent-royal)] group-hover:opacity-85">
                        {twoStepSelection ? (isSelected ? 'Selected' : 'Select') : 'Start Arcade Run'}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {twoStepSelection && (
            <section className="surface-panel-material torn-edge-shell mt-6 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4 sm:p-6">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-black mb-2">Selection Details</div>
              {selectedLoadout ? (
                <>
                  <div className="text-xl font-black uppercase tracking-tight mb-2">{selectedLoadout.name}</div>
                  <p className="text-[var(--text-secondary)] text-sm mb-4">
                    Daily seeded run. You can switch archetypes before confirming launch.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedLoadout.startingSkills.map(skill => (
                      <span key={`sel-${skill}`} className="text-[10px] px-2 py-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] font-bold tracking-wide">
                        {skill}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--text-muted)] mb-4">Select a daily archetype to inspect details and launch.</p>
              )}
              <button
                disabled={!selectedLoadout}
                onClick={() => {
                  if (!selectedLoadout) return;
                  onLaunchArcade(selectedLoadout.id);
                }}
                className={`w-full min-h-12 rounded-2xl text-xs font-black uppercase tracking-[0.2em] border ${
                  selectedLoadout
                    ? 'border-[var(--accent-brass)] bg-[var(--accent-brass-soft)] text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[var(--text-muted)] opacity-60'
                }`}
              >
                Start
              </button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

