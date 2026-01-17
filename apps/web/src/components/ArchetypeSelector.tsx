
import React from 'react';
import { DEFAULT_LOADOUTS, type Loadout } from '@hop/engine';

interface ArchetypeSelectorProps {
    onSelect: (loadout: Loadout) => void;
}

export const ArchetypeSelector: React.FC<ArchetypeSelectorProps> = ({ onSelect }) => {
    return (
        <div className="relative z-50 flex flex-col items-center justify-center p-8 gap-8 animate-in fade-in zoom-in duration-500">
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-black uppercase tracking-widest text-white mb-2">Select Class</h1>
                <p className="text-white/40 text-sm uppercase tracking-wider">Choose your combat doctrine</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                {Object.values(DEFAULT_LOADOUTS).map((loadout) => (
                    <button
                        key={loadout.id}
                        onClick={() => {
                            console.log('Archetype Selected:', loadout.id);
                            onSelect(loadout);
                        }}
                        className="group relative flex flex-col items-start p-8 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-3xl transition-all hover:scale-[1.02] text-left cursor-pointer"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity"></div>

                        <div className="relative z-10 w-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-white/5 rounded-xl border border-white/10 group-hover:border-white/30 transition-colors">
                                    <span className="text-3xl">
                                        {loadout.id === 'VANGUARD' ? '🔱' : '⚔️'}
                                    </span>
                                </div>
                                <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/50">
                                    {loadout.id === 'VANGUARD' ? 'Standard' : 'Advanced'}
                                </div>
                            </div>

                            <h3 className="text-2xl font-black uppercase tracking-wide text-white mb-2">{loadout.name}</h3>
                            <p className="text-white/60 text-sm leading-relaxed mb-6 h-12">{loadout.description}</p>

                            <div className="space-y-3">
                                <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold border-b border-white/5 pb-1">Starting Loadout</div>
                                <div className="flex flex-wrap gap-2">
                                    {loadout.startingSkills.map(skill => (
                                        <div key={skill} className="px-2 py-1 bg-black/40 rounded border border-white/10 text-[10px] text-blue-200">
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
