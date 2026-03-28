import React from 'react';
import {
  computeManaRecoveryIfEndedNow,
  computeSparkRecoveryIfEndedNow,
  resolveCombatPressureMode,
  resolveEffectiveBfi,
  resolveExhaustionTax,
  resolveIresWeightModifier,
  type GameState
} from '@hop/engine';
import { InitiativeDisplay } from '../InitiativeQueue';
import {
  getUiActorInformation,
  type UiInformationRevealMode
} from '../../app/information-reveal';

interface CompactFlagProps {
  compact: boolean;
}

interface StatusGameProps extends CompactFlagProps {
  gameState: GameState;
}

interface StatusIntelProps extends StatusGameProps {
  intelMode: UiInformationRevealMode;
}

interface ProgressSectionProps extends StatusGameProps {
  score: number;
}

interface DirectivesSectionProps extends CompactFlagProps {
  inputLocked: boolean;
  waitLabel?: string;
  onWait: () => void;
  onReset: () => void;
  onExitToHub: () => void;
}

interface RulesetItemProps {
  label: string;
  value: boolean;
}

interface IntelToggleProps {
  intelMode: UiInformationRevealMode;
  onIntelModeChange: (mode: UiInformationRevealMode) => void;
}

export interface UiRulesetFlags {
  intelStrict: boolean;
}

const pct = (current: number, max: number): string =>
  `${Math.max(0, Math.min(100, max > 0 ? (current / max) * 100 : 0))}%`;

const formatStateLabel = (state: string | undefined): 'Base' | 'Rested' | 'Exhausted' =>
  state === 'exhausted'
    ? 'Exhausted'
    : state === 'rested'
      ? 'Rested'
      : 'Base';

const capitalizeWord = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export const getWaitDirectiveLabel = (gameState: GameState): 'Rest' | 'End Turn' => {
  const ires = gameState.player.ires;
  return ires && (ires.actedThisTurn || ires.movedThisTurn) ? 'End Turn' : 'Rest';
};

