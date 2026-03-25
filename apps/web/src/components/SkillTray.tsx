import React from 'react';
import type { GameState, Skill, SkillSlot } from '@hop/engine';
import { getSkillDefinition } from '../../../../packages/engine/src/skillRegistry';
import { resolveCombatPressureMode } from '../../../../packages/engine/src/systems/free-move';
import { resolveIresActionPreview } from '../../../../packages/engine/src/systems/ires/preview';
import { getCachedSkillTargets } from './game-board/target-resolution-cache';

interface SkillTrayProps {
  skills: Skill[];
  selectedSkillId: string | null;
  onSelectSkill: (skillId: string | null) => void;
  hasSpear: boolean;
  gameState: GameState;
  inputLocked?: boolean;
  compact?: boolean;
}

const formatPrimaryChip = (preview: ReturnType<typeof resolveIresActionPreview> | undefined): string => {
  if (!preview) return '';
  if (preview.sparkBurnOutcome === 'travel_suppressed') {
    return 'Travel Safe';
  }
  if (preview.sparkBurnHpDelta > 0) {
    return `Burn ${preview.sparkBurnHpDelta} HP`;
  }
  const parts: string[] = [];
  if ((preview.sparkCostTotal || 0) > 0) parts.push(`${preview.sparkCostTotal} SP`);
  if ((preview.manaCost || 0) > 0) parts.push(`${preview.manaCost} MP`);
  if (parts.length > 0) return parts.join(' / ');
  return '0';
};

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
  const combatPressureMode = resolveCombatPressureMode(gameState);

  return (
    <div className={compact ? 'grid grid-cols-3 gap-2 sm:grid-cols-4' : 'flex flex-col gap-4'}>
      {slots.flatMap((slot) => {
        const slotSkills = skills.filter((s) => s.slot === slot);
        return slotSkills.map((skill) => {
          const isSelected = selectedSkillId === skill.id;
          const isOnCooldown = skill.currentCooldown > 0;
          const isSpearSlot = skill.id === 'SPEAR_THROW';
          const def = getSkillDefinition(skill.id);
          const resourcePreview = def ? resolveIresActionPreview(gameState.player, skill.id, def.resourceProfile, gameState.ruleset, combatPressureMode) : undefined;
          const resourceBlocked = !!resourcePreview?.blockedReason;
          const validTargetCount = def?.getValidTargets
            ? getCachedSkillTargets({
                gameState,
                actorId: gameState.player.id,
                skillId: skill.id,
                origin: gameState.player.position,
                resolver: () => def.getValidTargets!(gameState, gameState.player.position),
              }).length
            : null;
          const noTargets = validTargetCount !== null && validTargetCount === 0;
          const hardDisabled = inputLocked || resourceBlocked || (isOnCooldown && !isSpearSlot) || (isSpearSlot && !hasSpear);
          const cannotUse = hardDisabled || noTargets;
          const showTravelPill = combatPressureMode === 'travel'
            && !!def?.resourceProfile?.countsAsMovement
            && !def.resourceProfile.countsAsAction;

          const rawName = def?.name || skill.name;
          const displayName = typeof rawName === 'function' ? rawName(gameState) : rawName;
          const displayIcon = def?.icon || '*';
          const primaryChip = formatPrimaryChip(resourcePreview);
          const sparkBreakdown = resourcePreview
            ? `Tempo ${resourcePreview.tempoSparkCost || 0} + Skill ${resourcePreview.skillSparkSurcharge || 0}${(resourcePreview.sparkCostTotal || 0) > 0 ? ` = ${resourcePreview.sparkCostTotal} SP` : ''}`
            : null;
          const tooltip = resourcePreview?.blockedReason
            || (noTargets ? 'No valid targets right now' : null)
            || (resourcePreview?.sparkBurnOutcome === 'travel_suppressed'
              ? `Travel: burn suppressed. ${sparkBreakdown || ''}`.trim()
              : resourcePreview?.sparkBurnHpDelta
              ? `EXHAUSTED: this costs ${resourcePreview.sparkBurnHpDelta} HP Spark Burn`
              : [primaryChip, sparkBreakdown].filter(Boolean).join(' | '));

          return (
            <button
              key={skill.id}
              disabled={cannotUse}
              onClick={() => onSelectSkill(isSelected ? null : skill.id)}
              title={tooltip}
              className={`
                skill-card
                relative w-full ${compact ? 'h-24 rounded-xl gap-0.5' : 'h-28 rounded-2xl gap-1'} flex flex-col items-center justify-center
                border transition-all transform hover:-translate-y-0.5
                ${isSelected
                  ? 'skill-card-selected border-[var(--accent-royal)] text-[var(--text-primary)]'
                  : 'border-[var(--border-subtle)] hover:border-[var(--accent-royal)]'}
                ${hardDisabled ? 'opacity-40 grayscale' : noTargets ? 'opacity-60 saturate-75' : 'cursor-pointer'}
              `}
            >
              <span className={`skill-icon-stain ${compact ? 'text-2xl' : 'text-3xl'}`}>
                {displayIcon}
              </span>
              <span
                className={`skill-wax-label ${compact ? 'text-[9px] tracking-[0.12em]' : 'text-[10px] tracking-widest'} uppercase font-bold ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'} text-center px-2 leading-tight`}
              >
                {displayName}
              </span>

              <div className={`absolute top-1.5 left-1.5 flex flex-col gap-1 ${compact ? 'scale-[0.92] origin-top-left' : ''}`}>
                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${resourcePreview?.sparkBurnHpDelta ? 'border-rose-500/70 bg-rose-950/70 text-rose-200' : 'border-amber-300/60 bg-amber-100/70 text-amber-950'}`}>
                  {resourcePreview?.sparkBurnHpDelta ? 'Flame' : primaryChip}
                </span>
                {resourcePreview && (resourcePreview.sparkCostTotal || 0) > 0 ? (
                  <span className="rounded-full border border-slate-400/40 bg-slate-950/55 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-slate-100">
                    T {resourcePreview.tempoSparkCost || 0} + S {resourcePreview.skillSparkSurcharge || 0}
                  </span>
                ) : null}
              </div>

              {showTravelPill ? (
                <div className="absolute top-1.5 right-1.5 rounded-full border border-emerald-400/35 bg-emerald-950/55 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-100">
                  Travel
                </div>
              ) : null}

              {resourcePreview?.sparkBurnHpDelta ? (
                <div className="absolute inset-x-2 bottom-1.5 rounded-md border border-rose-500/50 bg-rose-950/55 px-1.5 py-0.5 text-center text-[9px] font-black uppercase tracking-[0.14em] text-rose-100">
                  Burn {resourcePreview.sparkBurnHpDelta} HP
                </div>
              ) : resourcePreview?.sparkBurnOutcome === 'travel_suppressed' ? (
                <div className="absolute inset-x-2 bottom-1.5 rounded-md border border-emerald-400/45 bg-emerald-950/55 px-1.5 py-0.5 text-center text-[9px] font-black uppercase tracking-[0.14em] text-emerald-100">
                  Burn Safe
                </div>
              ) : noTargets ? (
                <div className="absolute inset-x-2 bottom-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-panel-hover)] px-1.5 py-0.5 text-center text-[9px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  No Target
                </div>
              ) : null}

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
