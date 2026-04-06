import React from 'react';
import {
  SkillRegistry,
  analyzeDungeonLabArenaActor,
  materializeDungeonLabArenaArtifactState,
  type DungeonLabArenaActorV2,
  type DungeonLabArenaConfigV2,
  type DungeonLabArenaDecisionCandidateV2,
  type DungeonLabArenaDecisionTraceEntryV2,
  type DungeonLabArenaPreviewInspectionV2,
  type DungeonLabArenaPreviewMarkerV2,
  type DungeonLabArenaRunArtifactV2,
  type DungeonLabArenaSide,
  type DungeonLabArenaValidationIssueV2,
  type Point,
  type TrinityStats,
} from '@hop/engine';
import { GameBoard } from '../components/GameBoard';
import type { ReplayRecord } from '../components/ReplayManager';
import type { VisualAssetManifest } from '../visual/asset-manifest';
import {
  createDefaultDungeonLabArenaConfig,
  getDungeonLabArenaArtifactKey,
  loadDungeonLabArenaArtifacts,
  loadDungeonLabArenaConfig,
  parseDungeonLabArenaConfig,
  persistDungeonLabArenaArtifacts,
  persistDungeonLabArenaConfig,
  serializeDungeonLabArenaConfig,
  toDungeonLabReplayRecord,
} from './dungeon-lab-storage';
import { useDungeonLabWorker } from './use-dungeon-lab-worker';

type BoardSource = 'preview' | 'replay';
type OverlayMode = 'visual' | 'logic' | 'intent';

interface DungeonLabScreenProps {
  assetManifest: VisualAssetManifest | null;
  onBack: () => void;
  onStartReplay: (record: ReplayRecord & { initState?: any }) => void;
}

const ARENA_PRESET_OPTIONS: Array<{ value: DungeonLabArenaConfigV2['arenaPreset']; label: string }> = [
  { value: 'empty', label: 'Empty' },
  { value: 'pillar_ring', label: 'Pillar Ring' },
  { value: 'obstacle_lane', label: 'Obstacle Lane' },
];

const GOAL_OPTIONS = [
  { value: 'engage', label: 'Engage' },
  { value: 'recover', label: 'Recover' },
  { value: 'explore', label: 'Explore' },
] as const;

const clampInt = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
};

const normalizePoint = (point: Point): Point => ({ q: point.q, r: point.r, s: -point.q - point.r });
const cloneTrinity = (trinity: TrinityStats): TrinityStats => ({
  body: trinity.body,
  instinct: trinity.instinct,
  mind: trinity.mind,
});

const formatPointLabel = (point: Point): string => `(${point.q}, ${point.r})`;

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const ensureUniqueId = (desired: string, used: Set<string>, fallbackPrefix: string): string => {
  const base = slugify(desired) || fallbackPrefix;
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
};

const createArenaActor = (
  side: DungeonLabArenaSide,
  index: number,
  partial?: Partial<DungeonLabArenaActorV2>
): DungeonLabArenaActorV2 => ({
  id: partial?.id || `${side}-actor-${index}`,
  name: partial?.name || `${side === 'alpha' ? 'Alpha' : 'Beta'} Actor ${index}`,
  side,
  position: partial?.position ? normalizePoint(partial.position) : normalizePoint({ q: side === 'alpha' ? 2 : 6, r: 4 + index, s: 0 }),
  trinity: partial?.trinity ? cloneTrinity(partial.trinity) : { body: 12, instinct: 12, mind: 12 },
  skillIds: partial?.skillIds ? [...partial.skillIds] : ['BASIC_MOVE', 'BASIC_ATTACK'],
  activeUpgradeIdsBySkill: partial?.activeUpgradeIdsBySkill ? { ...partial.activeUpgradeIdsBySkill } : {},
  goal: partial?.goal || 'engage',
  visualAssetRef: partial?.visualAssetRef,
  subtypeRef: partial?.subtypeRef,
  weightClass: partial?.weightClass,
});

const isSkillDefinition = (value: unknown): value is {
  id: string;
  name: string | ((...args: unknown[]) => string);
  slot: string;
  upgrades: Record<string, { name?: string; description?: string }>;
} => Boolean(
  value
  && typeof value === 'object'
  && 'id' in value
  && 'name' in value
  && 'slot' in value
  && 'upgrades' in value
);