export const UiStateBadge: React.FC<{ stateLabel: string }> = ({ stateLabel }) => {
  const style = stateLabel === 'Exhausted'
    ? 'border-[var(--accent-danger-border)] bg-[var(--accent-danger-soft)] text-[var(--accent-danger)]'
    : stateLabel === 'Rested'
      ? 'border-cyan-200/70 bg-cyan-100/70 text-sky-900'
      : 'border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[var(--text-muted)]';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] ${style}`}>
      {stateLabel}
    </span>
  );
};

const UiResourceBar: React.FC<{
  label: string;
  value: number;
  max: number;
  className: string;
  fillClassName: string;
  segmented?: boolean;
  pulse?: boolean;
}> = ({
  label,
  value,
  max,
  className,
  fillClassName,
  segmented = false,
  pulse = false
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</span>
      <span className="text-sm font-black text-[var(--text-primary)]">
        {Math.round(value)} <span className="text-[var(--text-muted)] text-[10px]">/ {Math.round(max)}</span>
      </span>
    </div>
    <div className={`relative h-3 overflow-hidden rounded-full border ${className} ${pulse ? 'ires-spark-pulse' : ''}`}>
      <div className={`h-full transition-[width] duration-200 ${fillClassName}`} style={{ width: pct(value, max) }} />
      {segmented && (
        <div className="pointer-events-none absolute inset-0 grid grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`${label}-${idx}`} className="border-r border-black/20 last:border-r-0" />
          ))}
        </div>
      )}
    </div>
  </div>
);

export const UiTriResourceHeader: React.FC<StatusGameProps & {
  mobile?: boolean;
  variant?: 'default' | 'board_condensed';
}> = ({
  gameState,
  compact,
  mobile = false,
  variant = 'default'
}) => {
  const ires = gameState.player.ires;
  if (!ires) return null;

  const combatPressureMode = resolveCombatPressureMode(gameState);
  const isSparkDeficit = ires.spark < 50;
  const stateLabel = formatStateLabel(ires.currentState);
  const showCompactStatusChips = mobile || variant === 'board_condensed';

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex items-center justify-between gap-3">
        <div>
          {!showCompactStatusChips && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Metabolic Engine</div>
              <div className="text-xs font-bold text-[var(--text-secondary)]">Fuel and friction for the active turn.</div>
              {combatPressureMode === 'travel' && (
                <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-950/45 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
                  <span>Travel Mode</span>
                  {!compact && <span className="text-[9px] font-bold tracking-[0.12em] text-emerald-200/85">Movement auto-recovers while alert is off</span>}
                </div>
              )}
            </>
          )}
          {showCompactStatusChips && (
            <div className="flex flex-wrap items-center gap-2">
              <UiStateBadge stateLabel={stateLabel} />
              {combatPressureMode === 'travel' && (
                <span className="inline-flex items-center rounded-full border border-emerald-400/35 bg-emerald-950/45 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-100">
                  Travel Mode
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ires.pendingRestedBonus && (
            <span className="inline-flex items-center rounded-full border border-cyan-200/70 bg-cyan-100/70 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-sky-900">
              Bonus Armed
            </span>
          )}
          {!showCompactStatusChips && <UiStateBadge stateLabel={stateLabel} />}
        </div>
      </div>
      <UiResourceBar
        label="Spark"
        value={ires.spark}
        max={ires.maxSpark}
        className="border-amber-500/40 bg-amber-950/40"
        fillClassName="bg-gradient-to-r from-amber-400 to-orange-400"
        segmented
        pulse={isSparkDeficit}
      />
      <UiResourceBar
        label="Mana"
        value={ires.mana}
        max={ires.maxMana}
        className="border-cyan-400/40 bg-cyan-950/35"
        fillClassName="bg-gradient-to-r from-cyan-400 to-sky-400"
      />
    </div>
  );
};

export const UiMetabolicProfileSection: React.FC<StatusGameProps> = ({ gameState, compact }) => {
  const ires = gameState.player.ires;
  if (!ires) return null;
  const effectiveBfi = resolveEffectiveBfi(gameState.player);
  const weight = resolveIresWeightModifier(gameState.player.weightClass);
  const nextTax = resolveExhaustionTax(gameState.player, ires.actionCountThisTurn, gameState.ruleset);
  const upcomingTaxes = Array.from({ length: 4 }, (_, idx) => resolveExhaustionTax(gameState.player, ires.actionCountThisTurn + idx, gameState.ruleset));
  const stateMod = ires.currentState === 'exhausted' ? 'Redline' : ires.currentState === 'rested' ? 'Rested' : 'Base';
  const sparkRecovery = computeSparkRecoveryIfEndedNow(gameState.player, ires);
  const manaRecovery = computeManaRecoveryIfEndedNow(gameState.player, ires);

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">INFO</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">RST 80 / RED 20 / Exit 50</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">BFI</div>
          <div className="text-2xl font-black text-[var(--text-primary)]">{effectiveBfi}</div>
          <div className="text-[11px] text-[var(--text-secondary)]">Armor {weight.tier} ({weight.bfi >= 0 ? '+' : ''}{weight.bfi})</div>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Next Tempo</div>
          <div className="text-2xl font-black text-[var(--text-primary)]">{nextTax}</div>
          <div className="text-[11px] text-[var(--text-secondary)]">Action #{ires.actionCountThisTurn + 1}</div>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Recovery</div>
          <div className="text-lg font-black text-[var(--text-primary)]">+{sparkRecovery} / +{manaRecovery}</div>
          <div className="text-[11px] text-[var(--text-secondary)]">Spark / Mana</div>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">State Mod</div>
          <div className="text-lg font-black text-[var(--text-primary)]">{stateMod}</div>
          <div className="text-[11px] text-[var(--text-secondary)]">
            {ires.activeRestedCritBonusPct > 0 ? `+${ires.activeRestedCritBonusPct}% crit` : 'No crit modifier'}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Tempo Ladder</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {upcomingTaxes.map((tax, idx) => (
            <div key={`tax-${idx}`} className="rounded-lg bg-[var(--surface-panel-hover)] px-2 py-1.5 text-[11px] font-bold text-[var(--text-secondary)]">
              Action {ires.actionCountThisTurn + idx + 1}: +{tax} SP
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const UiStatusHeader: React.FC<CompactFlagProps> = ({ compact }) => (
  <div className="flex justify-between items-start">
    <div>
      <h1 className={`${compact ? 'text-base' : 'text-xl'} font-black uppercase tracking-widest text-[var(--text-primary)] mb-1`}>Hoplite</h1>
      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em]">Tactical Arena</p>
    </div>
    <div className={`px-2 py-1 bg-[var(--surface-panel-muted)] rounded border border-[var(--border-subtle)] text-[10px] font-black text-[var(--text-muted)] ${compact ? 'hidden sm:block' : ''}`}>
      V2.1.0
    </div>
  </div>
);

export const UiInitiativeSection: React.FC<{ hideInitiativeQueue: boolean; gameState: GameState; intelMode: UiInformationRevealMode }> = ({
  hideInitiativeQueue,
  gameState,
  intelMode
}) => (hideInitiativeQueue ? null : <InitiativeDisplay gameState={gameState} revealMode={intelMode} />);

export const UiSentinelDirectiveSection: React.FC<StatusIntelProps> = ({ gameState, intelMode }) => (
  <>
    {gameState.enemies.filter(enemy => enemy.subtype === 'sentinel').map((boss) => {
      const info = getUiActorInformation(gameState, gameState.player.id, boss.id, intelMode);
      const showName = info.reveal.name;
      const showHp = info.reveal.hp;
      const bossLabel = showName ? (info.data.name || 'Sentinel Directive') : 'Unknown Directive';
      const hpCurrent = showHp ? boss.hp : 0;
      const hpMax = showHp ? boss.maxHp : 0;
      const hpWidth = showHp ? (boss.hp / boss.maxHp) * 100 : 0;
      return (
        <div key={boss.id} className="pt-4 animate-in slide-in-from-right-8 duration-500">
          <div className="flex justify-between items-end mb-2">
            <span className="text-xs font-black text-[var(--accent-danger)] uppercase tracking-tighter italic">{bossLabel}</span>
            <span className="text-lg font-black">{hpCurrent} <span className="text-[var(--text-muted)] text-xs">/ {hpMax}</span></span>
          </div>
          <div className="h-4 w-full bg-[var(--accent-danger-soft)] rounded-md border border-[var(--accent-danger-border)] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--accent-danger)] to-[color:var(--accent-danger)] shadow-[0_0_20px_rgba(200,79,53,0.35)] transition-all duration-300"
              style={{ width: `${hpWidth}%` }}
            />
          </div>
        </div>
      );
    })}
  </>
);

const UiBoardStatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-2">
    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</span>
    <span className="text-sm font-black text-[var(--text-primary)] text-right">{value}</span>
  </div>
);

export const UiBoardStatsSection: React.FC<StatusGameProps> = ({ gameState, compact }) => {
  const ires = gameState.player.ires;
  if (!ires) return null;

  const stateLabel = formatStateLabel(ires.currentState);
  const combatPressureMode = resolveCombatPressureMode(gameState);
  const effectiveBfi = resolveEffectiveBfi(gameState.player);
  const nextTax = resolveExhaustionTax(gameState.player, ires.actionCountThisTurn, gameState.ruleset);
  const coreStats = [
    { label: 'HP', value: `${gameState.player.hp}/${gameState.player.maxHp}` },
    { label: 'Guard', value: String(gameState.player.temporaryArmor || 0) },
    { label: 'Spark', value: `${Math.round(ires.spark)}/${Math.round(ires.maxSpark)}` },
    { label: 'Mana', value: `${Math.round(ires.mana)}/${Math.round(ires.maxMana)}` },
    { label: 'State', value: stateLabel }
  ];
  const derivedStats = [
    { label: 'BFI', value: String(effectiveBfi) },
    { label: 'Next Tempo', value: `+${nextTax} SP` },
    { label: 'Recovery', value: `+${computeSparkRecoveryIfEndedNow(gameState.player, ires)} Spark / +${computeManaRecoveryIfEndedNow(gameState.player, ires)} Mana` },
    { label: 'Crit Bonus', value: `${ires.activeRestedCritBonusPct}%` },
    { label: 'Pressure', value: capitalizeWord(combatPressureMode) },
    { label: 'Bonus', value: ires.pendingRestedBonus ? 'Armed' : 'Idle' }
  ];

  return (
    <section className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Core</div>
          {coreStats.map((stat) => <UiBoardStatRow key={stat.label} label={stat.label} value={stat.value} />)}
        </div>
        <div className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Derived</div>
          {derivedStats.map((stat) => <UiBoardStatRow key={stat.label} label={stat.label} value={stat.value} />)}
        </div>
      </div>
    </section>
  );
};

export const UiVitalsSection: React.FC<StatusIntelProps> = ({ gameState, compact, intelMode }) => (
  <div className={compact ? 'space-y-4' : 'space-y-6'}>
    <UiTriResourceHeader gameState={gameState} compact={compact} />

    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold mb-2">Vitality</span>
        <div className="flex items-end gap-2">
          <span className={`${compact ? 'text-3xl' : 'text-4xl'} font-black text-[var(--accent-danger)] leading-none`}>{gameState.player.hp}</span>
          <span className="text-xl text-[var(--text-muted)] font-bold leading-none mb-1">/</span>
          <span className="text-xl text-[var(--text-secondary)] font-bold leading-none mb-1">{gameState.player.maxHp}</span>
        </div>
      </div>

      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold mb-2">Guardian Plating</span>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-sm ${gameState.player.temporaryArmor ? 'bg-[var(--accent-royal)] rotate-45' : 'bg-[var(--surface-panel-hover)] border border-[var(--border-subtle)]'}`} />
          <span className="text-2xl font-black text-[var(--accent-royal)] leading-none">{gameState.player.temporaryArmor || 0}</span>
        </div>
      </div>
    </div>

    <UiSentinelDirectiveSection gameState={gameState} compact={compact} intelMode={intelMode} />

    <UiMetabolicProfileSection gameState={gameState} compact={compact} />
  </div>
);

