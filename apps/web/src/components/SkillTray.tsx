import React from 'react';
import type { Skill, SkillSlot, GameState } from '@hop/engine';
import { getSkillDefinition } from '@hop/engine';

interface SkillTrayProps {
  skills: Skill[];
  selectedSkillId: string | null;
  onSelectSkill: (skillId: string | null) => void;
  hasSpear: boolean;
  gameState: GameState;
  inputLocked?: boolean;
  compact?: boolean;
}

export const SkillTray: React.FC<SkillTrayProps> = ({
  skills,
  selectedSkillId,
  onSelectSkill,
  hasSpear,
  gameState,
  inputLocked = false,
  compact = false,
}) => {
  const slots: SkillSlot[] = ['offensive', 'defensive', 'utility'];

  return (
    <div className={compact ? 'grid grid-cols-3 gap-2 sm:grid-cols-4' : 'flex flex-col gap-4'}>
      {slots.flatMap((slot) => {
        const slotSkills = skills.filter((s) => s.slot === slot);
        return slotSkills.map((skill) => {
          const isSelected = selectedSkillId === skill.id;
          const isOnCooldown = skill.currentCooldown > 0;
          const isSpearSlot = skill.id === 'SPEAR_THROW';
          const cannotUse = inputLocked || (isOnCooldown && !isSpearSlot) || (isSpearSlot && !hasSpear);

          const def = getSkillDefinition(skill.id);
          const rawName = def?.name || skill.name;
          const displayName = typeof rawName === 'function' ? rawName(gameState) : rawName;
          const displayIcon = def?.icon || '*';

          return (
            <button
              key={skill.id}
              disabled={cannotUse}
              onClick={() => onSelectSkill(isSelected ? null : skill.id)}
              className={`
                skill-card
                relative w-full ${compact ? 'h-20 rounded-xl gap-0.5' : 'h-24 rounded-2xl gap-1'} flex flex-col items-center justify-center
                border transition-all transform hover:-translate-y-0.5
                ${isSelected
                  ? 'skill-card-selected border-[var(--accent-royal)] text-[var(--text-primary)]'
                  : 'border-[var(--border-subtle)] hover:border-[var(--accent-royal)]'}
                ${cannotUse ? 'opacity-40 grayscale pointer-events-none' : 'cursor-pointer'}
              `}
            >
              <span
                className={`skill-icon-stain ${compact ? 'text-2xl' : 'text-3xl'}`}
              >
                {displayIcon}
              </span>
              <span
                className={`skill-wax-label ${compact ? 'text-[9px] tracking-[0.12em]' : 'text-[10px] tracking-widest'} uppercase font-bold ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'} text-center px-2 leading-tight`}
              >
                {displayName}
              </span>

              {isOnCooldown && !isSpearSlot && (
                <div
                  className={`absolute inset-0 flex items-center justify-center bg-[color:var(--overlay-veil)] ${compact ? 'rounded-xl' : 'rounded-2xl'} backdrop-blur-[2px]`}
                >
                  <span className={`${compact ? 'text-2xl' : 'text-3xl'} font-black text-[var(--text-primary)]`}>
                    {skill.currentCooldown}
                  </span>
                </div>
              )}
            </button>
          );
        });
      })}
    </div>
  );
};

