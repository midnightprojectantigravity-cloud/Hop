import type {
  GameState,
  Point,
  SimulationEvent,
  StateMirrorSnapshot,
} from '@hop/engine';
import type { VisualAssetManifest } from '../visual/asset-manifest';
import type { UiColorMode, UiPreferencesV1 } from './ui-preferences';
import type { SynapsePulse, SynapseSelection } from './synapse';

export type GameScreenMobileToast = {
  id: string;
  text: string;
  tone: 'damage' | 'heal' | 'status' | 'system';
  createdAt: number;
};

export type GameScreenFloorIntroState = { floor: number; theme: string } | null;

export interface GameScreenRunState {
  gameState: GameState;
  selectedSkillId: string | null;
  showMovementRange: boolean;
  isInputLocked: boolean;
  isReplayMode: boolean;
  replayActionsLength: number;
  replayIndex: number;
  replayActive: boolean;
  mobileToasts: GameScreenMobileToast[];
  tutorialInstructions: string | null;
  floorIntro: GameScreenFloorIntroState;
  assetManifest?: VisualAssetManifest | null;
  isSynapseMode: boolean;
  synapseSelection: SynapseSelection;
  synapsePulse: SynapsePulse;
  showRunLostOverlay: boolean;
}

export interface GameScreenUiState {
  uiPreferences: UiPreferencesV1;
  turnFlowMode: 'protected_single' | 'manual_chain';
  overdriveArmed: boolean;
  replayMarkerIndices?: number[];
  mobileDockV2Enabled?: boolean;
  replayChronicleEnabled?: boolean;
  strictTargetPathParityV1Enabled?: boolean;
}

export interface GameScreenActions {
  onSetBoardBusy: (busy: boolean) => void;
  onTileClick: (hex: Point, passiveSkillId?: string) => void;
  onSimulationEvents?: (events: SimulationEvent[]) => void;
  onMirrorSnapshot?: (snapshot: StateMirrorSnapshot) => void;
  onReset: () => void;
  onWait: () => void;
  onExitToHub: () => void;
  onSelectSkill: (skillId: string | null) => void;
  onSelectUpgrade: (upgradeId: string) => void;
  onToggleSynapseMode: () => void;
  onSynapseInspectEntity: (actorId: string) => void;
  onSynapseSelectSource: (actorId: string) => void;
  onSynapseClearSelection: () => void;
  onDismissTutorial: () => void;
  onToggleReplay: () => void;
  onStepReplay: () => void;
  onJumpReplay: (index: number) => void;
  onCloseReplay: () => void;
  onQuickRestart: () => void;
  onViewReplay: () => void;
  onRunLostActionsReady?: () => void;
  onSetColorMode: (mode: UiColorMode) => void;
  onSetVitalsMode: (mode: 'glance' | 'full') => void;
  onToggleOverdrive: () => void;
}

export interface GameScreenModel {
  run: GameScreenRunState;
  ui: GameScreenUiState;
  actions: GameScreenActions;
}

export const useGameScreenModel = (input: GameScreenModel): GameScreenModel => input;
