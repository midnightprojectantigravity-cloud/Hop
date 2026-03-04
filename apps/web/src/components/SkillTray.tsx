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
                relative w-full ${compact ? 'h-20 rounded-xl gap-0.5' : 'h-24 rounded-2xl gap-1'} flex flex-col items-center justify-center
                border transition-all transform hover:translate-x-1
                ${isSelected
                  ? 'bg-[var(--accent-royal)] border-[var(--accent-royal)] text-[var(--text-inverse)] shadow-[0_0_20px_rgba(59,130,246,0.25)]'
                  : 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)] hover:border-[var(--accent-royal)]'}
                ${cannotUse ? 'opacity-40 grayscale pointer-events-none' : 'cursor-pointer'}
              `}
            >
              <span className={compact ? 'text-2xl' : 'text-3xl'}>{displayIcon}</span>
              <span
                className={`${compact ? 'text-[9px] tracking-[0.12em]' : 'text-[10px] tracking-widest'} uppercase font-bold ${isSelected ? 'text-[var(--text-inverse)]' : 'text-[var(--text-muted)]'} text-center px-2 leading-tight`}
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

              <div
                className={`absolute ${compact ? '-top-1 left-2 px-1.5' : '-top-2 left-4 px-2'} py-0.5 bg-[var(--surface-panel)] rounded-full border border-[var(--border-subtle)] text-[8px] uppercase font-black tracking-widest text-[var(--text-muted)]`}
              >
                {slot}
              </div>
            </button>
          );
        });
      })}
    </div>
  );
};