export const UiProgressSection: React.FC<ProgressSectionProps> = ({ compact, gameState, score }) => (
  <div className={`${compact ? 'py-4 space-y-4' : 'py-8 space-y-6'} border-y border-[var(--border-subtle)]`}>
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Arcade Progress</span>
        <span className="text-xl font-black">{gameState.floor} <span className="text-[var(--text-muted)] text-sm">/ 10</span></span>
      </div>
      <div className="h-1.5 w-full bg-[var(--surface-panel-hover)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
        <div
          className="h-full bg-[var(--accent-royal)] shadow-[0_0_15px_rgba(39,82,146,0.35)] transition-all duration-1000 ease-out"
          style={{ width: `${(gameState.floor / 10) * 100}%` }}
        />
      </div>
    </div>
    <div className="flex justify-between items-center">
      <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Current Score</span>
      <span className="text-xl font-black text-[var(--text-primary)]">{score.toLocaleString()}</span>
    </div>
  </div>
);

const UiRulesetItem: React.FC<RulesetItemProps> = ({ label, value }) => (
  <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-2">
    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
    <span
      className={`text-[10px] font-black uppercase tracking-widest ${
        value ? 'text-[var(--accent-royal)]' : 'text-[var(--text-muted)]'
      }`}
    >
      {value ? 'On' : 'Off'}
    </span>
  </div>
);

