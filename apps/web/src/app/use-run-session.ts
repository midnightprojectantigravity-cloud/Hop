import { useState } from 'react';
import {
  EMPTY_SYNAPSE_SELECTION,
  type SynapsePulse,
  type SynapseSelection,
} from './synapse';
import type { OverdriveTurnState, PendingAutoEndState } from './turn-flow-policy';

export const useRunSession = () => {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [showMovementRange, setShowMovementRange] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [runLostOverlayDelayElapsed, setRunLostOverlayDelayElapsed] = useState(false);
  const [postCommitInputLock, setPostCommitInputLock] = useState(false);
  const [overdriveState, setOverdriveState] = useState<OverdriveTurnState>('idle');
  const [pendingAutoEnd, setPendingAutoEnd] = useState<PendingAutoEndState | null>(null);
  const [isSynapseMode, setIsSynapseMode] = useState(false);
  const [synapseSelection, setSynapseSelection] = useState<SynapseSelection>(EMPTY_SYNAPSE_SELECTION);
  const [synapsePulse, setSynapsePulse] = useState<SynapsePulse>(null);

  return {
    selectedSkillId,
    setSelectedSkillId,
    showMovementRange,
    setShowMovementRange,
    isBusy,
    setIsBusy,
    runLostOverlayDelayElapsed,
    setRunLostOverlayDelayElapsed,
    postCommitInputLock,
    setPostCommitInputLock,
    overdriveState,
    setOverdriveState,
    pendingAutoEnd,
    setPendingAutoEnd,
    isSynapseMode,
    setIsSynapseMode,
    synapseSelection,
    setSynapseSelection,
    synapsePulse,
    setSynapsePulse
  };
};
