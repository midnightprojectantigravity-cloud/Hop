
import React from 'react';
import type { Loadout } from '@hop/engine';
import { DEFAULT_LOADOUTS } from '../../../../packages/engine/src/systems/loadout';
import { getEntityVisual } from '../../../../packages/engine/src/systems/visual/visual-registry';

interface ArchetypeSelectorProps {
    onSelect: (loadout: Loadout) => void;
    selectedLoadoutId?: string;
}

export const ArchetypeSelector: React.FC<ArchetypeSelectorProps> = ({ onSelect, selectedLoadoutId }) => {
    return (
        <div className="relative z-50 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 gap-5 sm:gap-8 animate-in fade-in zoom-in duration-500">
            <div className="text-center space-y-2">
                <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-widest text-[var(--text-primary)] mb-2 font-[var(--font-heading)]">Select Class</h1>
                <p className="text-[var(--text-muted)] text-sm uppercase tracking-wider">Choose your combat doctrine</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                {Object.values(DEFAULT_LOADOUTS).map((loadout) => (
                    <button
                        key={loadout.id}
                        onClick={() => {
                            onSelect(loadout);
                        }}
                        className={`group relative flex flex-col items-start p-5 sm:p-8 border rounded-3xl transition-all hover:scale-[1.02] text-left cursor-pointer ${selectedLoadoutId === loadout.id
                            ? 'bg-[var(--accent-brass-soft)] border-[var(--accent-brass)]'
                            : 'bg-[var(--surface-panel-muted)] hover:bg-[var(--surface-panel-hover)] border-[var(--border-subtle)] hover:border-[var(--accent-royal)]'
                            }`}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-brass-soft)] to-transparent opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity"></div>

                        <div className="relative z-10 w-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-[var(--surface-panel)] rounded-xl border border-[var(--border-subtle)] group-hover:border-[var(--accent-brass)] transition-colors">
                                    <span className="text-3xl">
                                        {getEntityVisual(loadout.id === 'ASSASSIN' ? 'assassin_player' : loadout.id.toLowerCase(), 'player').icon}
                                    </span>
                                </div>
                                <div className="px-3 py-1 bg-[var(--surface-panel)] rounded-full border border-[var(--border-subtle)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                                    {loadout.id === 'VANGUARD' ? 'Standard' : 'Advanced'}
                                </div>
                            </div>

                            <h3 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-[var(--text-primary)] mb-2">{loadout.name}</h3>
                            <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-5 sm:mb-6 min-h-0 sm:h-12">{loadout.description}</p>

                            <div className="space-y-3">
                                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold border-b border-[var(--border-subtle)] pb-1">Starting Loadout</div>
                                <div className="flex flex-wrap gap-2">
                                    {loadout.startingSkills.map(skill => (
                                        <div key={skill} className="px-2 py-1 bg-[var(--surface-panel)] rounded border border-[var(--border-subtle)] text-[10px] text-[var(--accent-royal)]">
                                            {skill.replace('_', ' ')}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
