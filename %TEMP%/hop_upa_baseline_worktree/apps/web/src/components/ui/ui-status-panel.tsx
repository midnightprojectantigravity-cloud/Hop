import React from 'react';
import type { GameState } from '@hop/engine';
import { computeScore } from '@hop/engine';
import {
  UiDirectivesSection,
  UiInitiativeSection,
  UiProgressSection,
  UiStatusHeader,
  UiVitalsSection
} from './ui-status-panel-sections';

interface UiStatusPanelProps {
  gameState: GameState;
  onReset: () => void;
  onWait: () => void;
  onExitToHub: () => void;
  inputLocked?: boolean;
  compact?: boolean;
  hideInitiativeQueue?: boolean;
}

export const UiStatusPanel: React.FC<UiStatusPanelProps> = ({
  gameState,
  onReset,
  onWait,
  onExitToHub,
  inputLocked = false,
  compact = false,
  hideInitiativeQueue = false
}) => {
  const score = computeScore(gameState);

  return (
    <div className={`flex flex-col overflow-y-auto flex-1 min-h-0 ${compact ? 'gap-4 p-4' : 'gap-8 p-8'}`}>
      <UiStatusHeader compact={compact} />
      <UiInitiativeSection gameState={gameState} hideInitiativeQueue={hideInitiativeQueue} />
      <UiVitalsSection gameState={gameState} compact={compact} />
      <UiProgressSection gameState={gameState} compact={compact} score={score} />
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