export const UiIntelToggleSection: React.FC<IntelToggleProps> = ({ intelMode, onIntelModeChange }) => (
  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-2">
    <span className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Intel Mode</span>
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={() => onIntelModeChange('force_reveal')}
        className={`px-2 py-1.5 rounded border text-[10px] font-black uppercase tracking-widest transition-colors ${
          intelMode === 'force_reveal'
            ? 'bg-[var(--accent-brass-soft)] border-[var(--accent-brass)] text-[var(--text-primary)]'
            : 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-panel-hover)]'
        }`}
      >
        Force
      </button>
      <button
        onClick={() => onIntelModeChange('strict')}
        className={`px-2 py-1.5 rounded border text-[10px] font-black uppercase tracking-widest transition-colors ${
          intelMode === 'strict'
            ? 'bg-[var(--accent-danger-soft)] border-[var(--accent-danger)] text-[var(--accent-danger)]'
            : 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-panel-hover)]'
        }`}
      >
        Strict
      </button>
    </div>
  </div>
);

export const UiRulesetSection: React.FC<StatusIntelProps & {
  onIntelModeChange: (mode: UiInformationRevealMode) => void;
  showIntelControls: boolean;
}> = ({
  compact,
  intelMode,
  showIntelControls,
  onIntelModeChange
}) => {
  if (!showIntelControls) return null;
  const { intelStrict } = getUiRulesetFlags(intelMode);
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Intel</span>
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        <UiRulesetItem label="Intel Strict" value={intelStrict} />
        <UiIntelToggleSection intelMode={intelMode} onIntelModeChange={onIntelModeChange} />
      </div>
    </div>
  );
};

