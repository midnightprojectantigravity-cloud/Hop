import React from 'react';
import type { GameState } from '@hop/engine';
import { UiStatusPanel } from './ui/ui-status-panel';
import { UiLogFeed } from './ui/ui-log-feed';

interface UIProps {
  gameState: GameState;
  onReset: () => void;
  onWait: () => void;
  onExitToHub: () => void;
  inputLocked?: boolean;
  compact?: boolean;
  hideInitiativeQueue?: boolean;
  hideLog?: boolean;
}

export const UI: React.FC<UIProps> = ({
  gameState,
  onReset,
  onWait,
  onExitToHub,
  inputLocked = false,
  compact = false,
  hideInitiativeQueue = false,
  hideLog = false,
}) => {
  const messages = Array.isArray(gameState.message) ? gameState.message : [];

  return (
    <div className="flex flex-col h-full max-h-screen">
      <UiStatusPanel
        gameState={gameState}
        onReset={onReset}
        onWait={onWait}
        onExitToHub={onExitToHub}
        inputLocked={inputLocked}
        compact={compact}
        hideInitiativeQueue={hideInitiativeQueue}
      />
      {!hideLog && <UiLogFeed messages={messages} compact={compact} />}
    </div>
  );
};

