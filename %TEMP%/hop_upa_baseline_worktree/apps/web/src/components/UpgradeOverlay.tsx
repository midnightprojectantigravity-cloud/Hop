import React from 'react';
import { SkillRegistry, type GameState } from '@hop/engine';

interface UpgradeOverlayProps {
    onSelect: (upgradeId: string) => void;
    gameState: GameState;
}

export const UpgradeOverlay: React.FC<UpgradeOverlayProps> = ({ onSelect, gameState }) => {
    const player = gameState.player;

    const offeredIds = gameState.pendingStatus?.shrineOptions || gameState.shrineOptions || ['EXTRA_HP'];
    const allOptions = offeredIds.map((id) => {
        if (id === 'EXTRA_HP') {
            return {
                id: 'EXTRA_HP',
                label: 'Extra Heart',
                desc: 'Increases your Max HP by 1 and heals you to full.',
                color: 'bg-red-900/40 border-red-500'
            };
        }

        const def = SkillRegistry.getUpgrade(id);
        const skillId = SkillRegistry.getSkillForUpgrade(id);
        const skill = player.activeSkills?.find(s => s.id === skillId);
        const color = skill?.slot === 'offensive'
            ? 'bg-orange-900/40 border-orange-500'
            : skill?.slot === 'defensive'
                ? 'bg-blue-900/40 border-blue-500'
                : 'bg-green-900/40 border-green-500';

        return {
            id,
            label: def ? def.name : id,
            desc: def?.description || 'Unknown upgrade.',
            color
        };
    });

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <div className="bg-gray-900 p-8 rounded-3xl border-2 border-slate-700 max-w-2xl w-full shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-blue-500 to-green-500" />

                <h2 className="text-4xl font-black text-white mb-2 text-center tracking-tight">SHRINE BLESSING</h2>
                <p className="text-slate-400 mb-8 text-center text-lg">The gods offer you a choice. Choose wisely.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allOptions.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => onSelect(opt.id)}
                            className={`
                                relative p-6 border-2 rounded-2xl text-left transition-all group overflow-hidden
                                hover:scale-[1.02] active:scale-[0.98]
                                ${opt.color} hover:bg-slate-800
                            `}
                        >
                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-200">{opt.label}</h3>
                            <p className="text-sm text-slate-400 group-hover:text-slate-300 leading-relaxed">{opt.desc}</p>

                            <div className="absolute -right-2 -bottom-2 opacity-0 group-hover:opacity-10 scale-0 group-hover:scale-150 transition-all font-bold text-4xl">
                                *
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