export const getDungeonLabSkillDisplayName = (skill: {
  id: string;
  name: string | ((...args: unknown[]) => string);
}): string => {
  if (typeof skill.name === 'string') return skill.name;
  return skill.id
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const SKILL_CATALOG = Object.values(SkillRegistry)
  .filter(isSkillDefinition)
  .map((definition) => ({
    id: definition.id,
    name: getDungeonLabSkillDisplayName({ id: definition.id, name: definition.name }),
    slot: definition.slot,
    upgradeEntries: Object.entries(definition.upgrades || {}).map(([upgradeId, upgrade]) => ({
      id: upgradeId,
      name: upgrade?.name || upgradeId,
      description: upgrade?.description || '',
    }))
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

const resolveSkillSummary = (skillIds: string[]): string => {
  if (skillIds.length === 0) return 'No skills';
  return skillIds.slice(0, 3).join(', ') + (skillIds.length > 3 ? ` +${skillIds.length - 3}` : '');
};

const resolveMaxSemanticMagnitude = (candidates: DungeonLabArenaDecisionCandidateV2[]): number =>
  Math.max(
    1,
    ...candidates.flatMap((candidate) => [
      Math.abs(candidate.semanticScores.lethality),
      Math.abs(candidate.semanticScores.selfPreservation),
      Math.abs(candidate.semanticScores.tempo),
    ])
  );

const formatSemanticValue = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;

const buildDecisionTraceText = (entries: DungeonLabArenaDecisionTraceEntryV2[]): string =>
  entries.map((entry) => {
    const candidates = entry.topCandidates
      .map((candidate) => `  - #${candidate.rank} ${candidate.actionSummary} | ${candidate.score.toFixed(2)} | ${candidate.reasoningCode}${candidate.rejectionCode ? ` | ${candidate.rejectionCode}` : ''}`)
      .join('\n');
    return [
      `${entry.decisionIndex}. ${entry.actorLabel} -> ${entry.actionSummary}`,
      `reason=${entry.reasoningCode}${entry.rejectionCode ? ` rejected=${entry.rejectionCode}` : ''}`,
      `semantic: lethality=${formatSemanticValue(entry.semanticScores.lethality)} self=${formatSemanticValue(entry.semanticScores.selfPreservation)} tempo=${formatSemanticValue(entry.semanticScores.tempo)}`,
      candidates ? `candidates:\n${candidates}` : 'candidates: none'
    ].join('\n');
  }).join('\n\n');

const buildBugReportMarkdown = (entry: DungeonLabArenaDecisionTraceEntryV2): string => [
  '**AI Issue Report**',
  `**Actor:** ${entry.actorLabel}`,
  `**Turn:** ${entry.turnNumber}`,
  `**Action:** ${entry.actionSummary}`,
  `**Reasoning:** ${entry.reasoningCode}`,
  `**Rejected Because:** ${entry.rejectionCode || 'n/a'}`,
  `**Semantic Scores:** Lethality ${formatSemanticValue(entry.semanticScores.lethality)}, Self-Preservation ${formatSemanticValue(entry.semanticScores.selfPreservation)}, Tempo ${formatSemanticValue(entry.semanticScores.tempo)}`,
  '',
  '```json',
  JSON.stringify(entry, null, 2),
  '```'
].join('\n');

const copyText = async (value: string): Promise<boolean> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch {
    return false;
  }
};

const StatPill = ({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'neutral' | 'accent' | 'danger' }) => {
  const toneClass = tone === 'accent'
    ? 'border-[var(--accent-royal)] bg-[var(--accent-royal-soft)]'
    : tone === 'danger'
      ? 'border-[var(--accent-danger)] bg-[var(--accent-danger-soft)]'
      : 'border-[var(--border-subtle)] bg-[var(--surface-panel-muted)]';

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">{value}</div>
    </div>
  );
};

const SectionCard = ({
  title,
  subtitle,
  children,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  compact?: boolean;
}) => (
  <section className={`surface-panel-material torn-edge-shell rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] ${compact ? 'p-3' : 'p-4'}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{title}</div>
        {subtitle ? <div className="mt-1 text-[11px] text-[var(--text-muted)]">{subtitle}</div> : null}
      </div>
    </div>
    <div className="mt-3 space-y-3">{children}</div>
  </section>
);

const SmallButton = ({
  children,
  onClick,
  disabled,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'royal' | 'danger';
}) => {
  const toneClass = tone === 'royal'
    ? 'bg-[var(--accent-royal-soft)] border-[var(--accent-royal)]'
    : tone === 'danger'
      ? 'bg-[var(--accent-danger-soft)] border-[var(--accent-danger)]'
      : 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)]';
  return (
    <span
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled ? 'true' : 'false'}
      onClick={(event) => {
        event.stopPropagation();
        if (disabled) return;
        onClick?.();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          onClick?.();
        }
      }}
      className={`inline-flex min-h-9 cursor-pointer select-none items-center justify-center rounded-lg border px-3 text-[10px] font-black uppercase tracking-[0.16em] transition-opacity ${disabled ? 'cursor-not-allowed opacity-45' : ''} ${toneClass}`}
    >
      {children}
    </span>
  );
};

const TextField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</span>
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 text-sm text-[var(--text-primary)]"
    />
  </label>
);

const NumberField = ({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</span>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(event) => onChange(Number(event.target.value))}
      className="min-h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 text-sm text-[var(--text-primary)]"
    />
  </label>
);

const SelectField = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 text-sm text-[var(--text-primary)]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </label>
);

const SelectableCard = ({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect();
      }
    }}
    className={`w-full cursor-pointer rounded-xl border px-3 py-3 text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent-royal)] ${
      selected
        ? 'border-[var(--accent-royal)] bg-[var(--accent-royal-soft)]'
        : 'border-[var(--border-subtle)] bg-[var(--surface-panel-muted)]'
    }`}
  >
    {children}
  </div>
);

export const IssueNotice = ({ issue }: { issue: DungeonLabArenaValidationIssueV2 }) => (
  <div
    className={`rounded-lg border px-3 py-2 text-[11px] ${
      issue.severity === 'error'
        ? 'border-[var(--accent-danger)] bg-[var(--accent-danger-soft)]'
        : 'border-[var(--border-subtle)] bg-[var(--surface-panel-muted)]'
    }`}
  >
    <div className="font-black uppercase tracking-[0.12em]">{issue.code.replace(/_/g, ' ')}</div>
    <div className="mt-1">{issue.message}</div>
  </div>
);

export const PreviewMarkerOverlay = ({ markers }: { markers: DungeonLabArenaPreviewMarkerV2[] }) => {
  if (markers.length === 0) return null;
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 w-[min(22rem,70vw)] rounded-2xl border border-white/15 bg-black/65 p-3 text-[10px] text-white shadow-xl backdrop-blur-sm">
      <div className="font-black uppercase tracking-[0.18em] text-amber-200">Arena Diagnostics</div>
      <div className="mt-2 space-y-2">
        {markers.slice(0, 6).map((marker, index) => (
          <div
            key={`${marker.kind}-${marker.point.q}-${marker.point.r}-${index}`}
            className={`rounded-lg border px-2 py-2 ${
              marker.severity === 'error' ? 'border-red-300/60 bg-red-500/20' : 'border-amber-200/40 bg-amber-400/10'
            }`}
          >
            <div className="font-black uppercase tracking-[0.14em]">
              {marker.kind.replace(/_/g, ' ')} @ {marker.point.q},{marker.point.r}
            </div>
            <div className="mt-1 text-white/80">{marker.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SemanticBar = ({
  label,
  value,
  maxAbs,
}: {
  label: string;
  value: number;
  maxAbs: number;
}) => {
  const percent = `${Math.max(0, Math.min(100, (Math.abs(value) / Math.max(1, maxAbs)) * 100))}%`;
  const positive = value >= 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
        <span>{label}</span>
        <span className={positive ? 'text-emerald-700' : 'text-red-700'}>{formatSemanticValue(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-panel-muted)]">
        <div
          className={`h-full rounded-full ${positive ? 'bg-emerald-500/80' : 'bg-red-500/80'}`}
          style={{ width: percent }}
        />
      </div>
    </div>
  );
};

const CandidateCard = ({
  candidate,
  maxAbs,
}: {
  candidate: DungeonLabArenaDecisionCandidateV2;
  maxAbs: number;
}) => (
  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-3 space-y-2">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
          #{candidate.rank} {candidate.actionSummary}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {candidate.reasoningCode}{candidate.rejectionCode ? ` | ${candidate.rejectionCode}` : ''}
        </div>
      </div>
      <div className="text-sm font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
        {candidate.score.toFixed(2)}
      </div>
    </div>
    <div className="grid gap-2">
      <SemanticBar label="Lethality" value={candidate.semanticScores.lethality} maxAbs={maxAbs} />
      <SemanticBar label="Self-Preservation" value={candidate.semanticScores.selfPreservation} maxAbs={maxAbs} />
      <SemanticBar label="Tempo" value={candidate.semanticScores.tempo} maxAbs={maxAbs} />
    </div>
    {candidate.topBreakdown.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {candidate.topBreakdown.map((breakdown) => (
          <span
            key={`${candidate.rank}-${breakdown.key}`}
            className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]"
          >
            {breakdown.key}: {breakdown.value.toFixed(2)}
          </span>
        ))}
      </div>
    ) : null}
  </div>
);

export const DungeonLabScreen = ({
  assetManifest,
  onBack,
  onStartReplay,
}: DungeonLabScreenProps) => {
  const {
    compilePreview,
    runMatch,
    reset: resetWorker,
    phase: workerPhase,
    error: workerError,
  } = useDungeonLabWorker();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const previewRequestRef = React.useRef(0);
  const replayTimerRef = React.useRef<number | null>(null);

  const [config, setConfig] = React.useState<DungeonLabArenaConfigV2>(() => loadDungeonLabArenaConfig());
  const [artifacts, setArtifacts] = React.useState<DungeonLabArenaRunArtifactV2[]>(() => loadDungeonLabArenaArtifacts());
  const [previewInspection, setPreviewInspection] = React.useState<DungeonLabArenaPreviewInspectionV2 | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [selectedActorId, setSelectedActorId] = React.useState<string>(() => loadDungeonLabArenaConfig().actors[0]?.id || '');
  const [selectedArtifactKey, setSelectedArtifactKey] = React.useState<string | null>(() => {
    const artifact = loadDungeonLabArenaArtifacts()[0];
    return artifact ? getDungeonLabArenaArtifactKey(artifact) : null;
  });
  const [boardSource, setBoardSource] = React.useState<BoardSource>('preview');
  const [overlayMode, setOverlayMode] = React.useState<OverlayMode>('visual');
  const [presentationMode, setPresentationMode] = React.useState(false);
  const [artifactActionIndex, setArtifactActionIndex] = React.useState(0);
  const [artifactReplayMode, setArtifactReplayMode] = React.useState<'idle' | 'running' | 'paused'>('idle');
  const [selectedDecisionId, setSelectedDecisionId] = React.useState<number | null>(null);
  const [skillQuery, setSkillQuery] = React.useState('');
  const [clipboardStatus, setClipboardStatus] = React.useState<string | null>(null);
  const [lastRunSnapshot, setLastRunSnapshot] = React.useState<string | null>(null);

  const serializedConfig = React.useMemo(() => JSON.stringify(config), [config]);
  const dirtySinceLastRun = lastRunSnapshot !== serializedConfig;

  React.useEffect(() => {
    persistDungeonLabArenaConfig(config);
  }, [config]);

  React.useEffect(() => {
    persistDungeonLabArenaArtifacts(artifacts);
  }, [artifacts]);

  React.useEffect(() => {
    if (config.actors.some((actor) => actor.id === selectedActorId)) return;
    setSelectedActorId(config.actors[0]?.id || '');
  }, [config.actors, selectedActorId]);

  React.useEffect(() => {
    const artifact = artifacts[0];
    if (!selectedArtifactKey && artifact) {
      setSelectedArtifactKey(getDungeonLabArenaArtifactKey(artifact));
    }
  }, [artifacts, selectedArtifactKey]);

  React.useEffect(() => {
    const requestToken = ++previewRequestRef.current;
    const handle = window.setTimeout(() => {
      void compilePreview(config).then((inspection) => {
        if (requestToken !== previewRequestRef.current) return;
        setPreviewInspection(inspection);
        setPreviewError(null);
      }).catch((error) => {
        if (requestToken !== previewRequestRef.current) return;
        setPreviewError(error instanceof Error ? error.message : 'Preview failed.');
      });
    }, 120);

    return () => {
      window.clearTimeout(handle);
    };
  }, [compilePreview, config]);

  React.useEffect(() => () => {
    if (replayTimerRef.current !== null) {
      window.clearTimeout(replayTimerRef.current);
    }
  }, []);

  const selectedActor = config.actors.find((actor) => actor.id === selectedActorId) || config.actors[0] || null;
  const selectedActorAnalysis = React.useMemo(
    () => (selectedActor ? analyzeDungeonLabArenaActor(selectedActor) : null),
    [selectedActor]
  );
  const selectedArtifact = artifacts.find((artifact) => getDungeonLabArenaArtifactKey(artifact) === selectedArtifactKey) || artifacts[0] || null;
  const previewState = previewInspection?.state || null;
  const previewIssues = previewInspection?.issues || [];
  const boardMarkers = previewInspection?.markers || [];
  const alphaActors = config.actors.filter((actor) => actor.side === 'alpha');
  const betaActors = config.actors.filter((actor) => actor.side === 'beta');
  const replayState = React.useMemo(
    () => (selectedArtifact ? materializeDungeonLabArenaArtifactState(selectedArtifact, artifactActionIndex) : null),
    [artifactActionIndex, selectedArtifact]
  );
  const boardState = boardSource === 'replay' && replayState ? replayState : previewState;
  const replayVisibleTrace = React.useMemo(() => {
    if (!selectedArtifact) return [];
    if (boardSource !== 'replay') return selectedArtifact.decisionTrace;
    return selectedArtifact.decisionTrace.filter((entry) => entry.actionIndex <= artifactActionIndex);
  }, [artifactActionIndex, boardSource, selectedArtifact]);
  const selectedDecision = replayVisibleTrace.find((entry) => entry.decisionIndex === selectedDecisionId)
    || replayVisibleTrace[replayVisibleTrace.length - 1]
    || null;
  const skillSearchResults = React.useMemo(() => {
    if (!selectedActor) return [];
    const query = skillQuery.trim().toLowerCase();
    return SKILL_CATALOG.filter((skill) => !selectedActor.skillIds.includes(skill.id))
      .filter((skill) => query.length === 0
        || skill.id.toLowerCase().includes(query)
        || skill.name.toLowerCase().includes(query))
      .slice(0, 12);
  }, [selectedActor, skillQuery]);
  const logicSummary = React.useMemo(() => {
    if (!boardState) return null;
    const tileList = Array.from(boardState.tiles.values());
    return {
      tileCount: tileList.length,
      wallCount: tileList.filter((tile) => tile.baseId === 'WALL').length,
      actorCount: 1 + boardState.enemies.length + (boardState.companions?.length || 0),
      preset: config.arenaPreset,
    };
  }, [boardState, config.arenaPreset]);
  const artifactActionMax = selectedArtifact?.actionLog.length || 0;
  const artifactTimelineMarkers = selectedArtifact?.timelineMarkers || [];
  const selectedActorIssues = previewIssues.filter((issue) => issue.actorId === selectedActor?.id);
  const selectedActorUpgradeMap = selectedActor?.activeUpgradeIdsBySkill || {};
  const maxSemanticMagnitude = resolveMaxSemanticMagnitude(
    selectedDecision ? [...selectedDecision.topCandidates, ...selectedDecision.rejectedCandidates] : []
  );

  React.useEffect(() => {
    if (!selectedArtifact) {
      setArtifactReplayMode('idle');
      return;
    }
    if (artifactReplayMode !== 'running') return;
    if (artifactActionIndex >= artifactActionMax) {
      setArtifactReplayMode('paused');
      return;
    }
    replayTimerRef.current = window.setTimeout(() => {
      setArtifactActionIndex((current) => Math.min(current + 1, artifactActionMax));
    }, 280);
    return () => {
      if (replayTimerRef.current !== null) {
        window.clearTimeout(replayTimerRef.current);
      }
    };
  }, [artifactActionIndex, artifactActionMax, artifactReplayMode, selectedArtifact]);

  const patchActor = React.useCallback((actorId: string, updater: (actor: DungeonLabArenaActorV2) => DungeonLabArenaActorV2) => {
    setConfig((current) => ({
      ...current,
      actors: current.actors.map((actor) => (actor.id === actorId ? updater(actor) : actor)),
    }));
  }, []);

  const addActor = React.useCallback((side: DungeonLabArenaSide) => {
    setConfig((current) => {
      const usedIds = new Set(current.actors.map((actor) => actor.id));
      const nextIndex = current.actors.filter((actor) => actor.side === side).length + 1;
      const actor = createArenaActor(side, nextIndex);
      const id = ensureUniqueId(actor.id, usedIds, `${side}-actor`);
      const nextActor = { ...actor, id };
      setSelectedActorId(id);
      return {
        ...current,
        actors: [...current.actors, nextActor],
      };
    });
  }, []);

  const removeActor = React.useCallback((actorId: string) => {
    setConfig((current) => ({
      ...current,
      actors: current.actors.filter((actor) => actor.id !== actorId),
    }));
  }, []);

  const moveActorToSide = React.useCallback((actorId: string, side: DungeonLabArenaSide) => {
    patchActor(actorId, (actor) => ({ ...actor, side }));
  }, [patchActor]);

  const mirrorAlphaToBeta = React.useCallback(() => {
    setConfig((current) => {
      const alpha = current.actors.filter((actor) => actor.side === 'alpha');
      const retained = current.actors.filter((actor) => actor.side !== 'beta');
      const usedIds = new Set(retained.map((actor) => actor.id));
      const mirroredBeta = alpha.map((actor, index) => {
        const desiredId = `beta-${slugify(actor.name) || 'actor'}-${index + 1}`;
        const id = ensureUniqueId(desiredId, usedIds, 'beta-actor');
        usedIds.add(id);
        return {
          ...actor,
          id,
          side: 'beta' as const,
          position: normalizePoint({ q: 8 - actor.position.q, r: actor.position.r, s: 0 }),
        };
      });
      return {
        ...current,
        actors: [...retained.filter((actor) => actor.side !== 'beta'), ...mirroredBeta],
      };
    });
  }, []);

  const loadVanguardButcherPreset = React.useCallback(() => {
    const preset = createDefaultDungeonLabArenaConfig();
    setConfig(preset);
    setSelectedActorId(preset.actors[0]?.id || '');
    setBoardSource('preview');
    setPresentationMode(false);
  }, []);

  const loadMirrorButchersPreset = React.useCallback(() => {
    const next: DungeonLabArenaConfigV2 = {
      version: 'dungeon-lab-arena-v2',
      seed: 'mirror-butcher-arena',
      arenaPreset: 'empty',
      turnLimit: 40,
      focusedActorId: 'alpha-butcher',
      actors: [
        createArenaActor('alpha', 1, {
          id: 'alpha-butcher',
          name: 'Butcher Alpha',
          position: normalizePoint({ q: 2, r: 5, s: 0 }),
          trinity: { body: 20, instinct: 29, mind: 0 },
          skillIds: ['BASIC_MOVE', 'BASIC_ATTACK'],
        }),
        createArenaActor('beta', 1, {
          id: 'beta-butcher',
          name: 'Butcher Beta',
          position: normalizePoint({ q: 6, r: 5, s: 0 }),
          trinity: { body: 20, instinct: 29, mind: 0 },
          skillIds: ['BASIC_MOVE', 'BASIC_ATTACK'],
        }),
      ],
    };
    setConfig(next);
    setSelectedActorId('alpha-butcher');
    setBoardSource('preview');
    setPresentationMode(false);
  }, []);

  const handleResetArena = React.useCallback(() => {
    const next = createDefaultDungeonLabArenaConfig();
    setConfig(next);
    setArtifacts([]);
    setSelectedActorId(next.actors[0]?.id || '');
    setSelectedArtifactKey(null);
    setArtifactActionIndex(0);
    setArtifactReplayMode('idle');
    setBoardSource('preview');
    setPresentationMode(false);
    setLastRunSnapshot(null);
  }, []);

  const handleRunMatch = React.useCallback(async () => {
    try {
      const artifact = await runMatch(config);
      setArtifacts((current) => [artifact, ...current].slice(0, 12));
      setSelectedArtifactKey(getDungeonLabArenaArtifactKey(artifact));
      setArtifactActionIndex(artifact.actionLog.length);
      setArtifactReplayMode('idle');
      setBoardSource('replay');
      setSelectedDecisionId(artifact.decisionTrace[artifact.decisionTrace.length - 1]?.decisionIndex || null);
      setLastRunSnapshot(JSON.stringify(config));
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Run failed.');
    }
  }, [config, runMatch]);

  const handleReplaySelect = React.useCallback((artifact: DungeonLabArenaRunArtifactV2, actionIndex: number) => {
    setSelectedArtifactKey(getDungeonLabArenaArtifactKey(artifact));
    setArtifactActionIndex(Math.max(0, Math.min(actionIndex, artifact.actionLog.length)));
    setBoardSource('replay');
    setArtifactReplayMode('idle');
  }, []);

  const handleReplayToggle = React.useCallback(() => {
    if (!selectedArtifact) return;
    setBoardSource('replay');
    if (artifactReplayMode === 'running') {
      setArtifactReplayMode('paused');
      return;
    }
    if (artifactActionIndex >= artifactActionMax) {
      setArtifactActionIndex(0);
    }
    setArtifactReplayMode('running');
  }, [artifactActionIndex, artifactActionMax, artifactReplayMode, selectedArtifact]);

  const handleCopy = React.useCallback(async (value: string, successLabel: string) => {
    const copied = await copyText(value);
    setClipboardStatus(copied ? successLabel : 'Copy failed.');
    window.setTimeout(() => setClipboardStatus(null), 1800);
  }, []);

  const handleImportJson = React.useCallback((raw: string) => {
    const next = parseDungeonLabArenaConfig(raw);
    setConfig(next);
    setSelectedActorId(next.actors[0]?.id || '');
    setBoardSource('preview');
    setPresentationMode(false);
  }, []);

  return (
    <div className="relative flex h-full min-h-screen flex-col bg-[var(--surface-base)] text-[var(--text-primary)]">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void file.text().then((raw) => {
            handleImportJson(raw);
            setClipboardStatus('Arena imported.');
            window.setTimeout(() => setClipboardStatus(null), 1800);
          }).catch((error) => {
            setPreviewError(error instanceof Error ? error.message : 'Import failed.');
          });
          event.target.value = '';
        }}
      />

      <header className="border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Utility Route</div>
            <div className="mt-1 text-lg font-black uppercase tracking-[0.18em]">Dungeon Lab</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SmallButton onClick={() => fileInputRef.current?.click()}>Import JSON</SmallButton>
            <SmallButton onClick={() => void handleCopy(serializeDungeonLabArenaConfig(config), 'Arena JSON copied.')}>Copy JSON</SmallButton>
            <SmallButton onClick={() => {
              const blob = new Blob([serializeDungeonLabArenaConfig(config)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = 'dungeon-lab-arena-v2.json';
              anchor.click();
              URL.revokeObjectURL(url);
            }}>
              Download JSON
            </SmallButton>
            <SmallButton onClick={handleResetArena}>Reset Arena</SmallButton>
            <SmallButton onClick={onBack}>Back</SmallButton>
          </div>
        </div>
        {clipboardStatus ? (
          <div className="mt-2 text-[11px] text-[var(--text-muted)]">{clipboardStatus}</div>
        ) : null}
      </header>

      <main className={`grid flex-1 gap-3 p-3 ${presentationMode ? 'grid-cols-1' : 'xl:grid-cols-[22rem_minmax(0,1fr)_25rem]'}`}>
        {!presentationMode ? (
          <aside className="space-y-3 overflow-y-auto">
            <SectionCard title="Arena Settings" subtitle="Deterministic seed, preset, and one-click matchup orchestration.">
              <div className={`rounded-xl border px-3 py-2 text-[11px] ${dirtySinceLastRun ? 'border-amber-400 bg-amber-100/60' : 'border-[var(--border-subtle)] bg-[var(--surface-panel-muted)]'}`}>
                {dirtySinceLastRun ? 'Dirty state: edits have not been rerun yet.' : 'Arena is synced with the latest run.'}
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <TextField label="Seed" value={config.seed} onChange={(seed) => setConfig((current) => ({ ...current, seed }))} />
                <div className="flex items-end">
                  <SmallButton onClick={() => setConfig((current) => ({ ...current, seed: `arena-${Date.now().toString(36)}` }))}>Randomize</SmallButton>
                </div>
              </div>
              <SelectField
                label="Arena Preset"
                value={config.arenaPreset}
                options={ARENA_PRESET_OPTIONS}
                onChange={(arenaPreset) => setConfig((current) => ({ ...current, arenaPreset: arenaPreset as DungeonLabArenaConfigV2['arenaPreset'] }))}
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Turn Limit</span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={config.turnLimit}
                  onChange={(event) => setConfig((current) => ({ ...current, turnLimit: clampInt(Number(event.target.value), 10, 100) }))}
                  className="w-full accent-[var(--accent-royal)]"
                />
                <div className="text-[11px] text-[var(--text-muted)]">{config.turnLimit} turns</div>
              </label>
              <div className="flex flex-wrap gap-2">
                <SmallButton tone="royal" disabled={workerPhase === 'working'} onClick={() => void handleRunMatch()}>
                  Run Match
                </SmallButton>
                <SmallButton onClick={() => { resetWorker(); setPreviewError(null); }}>Reset Worker</SmallButton>
                <SmallButton onClick={mirrorAlphaToBeta}>Mirror Alpha</SmallButton>
                <SmallButton onClick={loadVanguardButcherPreset}>Load Vanguard vs Butcher</SmallButton>
                <SmallButton onClick={loadMirrorButchersPreset}>Load Mirror Butchers</SmallButton>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <StatPill label="Worker" value={workerPhase} tone={workerPhase === 'error' ? 'danger' : workerPhase === 'working' ? 'accent' : 'neutral'} />
                <StatPill label="Board" value={boardSource} />
              </div>
            </SectionCard>

            <SectionCard title="Side Alpha" subtitle="Roster setup for the first neutral side.">
              <div className="space-y-2">
                {alphaActors.map((actor) => (
                  <SelectableCard
                    key={actor.id}
                    selected={selectedActorId === actor.id}
                    onSelect={() => setSelectedActorId(actor.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.16em]">{actor.name}</div>
                        <div className="mt-1 text-[10px] text-[var(--text-muted)]">{actor.id}</div>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{formatPointLabel(actor.position)}</div>
                    </div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      B {actor.trinity.body} / I {actor.trinity.instinct} / M {actor.trinity.mind}
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--text-muted)]">{resolveSkillSummary(actor.skillIds)}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <SmallButton onClick={() => moveActorToSide(actor.id, 'beta')}>Move To Beta</SmallButton>
                      <SmallButton tone="danger" onClick={() => removeActor(actor.id)}>Delete</SmallButton>
                    </div>
                  </SelectableCard>
                ))}
              </div>
              <SmallButton onClick={() => addActor('alpha')}>Add Alpha Actor</SmallButton>
            </SectionCard>

            <SectionCard title="Side Beta" subtitle="Roster setup for the opposing neutral side.">
              <div className="space-y-2">
                {betaActors.map((actor) => (
                  <SelectableCard
                    key={actor.id}
                    selected={selectedActorId === actor.id}
                    onSelect={() => setSelectedActorId(actor.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.16em]">{actor.name}</div>
                        <div className="mt-1 text-[10px] text-[var(--text-muted)]">{actor.id}</div>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{formatPointLabel(actor.position)}</div>
                    </div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      B {actor.trinity.body} / I {actor.trinity.instinct} / M {actor.trinity.mind}
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--text-muted)]">{resolveSkillSummary(actor.skillIds)}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <SmallButton onClick={() => moveActorToSide(actor.id, 'alpha')}>Move To Alpha</SmallButton>
                      <SmallButton tone="danger" onClick={() => removeActor(actor.id)}>Delete</SmallButton>
                    </div>
                  </SelectableCard>
                ))}
              </div>
              <SmallButton onClick={() => addActor('beta')}>Add Beta Actor</SmallButton>
            </SectionCard>
          </aside>
        ) : null}

        <section className="space-y-3 overflow-y-auto">
          <SectionCard title="Tactical Canvas" subtitle="Preview and replay share the same board. Presentation mode hides the side rails.">
            <div className="flex flex-wrap items-center gap-2">
              <SmallButton tone={boardSource === 'preview' ? 'royal' : 'neutral'} onClick={() => setBoardSource('preview')}>Preview Board</SmallButton>
              <SmallButton tone={boardSource === 'replay' ? 'royal' : 'neutral'} onClick={() => setBoardSource('replay')} disabled={!selectedArtifact}>Replay Board</SmallButton>
              <SmallButton tone={overlayMode === 'visual' ? 'royal' : 'neutral'} onClick={() => setOverlayMode('visual')}>Visual</SmallButton>
              <SmallButton tone={overlayMode === 'logic' ? 'royal' : 'neutral'} onClick={() => setOverlayMode('logic')}>Logic</SmallButton>
              <SmallButton tone={overlayMode === 'intent' ? 'royal' : 'neutral'} onClick={() => setOverlayMode('intent')}>Intent</SmallButton>
              <SmallButton onClick={() => setPresentationMode((current) => !current)}>
                {presentationMode ? 'Exit Presentation' : 'Watch Cinematic Replay'}
              </SmallButton>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <StatPill label="Preset" value={config.arenaPreset} />
              <StatPill label="Turn Limit" value={config.turnLimit} />
              <StatPill label="Alpha" value={alphaActors.length} />
              <StatPill label="Beta" value={betaActors.length} />
              <StatPill label="Trace" value={replayVisibleTrace.length} />
            </div>

            <div className="relative min-h-[42rem] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-board)]">
              {boardState ? (
                <div className="absolute inset-0">
                  <GameBoard
                    gameState={boardState}
                    onMove={() => undefined}
                    selectedSkillId={null}
                    showMovementRange={false}
                    onBusyStateChange={() => undefined}
                    assetManifest={assetManifest}
                  />
                  {boardSource === 'preview' ? <PreviewMarkerOverlay markers={boardMarkers} /> : null}
                  {overlayMode === 'logic' && logicSummary ? (
                    <div className="pointer-events-none absolute right-3 top-3 z-20 w-[min(20rem,45vw)] rounded-2xl border border-white/15 bg-black/65 p-3 text-[10px] text-white shadow-xl backdrop-blur-sm">
                      <div className="font-black uppercase tracking-[0.18em] text-amber-200">Logic View</div>
                      <div className="mt-2 space-y-1 text-white/85">
                        <div>Preset: {logicSummary.preset}</div>
                        <div>Tiles: {logicSummary.tileCount}</div>
                        <div>Walls: {logicSummary.wallCount}</div>
                        <div>Actors: {logicSummary.actorCount}</div>
                      </div>
                    </div>
                  ) : null}
                  {overlayMode === 'intent' && selectedDecision ? (
                    <div className="pointer-events-none absolute right-3 top-3 z-20 w-[min(22rem,48vw)] rounded-2xl border border-white/15 bg-black/65 p-3 text-[10px] text-white shadow-xl backdrop-blur-sm">
                      <div className="font-black uppercase tracking-[0.18em] text-cyan-200">AI Intent</div>
                      <div className="mt-2 space-y-1 text-white/85">
                        <div>{selectedDecision.actorLabel}</div>
                        <div>{selectedDecision.actionSummary}</div>
                        <div>{selectedDecision.reasoningCode}{selectedDecision.rejectionCode ? ` | ${selectedDecision.rejectionCode}` : ''}</div>
                        <div>L {formatSemanticValue(selectedDecision.semanticScores.lethality)} / S {formatSemanticValue(selectedDecision.semanticScores.selfPreservation)} / T {formatSemanticValue(selectedDecision.semanticScores.tempo)}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Arena Preview</div>
                    <div className="mt-2 text-sm text-[var(--text-primary)]">The board will populate as soon as the arena preview finishes compiling.</div>
                  </div>
                </div>
              )}
            </div>

            {selectedArtifact ? (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Replay Controls</div>
                    <div className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
                      {selectedArtifact.result} | action {artifactActionIndex}/{artifactActionMax}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SmallButton onClick={() => handleReplaySelect(selectedArtifact, 0)}>Start</SmallButton>
                    <SmallButton onClick={() => setArtifactActionIndex((current) => Math.max(0, current - 1))} disabled={artifactActionIndex <= 0}>Step Back</SmallButton>
                    <SmallButton tone="royal" onClick={handleReplayToggle}>
                      {artifactReplayMode === 'running' ? 'Pause' : artifactActionIndex >= artifactActionMax ? 'Replay' : 'Play'}
                    </SmallButton>
                    <SmallButton onClick={() => setArtifactActionIndex((current) => Math.min(artifactActionMax, current + 1))} disabled={artifactActionIndex >= artifactActionMax}>Step Forward</SmallButton>
                    <SmallButton onClick={() => handleReplaySelect(selectedArtifact, artifactActionMax)}>Final</SmallButton>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="range"
                    min={0}
                    max={artifactActionMax}
                    value={artifactActionIndex}
                    onChange={(event) => {
                      setBoardSource('replay');
                      setArtifactReplayMode('paused');
                      setArtifactActionIndex(Number(event.target.value));
                    }}
                    className="w-full accent-[var(--accent-royal)]"
                  />
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 h-0 -translate-y-1/2">
                    {artifactTimelineMarkers.map((marker, index) => (
                      <span
                        key={`${marker.kind}-${marker.actionIndex}-${index}`}
                        className={`absolute top-0 h-3 w-3 -translate-x-1/2 rounded-full border border-white/80 ${marker.kind === 'eliminated' ? 'bg-red-500' : 'bg-yellow-400'}`}
                        style={{ left: `${artifactActionMax > 0 ? (marker.actionIndex / artifactActionMax) * 100 : 0}%` }}
                        title={marker.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {artifactTimelineMarkers.slice(0, 6).map((marker, index) => (
                    <span
                      key={`${marker.label}-${index}`}
                      className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]"
                    >
                      {marker.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-4 text-[11px] text-[var(--text-muted)]">
                Run a match to unlock replay controls, event pips, and semantic AI trace.
              </div>
            )}
          </SectionCard>
        </section>

        {!presentationMode ? (
          <aside className="space-y-3 overflow-y-auto">
            <SectionCard title="Actor Inspector" subtitle="Tuning is actor-local: trinity, position, skills, and active upgrades.">
              {selectedActor ? (
                <div className="space-y-3">
                  <TextField label="Actor Name" value={selectedActor.name} onChange={(name) => patchActor(selectedActor.id, (actor) => ({ ...actor, name }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <SelectField
                      label="Side"
                      value={selectedActor.side}
                      options={[
                        { value: 'alpha', label: 'Alpha' },
                        { value: 'beta', label: 'Beta' },
                      ]}
                      onChange={(side) => patchActor(selectedActor.id, (actor) => ({ ...actor, side: side as DungeonLabArenaSide }))}
                    />
                    <SelectField
                      label="Goal"
                      value={selectedActor.goal || 'engage'}
                      options={GOAL_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                      onChange={(goal) => patchActor(selectedActor.id, (actor) => ({ ...actor, goal: goal as DungeonLabArenaActorV2['goal'] }))}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <NumberField
                      label="Q"
                      value={selectedActor.position.q}
                      onChange={(q) => patchActor(selectedActor.id, (actor) => ({
                        ...actor,
                        position: normalizePoint({ q: clampInt(q, 0, 8), r: actor.position.r, s: 0 }),
                      }))}
                    />
                    <NumberField
                      label="R"
                      value={selectedActor.position.r}
                      onChange={(r) => patchActor(selectedActor.id, (actor) => ({
                        ...actor,
                        position: normalizePoint({ q: actor.position.q, r: clampInt(r, 0, 10), s: 0 }),
                      }))}
                    />
                    <NumberField label="S" value={selectedActor.position.s} onChange={() => undefined} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <NumberField
                      label="Body"
                      value={selectedActor.trinity.body}
                      min={0}
                      max={60}
                      onChange={(body) => patchActor(selectedActor.id, (actor) => ({
                        ...actor,
                        trinity: { ...actor.trinity, body: clampInt(body, 0, 60) },
                      }))}
                    />
                    <NumberField
                      label="Instinct"
                      value={selectedActor.trinity.instinct}
                      min={0}
                      max={60}
                      onChange={(instinct) => patchActor(selectedActor.id, (actor) => ({
                        ...actor,
                        trinity: { ...actor.trinity, instinct: clampInt(instinct, 0, 60) },
                      }))}
                    />
                    <NumberField
                      label="Mind"
                      value={selectedActor.trinity.mind}
                      min={0}
                      max={60}
                      onChange={(mind) => patchActor(selectedActor.id, (actor) => ({
                        ...actor,
                        trinity: { ...actor.trinity, mind: clampInt(mind, 0, 60) },
                      }))}
                    />
                  </div>

                  {selectedActorAnalysis ? (
                    <div className="grid grid-cols-2 gap-2">
                      <StatPill label="HP" value={`${selectedActorAnalysis.projection.hp}/${selectedActorAnalysis.projection.maxHp}`} />
                      <StatPill label="Damage" value={selectedActorAnalysis.projection.damage} />
                      <StatPill label="Range" value={selectedActorAnalysis.projection.range} />
                      <StatPill label="Speed" value={selectedActorAnalysis.projection.speed} />
                      <StatPill label="Cooldown" value={selectedActorAnalysis.projection.actionCooldown} />
                      <StatPill label="Power" value={selectedActorAnalysis.projection.intrinsicPowerScore.toFixed(1)} />
                    </div>
                  ) : null}

                  <SectionCard title="Skills" compact subtitle="Search to equip, then toggle upgrades inline.">
                    <TextField label="Skill Search" value={skillQuery} onChange={setSkillQuery} />
                    <div className="max-h-40 space-y-2 overflow-y-auto">
                      {skillSearchResults.length > 0 ? skillSearchResults.map((skill) => (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => patchActor(selectedActor.id, (actor) => ({ ...actor, skillIds: [...actor.skillIds, skill.id] }))}
                          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-2 text-left"
                        >
                          <div className="text-[11px] font-black uppercase tracking-[0.12em]">{skill.name}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{skill.id} | {skill.slot}</div>
                        </button>
                      )) : (
                        <div className="rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-3 text-[11px] text-[var(--text-muted)]">
                          No matching skills to add.
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {selectedActor.skillIds.map((skillId) => {
                        const definition = SKILL_CATALOG.find((candidate) => candidate.id === skillId);
                        const activeUpgrades = new Set(selectedActorUpgradeMap[skillId] || []);
                        return (
                          <div key={skillId} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
                                  {definition?.name || skillId}
                                </div>
                                <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{skillId}</div>
                              </div>
                              <SmallButton
                                tone="danger"
                                onClick={() => patchActor(selectedActor.id, (actor) => {
                                  const nextSkills = actor.skillIds.filter((candidate) => candidate !== skillId);
                                  const nextUpgradeMap = { ...(actor.activeUpgradeIdsBySkill || {}) };
                                  delete nextUpgradeMap[skillId];
                                  return {
                                    ...actor,
                                    skillIds: nextSkills,
                                    activeUpgradeIdsBySkill: nextUpgradeMap,
                                  };
                                })}
                              >
                                Remove
                              </SmallButton>
                            </div>
                            {definition?.upgradeEntries.length ? (
                              <div className="mt-3 space-y-2">
                                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">Active Upgrades</div>
                                {definition.upgradeEntries.map((upgrade) => (
                                  <label key={`${skillId}-${upgrade.id}`} className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-[11px]">
                                    <input
                                      type="checkbox"
                                      checked={activeUpgrades.has(upgrade.id)}
                                      onChange={(event) => patchActor(selectedActor.id, (actor) => {
                                        const current = new Set(actor.activeUpgradeIdsBySkill?.[skillId] || []);
                                        if (event.target.checked) current.add(upgrade.id);
                                        else current.delete(upgrade.id);
                                        return {
                                          ...actor,
                                          activeUpgradeIdsBySkill: {
                                            ...(actor.activeUpgradeIdsBySkill || {}),
                                            [skillId]: [...current].sort(),
                                          },
                                        };
                                      })}
                                    />
                                    <span>
                                      <span className="font-black uppercase tracking-[0.12em]">{upgrade.name}</span>
                                      {upgrade.description ? <span className="block text-[10px] text-[var(--text-muted)]">{upgrade.description}</span> : null}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">No active upgrades for this skill.</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>

                  {selectedActorAnalysis?.skillPowerSummaries.length ? (
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-3 space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Skill Analysis</div>
                      {selectedActorAnalysis.skillPowerSummaries.map((summary) => (
                        <div key={summary.skillId} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-[11px]">
                          <div className="font-black uppercase tracking-[0.12em]">{summary.skillId}</div>
                          <div className="mt-1 text-[var(--text-muted)]">{summary.rationale.join(' · ')}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedActorAnalysis?.synergyWarnings.length ? (
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-3 space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Synergy Warnings</div>
                      {selectedActorAnalysis.synergyWarnings.map((warning, index) => (
                        <div key={`${warning.ailment}-${warning.conflictsWith}-${index}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
                          {warning.message}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedActorIssues.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Actor Validation</div>
                      {selectedActorIssues.map((issue, index) => (
                        <IssueNotice key={`${issue.code}-${issue.actorId}-${index}`} issue={issue} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border-subtle)] px-3 py-4 text-[11px] text-[var(--text-muted)]">
                  Select an actor card to tune trinity, skills, and upgrades.
                </div>
              )}
            </SectionCard>

            <SectionCard title="Match Output" subtitle="Actor outcomes, saved runs, and semantic AI trace.">
              {selectedArtifact ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <StatPill label="Result" value={selectedArtifact.result} />
                    <StatPill label="Turns" value={selectedArtifact.finalState.turnsSpent || selectedArtifact.actionLog.length} />
                  </div>

                  <div className="space-y-2">
                    {selectedArtifact.actorOutcomes.map((actor) => (
                      <div key={actor.sourceActorId} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-3 text-[11px]">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-black uppercase tracking-[0.12em]">{actor.name}</div>
                          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{actor.side}</div>
                        </div>
                        <div className="mt-1 text-[var(--text-muted)]">
                          HP {actor.finalHp}/{actor.maxHp} | dealt {actor.damageDealt} | taken {actor.damageTaken} | {actor.endedAlive ? 'alive' : 'down'}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">AI Choices</div>
                      <div className="flex flex-wrap gap-2">
                        <SmallButton onClick={() => selectedDecision ? void handleCopy(buildDecisionTraceText([selectedDecision]), 'Decision trace copied.') : undefined} disabled={!selectedDecision}>Copy Decision</SmallButton>
                        <SmallButton onClick={() => selectedDecision ? void handleCopy(buildBugReportMarkdown(selectedDecision), 'Bug report copied.') : undefined} disabled={!selectedDecision}>Copy Bug Report</SmallButton>
                        <SmallButton onClick={() => void handleCopy(buildDecisionTraceText(selectedArtifact.decisionTrace), 'Full AI trace copied.')}>Copy Trace</SmallButton>
                        <SmallButton onClick={() => void handleCopy(JSON.stringify(selectedArtifact.decisionTrace, null, 2), 'AI trace JSON copied.')}>Copy JSON</SmallButton>
                        <SmallButton tone="royal" onClick={() => onStartReplay(toDungeonLabReplayRecord(selectedArtifact))}>Convert To Replay</SmallButton>
                      </div>
                    </div>

                    {selectedDecision ? (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-black uppercase tracking-[0.12em]">{selectedDecision.actorLabel}</div>
                              <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                Turn {selectedDecision.turnNumber} | {selectedDecision.actionSummary}
                              </div>
                            </div>
                            <div className="text-right text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                              <div>{selectedDecision.reasoningCode}</div>
                              {selectedDecision.rejectionCode ? <div>{selectedDecision.rejectionCode}</div> : null}
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2">
                            <SemanticBar label="Lethality" value={selectedDecision.semanticScores.lethality} maxAbs={maxSemanticMagnitude} />
                            <SemanticBar label="Self-Preservation" value={selectedDecision.semanticScores.selfPreservation} maxAbs={maxSemanticMagnitude} />
                            <SemanticBar label="Tempo" value={selectedDecision.semanticScores.tempo} maxAbs={maxSemanticMagnitude} />
                          </div>
                        </div>

                        <div className="space-y-2">
                          {selectedDecision.topCandidates.slice(0, 3).map((candidate) => (
                            <CandidateCard key={`${selectedDecision.decisionIndex}-${candidate.rank}-${candidate.actionSummary}`} candidate={candidate} maxAbs={maxSemanticMagnitude} />
                          ))}
                        </div>

                        {selectedDecision.rejectedCandidates.length > 0 ? (
                          <details className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-3">
                            <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                              Rejected Candidates
                            </summary>
                            <div className="mt-3 space-y-2">
                              {selectedDecision.rejectedCandidates.map((candidate) => (
                                <CandidateCard key={`${selectedDecision.decisionIndex}-rejected-${candidate.rank}-${candidate.actionSummary}`} candidate={candidate} maxAbs={maxSemanticMagnitude} />
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-3 text-[11px] text-[var(--text-muted)]">
                        No AI decision has been selected yet.
                      </div>
                    )}

                    <div className="max-h-[18rem] space-y-2 overflow-y-auto">
                      {replayVisibleTrace.length > 0 ? replayVisibleTrace.map((entry) => (
                        <button
                          key={`decision-${entry.decisionIndex}`}
                          type="button"
                          onClick={() => setSelectedDecisionId(entry.decisionIndex)}
                          className={`w-full rounded-xl border px-3 py-3 text-left ${selectedDecision?.decisionIndex === entry.decisionIndex ? 'border-[var(--accent-royal)] bg-[var(--accent-royal-soft)]' : 'border-[var(--border-subtle)] bg-[var(--surface-panel-muted)]'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-[0.16em]">{entry.actorLabel}</div>
                              <div className="mt-1 text-[11px] text-[var(--text-primary)]">{entry.actionSummary}</div>
                            </div>
                            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">T{entry.turnNumber}</div>
                          </div>
                          <div className="mt-2 text-[10px] text-[var(--text-muted)]">
                            {entry.reasoningCode}{entry.rejectionCode ? ` | ${entry.rejectionCode}` : ''} | L {formatSemanticValue(entry.semanticScores.lethality)} / S {formatSemanticValue(entry.semanticScores.selfPreservation)} / T {formatSemanticValue(entry.semanticScores.tempo)}
                          </div>
                        </button>
                      )) : (
                        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-3 text-[11px] text-[var(--text-muted)]">
                          Run a match to generate the semantic decision trace.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border-subtle)] px-3 py-4 text-[11px] text-[var(--text-muted)]">
                  Run a match to inspect actor outcomes and the semantic AI trace.
                </div>
              )}
            </SectionCard>

            <SectionCard title="Saved Runs" subtitle="Retained match artifacts remain replayable and traceable.">
              <div className="space-y-2">
                {artifacts.length > 0 ? artifacts.map((artifact) => {
                  const artifactKey = getDungeonLabArenaArtifactKey(artifact);
                  return (
                    <button
                      key={artifactKey}
                      type="button"
                      onClick={() => handleReplaySelect(artifact, artifact.actionLog.length)}
                      className={`w-full rounded-xl border px-3 py-3 text-left ${selectedArtifactKey === artifactKey ? 'border-[var(--accent-royal)] bg-[var(--accent-royal-soft)]' : 'border-[var(--border-subtle)] bg-[var(--surface-panel-muted)]'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em]">{artifact.result}</div>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{artifact.config.seed}</div>
                      </div>
                      <div className="mt-1 text-[11px] font-black uppercase tracking-[0.12em]">
                        {artifact.actorOutcomes.map((actor) => actor.name).join(' vs ')}
                      </div>
                      <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                        {artifact.actionLog.length} actions | {artifact.timelineMarkers.length} event pips
                      </div>
                    </button>
                  );
                }) : (
                  <div className="rounded-xl border border-dashed border-[var(--border-subtle)] px-3 py-4 text-[11px] text-[var(--text-muted)]">
                    No saved runs yet.
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Diagnostics" subtitle="Validation and worker errors stay consolidated here.">
              <div className="grid grid-cols-2 gap-2">
                <StatPill label="Errors" value={previewIssues.filter((issue) => issue.severity === 'error').length} tone={previewIssues.some((issue) => issue.severity === 'error') ? 'danger' : 'neutral'} />
                <StatPill label="Warnings" value={previewIssues.filter((issue) => issue.severity === 'warning').length} />
                <StatPill label="Markers" value={boardMarkers.length} />
                <StatPill label="Dirty" value={dirtySinceLastRun ? 'Yes' : 'No'} tone={dirtySinceLastRun ? 'accent' : 'neutral'} />
              </div>

              {workerError ? (
                <div className="rounded-lg border border-[var(--accent-danger)] bg-[var(--accent-danger-soft)] px-3 py-2 text-[11px]">{workerError}</div>
              ) : null}
              {previewError ? (
                <div className="rounded-lg border border-[var(--accent-danger)] bg-[var(--accent-danger-soft)] px-3 py-2 text-[11px]">{previewError}</div>
              ) : null}
              {previewIssues.length > 0 ? (
                <div className="space-y-2">
                  {previewIssues.slice(0, 8).map((issue, index) => (
                    <IssueNotice key={`${issue.code}-${issue.actorId || 'global'}-${index}`} issue={issue} />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-2 text-[11px]">
                  No active diagnostics. The arena is ready to run.
                </div>
              )}
            </SectionCard>
          </aside>
        ) : null}
      </main>
    </div>
  );
};
