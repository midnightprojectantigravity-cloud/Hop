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
        <div className="flex flex-col gap-4">
            {slots.map(slot => {
                const skill = skills.find(s => s.slot === slot);
                if (!skill) return null;

                const isSelected = selectedSkillId === skill.id;
                const isOnCooldown = skill.currentCooldown > 0;
                const isSpearSlot = skill.id === 'SPEAR_THROW';
                const cannotUse = (isOnCooldown && !isSpearSlot) || (isSpearSlot && !hasSpear);

                return (
                    <button
                        key={skill.id}
                        disabled={cannotUse}
                        onClick={() => onSelectSkill(isSelected ? null : skill.id)}
                        className={`
                            relative w-full h-24 rounded-2xl flex flex-col items-center justify-center gap-1
                            border transition-all transform hover:translate-x-1
                            ${isSelected
                                ? 'bg-blue-600 border-white shadow-[0_0_20px_rgba(59,130,246,0.5)]'
                                : 'bg-white/5 border-white/10 hover:border-blue-500/50'}
                            ${cannotUse ? 'opacity-40 grayscale pointer-events-none' : 'cursor-pointer'}
                        `}
                    >
                        <span className="text-3xl">
                            {skill.id === 'SPEAR_THROW' ? '🔱' : (skill.id === 'SHIELD_BASH' ? '🛡️' : '🏷️')}
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-white/50">
                            {skill.name}
                        </span>

                        {isOnCooldown && !isSpearSlot && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl backdrop-blur-[2px]">
                                <span className="text-3xl font-black text-white">{skill.currentCooldown}</span>
                            </div>
                        )}

                        {/* Slot Label */}
                        <div className="absolute -top-2 left-4 px-2 py-0.5 bg-[#030712] rounded-full border border-white/10 text-[8px] uppercase font-black tracking-widest text-white/40">
                            {slot}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};
