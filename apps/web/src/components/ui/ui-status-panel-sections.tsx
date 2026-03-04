import React from 'react';
import type { GameState } from '@hop/engine';
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
  acaeEnabled: boolean;
  sharedVectorCarryEnabled: boolean;
  capabilityPassivesEnabled: boolean;
  movementRuntimeEnabled: boolean;
  intelStrict: boolean;
}

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

export const UiVitalsSection: React.FC<StatusIntelProps> = ({ gameState, compact, intelMode }) => (
  <div className={compact ? 'space-y-4' : 'space-y-6'}>
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

    {gameState.enemies.filter(e => e.subtype === 'sentinel').map((boss) => {
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

export const UiRulesetSection: React.FC<StatusIntelProps & { onIntelModeChange: (mode: UiInformationRevealMode) => void }> = ({
  gameState,
  compact,
  intelMode,
  onIntelModeChange
}) => {
  const { acaeEnabled, sharedVectorCarryEnabled, capabilityPassivesEnabled, movementRuntimeEnabled, intelStrict } = getUiRulesetFlags(gameState, intelMode);
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Ruleset</span>
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        <UiRulesetItem label="ACAE" value={acaeEnabled} />
        <UiRulesetItem label="Shared Vector Carry" value={sharedVectorCarryEnabled} />
        <UiRulesetItem label="Capability Passives" value={capabilityPassivesEnabled} />
        <UiRulesetItem label="Movement Runtime" value={movementRuntimeEnabled} />
        <UiRulesetItem label="Intel Strict" value={intelStrict} />
        <UiIntelToggleSection intelMode={intelMode} onIntelModeChange={onIntelModeChange} />
      </div>
    </div>
  );
};

export const getUiRulesetFlags = (gameState: GameState, revealMode: UiInformationRevealMode): UiRulesetFlags => {
  return {
    acaeEnabled: gameState.ruleset?.ailments?.acaeEnabled === true,
    sharedVectorCarryEnabled: gameState.ruleset?.attachments?.sharedVectorCarry === true,
    capabilityPassivesEnabled: gameState.ruleset?.capabilities?.loadoutPassivesEnabled === true,
    movementRuntimeEnabled: gameState.ruleset?.capabilities?.movementRuntimeEnabled === true,
    intelStrict: revealMode === 'strict'
  };
};

export const UiDirectivesSection: React.FC<DirectivesSectionProps> = ({
  compact,
  inputLocked,
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
      <span className="text-sm font-bold text-[var(--text-secondary)]">Secure & Wait</span>
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
      <span className="text-sm font-bold text-[var(--text-secondary)]">Return to Hub</span>
      <span className="text-lg grayscale group-hover:grayscale-0 transition-all">H</span>
    </button>
  </div>
);

