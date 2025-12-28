import React from 'react';
import type { Skill, SkillSlot } from '../game/types';

interface SkillTrayProps {
    skills: Skill[];
    selectedSkillId: string | null;
    onSelectSkill: (skillId: string | null) => void;
    hasSpear: boolean;
}

export const SkillTray: React.FC<SkillTrayProps> = ({
    skills,
    selectedSkillId,
    onSelectSkill,
    hasSpear
}) => {
    // Organize skills by slot
    const slots: SkillSlot[] = ['offensive', 'defensive', 'utility'];

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-50">
            {slots.map(slot => {
                const skill = skills.find(s => s.slot === slot);
                if (!skill) return null;

                const isSelected = selectedSkillId === skill.id;
                const isOnCooldown = skill.currentCooldown > 0;
                const isSpearSlot = skill.id === 'SPEAR_THROW';
                const cannotUse = isOnCooldown || (isSpearSlot && !hasSpear);

                return (
                    <button
                        key={skill.id}
                        disabled={cannotUse}
                        onClick={() => onSelectSkill(isSelected ? null : skill.id)}
                        className={`
                            relative w-20 h-20 rounded-2xl flex flex-col items-center justify-center gap-1
                            border-2 transition-all transform hover:scale-105
                            ${isSelected
                                ? 'bg-blue-600 border-white shadow-[0_0_20px_rgba(59,130,246,0.5)]'
                                : 'bg-gray-800/80 border-gray-600 hover:border-blue-400'}
                            ${cannotUse ? 'opacity-50 grayscale' : 'cursor-pointer'}
                        `}
                    >
                        <span className="text-2xl">
                            {skill.id === 'SPEAR_THROW' ? '🔱' : (skill.id === 'SHIELD_BASH' ? '🛡️' : '🏷️')}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-gray-300">
                            {skill.name}
                        </span>

                        {isOnCooldown && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
                                <span className="text-2xl font-bold text-white">{skill.currentCooldown}</span>
                            </div>
                        )}

                        {/* Slot Label */}
                        <div className="absolute -top-3 px-2 py-0.5 bg-gray-700 rounded-full border border-gray-600 text-[8px] uppercase tracking-wider text-gray-400">
                            {slot}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};