export const getUiRulesetFlags = (revealMode: UiInformationRevealMode): UiRulesetFlags => ({
  intelStrict: revealMode === 'strict'
});

export const UiDirectivesSection: React.FC<DirectivesSectionProps> = ({
  compact,
  inputLocked,
  waitLabel = 'Rest',
  onWait,
  onReset,
  onExitToHub
}) => (
  <div className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
    <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold mb-1">Directives</span>
    <button
      disabled={inputLocked}
      onClick={onWait}
      className={`w-full flex justify-between items-center ${compact ? 'px-3 py-2.5' : 'px-4 py-3'} border rounded-xl transition-all group ${inputLocked
        ? 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed opacity-50'
        : 'bg-[var(--surface-panel-hover)] hover:bg-[var(--surface-panel-muted)] border-[var(--border-subtle)]'
      }`}
    >
      <span className="text-sm font-bold text-[var(--text-secondary)]">{waitLabel}</span>
      <span className="text-lg grayscale group-hover:grayscale-0 transition-all">S</span>
    </button>
    <button
      onClick={onReset}
      className={`w-full flex justify-between items-center ${compact ? 'px-3 py-2.5' : 'px-4 py-3'} bg-[var(--accent-danger-soft)] hover:brightness-105 border border-[var(--accent-danger-border)] rounded-xl transition-all group`}
    >
      <span className="text-sm font-bold text-[var(--accent-danger)]">Reset Chronology</span>
      <span className="text-lg grayscale group-hover:grayscale-0 transition-all">R</span>
    </button>
    <button
      onClick={onExitToHub}
      className={`w-full flex justify-between items-center ${compact ? 'px-3 py-2.5' : 'px-4 py-3'} bg-[var(--surface-panel-hover)] hover:bg-[var(--surface-panel-muted)] border border-[var(--border-subtle)] rounded-xl transition-all group`}
    >
      <span className="text-sm font-bold text-[var(--text-secondary)]">Home</span>
      <span className="text-lg grayscale group-hover:grayscale-0 transition-all">H</span>
    </button>
  </div>
);
