import {
  createDefaultDungeonLabArenaConfigV2,
  safeParse,
  safeStringify,
  type DungeonLabArenaConfigV2,
  type DungeonLabArenaCheckpointV2,
  type DungeonLabArenaDecisionCandidateV2,
  type DungeonLabArenaDecisionTraceEntryV2,
  type DungeonLabArenaRunArtifactV2
} from '@hop/engine';
import type { ReplayRecord } from '../components/ReplayManager';

const DUNGEON_LAB_ARENA_CONFIG_STORAGE_KEY = 'hop_dungeon_lab_arena_config_v2';
const DUNGEON_LAB_ARENA_ARTIFACT_STORAGE_KEY = 'hop_dungeon_lab_arena_artifacts_v2';
const MAX_RETAINED_ARENA_ARTIFACTS = 12;

const compactCandidateForStorage = (
  candidate: DungeonLabArenaDecisionCandidateV2,
  aggressive: boolean
): DungeonLabArenaDecisionCandidateV2 => ({
  ...candidate,
  breakdown: aggressive ? {} : candidate.breakdown,
  topBreakdown: candidate.topBreakdown.slice(0, 3)
});

const compactDecisionTraceForStorage = (
  entry: DungeonLabArenaDecisionTraceEntryV2,
  aggressive: boolean
): DungeonLabArenaDecisionTraceEntryV2 => ({
  ...entry,
  selectedFacts: aggressive ? undefined : entry.selectedFacts,
  selectionSummary: aggressive ? undefined : entry.selectionSummary,
  topCandidates: entry.topCandidates.slice(0, 5).map((candidate) => compactCandidateForStorage(candidate, aggressive)),
  rejectedCandidates: entry.rejectedCandidates.slice(0, 8).map((candidate) => compactCandidateForStorage(candidate, aggressive))
});

const buildPersistedCheckpoint = (artifact: DungeonLabArenaRunArtifactV2): DungeonLabArenaCheckpointV2 => ({
  actionIndex: 0,
  state: artifact.initialState,
  fingerprint: artifact.checkpoints[0]?.fingerprint || 'persisted-initial'
});

const compactArtifactForStorage = (
  artifact: DungeonLabArenaRunArtifactV2,
  aggressive: boolean
): DungeonLabArenaRunArtifactV2 => ({
  ...artifact,
  actionLog: [],
  checkpoints: [buildPersistedCheckpoint(artifact)],
  decisionTrace: artifact.decisionTrace
    .slice(0, aggressive ? 80 : artifact.decisionTrace.length)
    .map((entry) => compactDecisionTraceForStorage(entry, aggressive))
});

const normalizeLoadedArtifact = (artifact: DungeonLabArenaRunArtifactV2): DungeonLabArenaRunArtifactV2 => ({
  ...artifact,
  actionLog: Array.isArray(artifact.actionLog) && artifact.actionLog.length > 0
    ? artifact.actionLog
    : [...(artifact.replayEnvelope?.actions || [])],
  checkpoints: Array.isArray(artifact.checkpoints) && artifact.checkpoints.length > 0
    ? artifact.checkpoints
    : [buildPersistedCheckpoint(artifact)],
  decisionTrace: Array.isArray(artifact.decisionTrace) ? artifact.decisionTrace : [],
  timelineMarkers: Array.isArray(artifact.timelineMarkers) ? artifact.timelineMarkers : []
});

const tryPersistArtifacts = (artifacts: DungeonLabArenaRunArtifactV2[]): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    window.localStorage.setItem(
      DUNGEON_LAB_ARENA_ARTIFACT_STORAGE_KEY,
      safeStringify(artifacts)
    );
    return true;
  } catch {
    return false;
  }
};

export const createDefaultDungeonLabArenaConfig = (): DungeonLabArenaConfigV2 =>
  createDefaultDungeonLabArenaConfigV2();

export const serializeDungeonLabArenaConfig = (config: DungeonLabArenaConfigV2): string =>
  JSON.stringify(config, null, 2);

export const parseDungeonLabArenaConfig = (raw: string): DungeonLabArenaConfigV2 => {
  const parsed = JSON.parse(raw) as DungeonLabArenaConfigV2;
  if (parsed?.version !== 'dungeon-lab-arena-v2') {
    throw new Error('Expected DungeonLabArenaConfigV2 payload.');
  }
  return parsed;
};

export const loadDungeonLabArenaConfig = (): DungeonLabArenaConfigV2 => {
  if (typeof window === 'undefined') return createDefaultDungeonLabArenaConfig();
  const raw = window.localStorage.getItem(DUNGEON_LAB_ARENA_CONFIG_STORAGE_KEY);
  if (!raw) return createDefaultDungeonLabArenaConfig();
  try {
    return parseDungeonLabArenaConfig(raw);
  } catch {
    return createDefaultDungeonLabArenaConfig();
  }
};

export const persistDungeonLabArenaConfig = (config: DungeonLabArenaConfigV2): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    DUNGEON_LAB_ARENA_CONFIG_STORAGE_KEY,
    serializeDungeonLabArenaConfig(config)
  );
};

export const loadDungeonLabArenaArtifacts = (): DungeonLabArenaRunArtifactV2[] => {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(DUNGEON_LAB_ARENA_ARTIFACT_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = safeParse(raw) as DungeonLabArenaRunArtifactV2[];
    return Array.isArray(parsed) ? parsed.map(normalizeLoadedArtifact) : [];
  } catch {
    return [];
  }
};

export const persistDungeonLabArenaArtifacts = (artifacts: DungeonLabArenaRunArtifactV2[]): void => {
  if (typeof window === 'undefined') return;
  const newestFirst = artifacts.slice(0, MAX_RETAINED_ARENA_ARTIFACTS);
  const strategies: DungeonLabArenaRunArtifactV2[][] = [
    newestFirst,
    newestFirst.map((artifact) => compactArtifactForStorage(artifact, false)),
    newestFirst.slice(0, 6).map((artifact) => compactArtifactForStorage(artifact, false)),
    newestFirst.slice(0, 3).map((artifact) => compactArtifactForStorage(artifact, true)),
    newestFirst.slice(0, 1).map((artifact) => compactArtifactForStorage(artifact, true)),
    []
  ];

  for (const candidate of strategies) {
    if (tryPersistArtifacts(candidate)) return;
  }

  console.warn('Dungeon Lab arena artifacts exceeded localStorage quota and could not be persisted.');
};

export const getDungeonLabArenaArtifactKey = (artifact: DungeonLabArenaRunArtifactV2): string =>
  `${artifact.seed}:${artifact.replayEnvelope.meta.recordedAt}`;

export const toDungeonLabReplayRecord = (artifact: DungeonLabArenaRunArtifactV2): ReplayRecord => ({
  id: `dungeon-lab-arena-${getDungeonLabArenaArtifactKey(artifact)}`,
  replay: artifact.replayEnvelope,
  initState: artifact.initialState,
  score: artifact.finalState.kills || 0,
  floor: artifact.finalState.floor,
  date: artifact.replayEnvelope.meta.recordedAt,
  diagnostics: artifact.replayEnvelope.meta.diagnostics
});
