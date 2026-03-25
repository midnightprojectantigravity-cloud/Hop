import React from 'react';
import type { ActionResourcePreview, GameState } from '@hop/engine';
import type { UiVitalsMode } from '../../app/ui-preferences';
import { UiVitalsGlyph } from './ui-vitals-glyph';
import { UiVitalsDetailCard } from './ui-vitals-detail-card';

interface UiVitalsGlanceProps {
  gameState: GameState;
  layoutMode: 'mobile_portrait' | 'tablet' | 'desktop_command_center';
  mode: UiVitalsMode;
  onSetMode: (mode: UiVitalsMode) => void;
  resourcePreview?: ActionResourcePreview;
  turnFlowMode?: 'protected_single' | 'manual_chain';
  overdriveArmed?: boolean;
}

export const UiVitalsGlance: React.FC<UiVitalsGlanceProps> = ({
  gameState,
  layoutMode,
  mode,
  onSetMode,
  resourcePreview,
  turnFlowMode = 'protected_single',
  overdriveArmed = false
}) => {
  if (mode === 'full') {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onSetMode('glance')}
          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]"
          aria-label="Switch to glance vitals mode"
        >
          Compact Vitals
        </button>
        <UiVitalsDetailCard
          gameState={gameState}
          resourcePreview={resourcePreview}
          compact
          turnFlowMode={turnFlowMode}
          overdriveArmed={overdriveArmed}
        />
      </div>
    );
  }

  return (
    <UiVitalsGlyph
      gameState={gameState}
      layoutMode={layoutMode}
      showDetail={false}
      onToggleDetail={() => onSetMode('full')}
      resourcePreview={resourcePreview}
      turnFlowMode={turnFlowMode}
      overdriveArmed={overdriveArmed}
    />
  );
};

export default UiVitalsGlance;
