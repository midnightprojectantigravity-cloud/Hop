import React from 'react';
import { DEFAULT_LOADOUTS } from '@hop/engine';
import type { Loadout } from '@hop/engine';

interface ArcadeHubProps {
  onBack: () => void;
  onLaunchArcade: (loadoutId: string) => void;
}

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

export const ArcadeHub: React.FC<ArcadeHubProps> = ({ onBack, onLaunchArcade }) => {
  const allLoadouts = React.useMemo(() => Object.values(DEFAULT_LOADOUTS), []);
  const dateKey = React.useMemo(() => toDateKey(), []);
  const [left, right] = React.useMemo(() => buildDailyPair(allLoadouts, dateKey), [allLoadouts, dateKey]);

  return (
    <div className="w-full h-full flex flex-col bg-[#040a18]">
      <header className="h-20 border-b border-white/10 flex items-center justify-between px-12 bg-[#050b1f]/80 backdrop-blur-xl z-30">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight italic">
            Hop <span className="text-emerald-400">Arcade</span>
          </h1>
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 mt-1">Daily Draft {dateKey}</div>
        </div>
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest"
        >
          Back to Strategic Hub
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-12">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <h2 className="text-4xl font-black uppercase tracking-tight italic mb-3">Arcade Mode</h2>
            <p className="text-white/60 max-w-3xl">
              Pick one of two daily archetypes and run the seeded challenge. Both options share the same seed for fair comparison.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {[left, right].map((loadout, idx) => {
              const mirrored = idx === 1;
              const glyph = ARCHETYPE_ART[loadout.id] || loadout.id.slice(0, 1);
              return (
                <button
                  key={loadout.id}
                  onClick={() => onLaunchArcade(loadout.id)}
                  className="w-full text-left group rounded-3xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-white/[0.02] hover:from-emerald-500/20 hover:to-cyan-500/10 transition-all p-6"
                >
                  <div className={`flex items-center justify-between gap-6 ${mirrored ? 'flex-row-reverse' : ''}`}>
                    <div className="flex items-center gap-4 min-w-[200px]">
                      <div
                        className={`w-20 h-20 rounded-2xl border border-white/15 bg-[#0b1733] flex items-center justify-center text-4xl font-black text-emerald-300 shadow-[0_0_35px_rgba(16,185,129,0.25)] ${mirrored ? '-scale-x-100' : ''}`}
                      >
                        {glyph}
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Daily Archetype</div>
                        <div className="text-2xl font-black uppercase tracking-tight">{loadout.name}</div>
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">Starting Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {loadout.startingSkills.slice(0, 6).map(skill => (
                          <span key={skill} className="text-[10px] px-2 py-1 rounded-full border border-white/20 bg-white/5 font-bold tracking-wide">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-right min-w-[150px]">
                      <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Launch</div>
                      <div className="text-sm font-black uppercase tracking-widest text-emerald-300 group-hover:text-emerald-200">
                        Start Arcade Run
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

