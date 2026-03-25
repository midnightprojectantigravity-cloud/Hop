import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateInitialState, recomputeVisibility } from '@hop/engine';
import {
  GameScreenProvider,
  useGameActionsContext,
  useGameRunContext,
  useGameUiContext
} from '../app/game-screen-context';
import type { GameScreenModel } from '../app/use-game-screen-model';

const buildScreenModel = (): GameScreenModel => {
  const gameState = recomputeVisibility({
    ...generateInitialState(1, 'game-screen-context-contract'),
    enemies: []
  });

  return {
    run: {
      gameState,
      selectedSkillId: null,
      showMovementRange: false,
      isInputLocked: false,
      isReplayMode: false,
      replayActionsLength: 0,
      replayIndex: 0,
      replayActive: false,
      mobileToasts: [],
      tutorialInstructions: null,
      floorIntro: null,
      assetManifest: null,
      isSynapseMode: false,
      synapseSelection: { mode: 'empty' },
      synapsePulse: null,
      showRunLostOverlay: false,
    },
    ui: {
      uiPreferences: {
        colorMode: 'parchment',
        motionMode: 'snappy',
        hudDensity: 'compact',
        mobileLayout: 'portrait_primary',
        turnFlowMode: 'protected_single',
        overdriveUiMode: 'per_turn_arm',
        audioEnabled: true,
        hapticsEnabled: true,
        vitalsMode: 'glance'
      },
      turnFlowMode: 'protected_single',
      overdriveArmed: false,
      replayMarkerIndices: [],
      mobileDockV2Enabled: true,
      replayChronicleEnabled: false,
      strictTargetPathParityV1Enabled: false,
    },
    actions: {
      onSetBoardBusy: () => {},
      onTileClick: () => {},
      onSimulationEvents: () => {},
      onMirrorSnapshot: () => {},
      onReset: () => {},
      onWait: () => {},
      onExitToHub: () => {},
      onSelectSkill: () => {},
      onSelectUpgrade: () => {},
      onToggleSynapseMode: () => {},
      onSynapseInspectEntity: () => {},
      onSynapseSelectSource: () => {},
      onSynapseClearSelection: () => {},
      onDismissTutorial: () => {},
      onToggleReplay: () => {},
      onStepReplay: () => {},
      onJumpReplay: () => {},
      onCloseReplay: () => {},
      onQuickRestart: () => {},
      onViewReplay: () => {},
      onRunLostActionsReady: () => {},
      onSetColorMode: () => {},
      onSetVitalsMode: () => {},
      onToggleOverdrive: () => {},
    }
  };
};

const ContextProbe = () => {
  const run = useGameRunContext();
  const ui = useGameUiContext();
  const actions = useGameActionsContext();

  return (
    <div>
      {run.gameState.floor}:{ui.turnFlowMode}:{typeof actions.onWait}
    </div>
  );
};

describe('game screen context contract', () => {
  it('exposes run, ui, and action state through the provider', () => {
    const html = renderToStaticMarkup(
      <GameScreenProvider screen={buildScreenModel()}>
        <ContextProbe />
      </GameScreenProvider>
    );

    expect(html).toContain('1:protected_single:function');
  });
});
