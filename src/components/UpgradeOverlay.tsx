import React from 'react';

interface UpgradeOverlayProps {
    onSelect: (upgrade: string) => void;
}

export const UpgradeOverlay: React.FC<UpgradeOverlayProps> = ({ onSelect }) => {
    const options = [
        { id: 'EXTRA_HP', label: '❤️ Extra Heart', desc: 'Increases your Max HP by 1' },
        { id: 'LEAP', label: '👟 Leap Skill', desc: 'Jump 2 tiles (costs 0 energy)' },
    ];

    return (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-xl border-2 border-indigo-500 max-w-md w-full">
                <h2 className="text-2xl font-bold text-white mb-4 text-center">Shrine Upgrade</h2>
                <p className="text-gray-400 mb-6 text-center">Choose your blessing:</p>
                <div className="space-y-4">
                    {options.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => onSelect(opt.id)}
                            className="w-full p-4 bg-gray-700 hover:bg-indigo-600 border border-gray-600 rounded-lg text-left transition-colors group"
                        >
                            <h3 className="text-lg font-bold text-white group-hover:text-white">{opt.label}</h3>
                            <p className="text-sm text-gray-400 group-hover:text-indigo-100">{opt.desc}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
