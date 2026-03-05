import React from 'react';
import type { GameState } from '@hop/engine';
import { computeScore } from '@hop/engine';
import {
  UiDirectivesSection,
  UiInitiativeSection,
  UiProgressSection,
  UiRulesetSection,
  UiStatusHeader,
  UiVitalsSection
} from './ui-status-panel-sections';
import type { UiInformationRevealMode } from '../../app/information-reveal';

interface UiStatusPanelProps {
  gameState: GameState;
  onReset: () => void;
  onWait: () => void;
  onExitToHub: () => void;
  intelMode: UiInformationRevealMode;
  onIntelModeChange: (mode: UiInformationRevealMode) => void;
  showIntelControls?: boolean;
  inputLocked?: boolean;
  compact?: boolean;
  hideInitiativeQueue?: boolean;
}

export const UiStatusPanel: React.FC<UiStatusPanelProps> = ({
  gameState,
  onReset,
  onWait,
  onExitToHub,
  intelMode,
  onIntelModeChange,
  showIntelControls = false,
  inputLocked = false,
  compact = false,
  hideInitiativeQueue = false
}) => {
  const score = computeScore(gameState);

  return (
    <div className={`flex flex-col overflow-y-auto flex-1 min-h-0 ${compact ? 'gap-4 p-4' : 'gap-8 p-8'}`}>
      <UiStatusHeader compact={compact} />
      <UiInitiativeSection gameState={gameState} hideInitiativeQueue={hideInitiativeQueue} intelMode={intelMode} />
      <UiVitalsSection gameState={gameState} compact={compact} intelMode={intelMode} />
      <UiProgressSection gameState={gameState} compact={compact} score={score} />
      <UiRulesetSection
        gameState={gameState}
        compact={compact}
        intelMode={intelMode}
        showIntelControls={showIntelControls}
        onIntelModeChange={onIntelModeChange}
      />
      <UiDirectivesSection
        compact={compact}
        inputLocked={inputLocked}
        onWait={onWait}
        onReset={onReset}
        onExitToHub={onExitToHub}
      />
    </div>
  );
};
