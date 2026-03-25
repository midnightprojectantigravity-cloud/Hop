import React from 'react';
import type { GameScreenActions, GameScreenModel, GameScreenRunState, GameScreenUiState } from './use-game-screen-model';

const GameRunContext = React.createContext<GameScreenRunState | null>(null);
const GameUiContext = React.createContext<GameScreenUiState | null>(null);
const GameActionsContext = React.createContext<GameScreenActions | null>(null);

export const GameScreenProvider = ({
  screen,
  children
}: {
  screen: GameScreenModel;
  children: React.ReactNode;
}) => (
  <GameRunContext.Provider value={screen.run}>
    <GameUiContext.Provider value={screen.ui}>
      <GameActionsContext.Provider value={screen.actions}>
        {children}
      </GameActionsContext.Provider>
    </GameUiContext.Provider>
  </GameRunContext.Provider>
);

const requireContext = <T,>(value: T | null, label: string): T => {
  if (!value) {
    throw new Error(`${label} must be used within GameScreenProvider.`);
  }
  return value;
};

export const useGameRunContext = (): GameScreenRunState => requireContext(React.useContext(GameRunContext), 'GameRunContext');
export const useGameUiContext = (): GameScreenUiState => requireContext(React.useContext(GameUiContext), 'GameUiContext');
export const useGameActionsContext = (): GameScreenActions => requireContext(React.useContext(GameActionsContext), 'GameActionsContext');
