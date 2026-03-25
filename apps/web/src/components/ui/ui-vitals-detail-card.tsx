import React from 'react';
import type { ActionResourcePreview, GameState } from '@hop/engine';
import { UiMetabolicProfileSection, UiTriResourceHeader } from './ui-status-panel-sections';

interface UiVitalsDetailCardProps {
  gameState: GameState;
  resourcePreview?: ActionResourcePreview;
  compact?: boolean;
  turnFlowMode?: 'protected_single' | 'manual_chain';
  overdriveArmed?: boolean;
}

const formatDelta = (value: number): string => `${value > 0 ? '+' : ''}${value}`;

export const UiVitalsDetailCard: React.FC<UiVitalsDetailCardProps> = ({
  gameState,
  resourcePreview,
  compact = true,
  turnFlowMode = 'protected_single',
  overdriveArmed = false
}) => {
  const projection = resourcePreview?.turnProjection;

  return (
    <div className="ui-vitals-detail-card surface-panel-material rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-3 shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Vitals INFO</div>
          {compact ? (
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Tap outside to close</div>
          ) : null}
        </div>
        <UiTriResourceHeader gameState={gameState} compact={compact} />
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Turn Flow</div>
          <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] font-bold text-[var(--text-secondary)]">
            <div>Mode: {turnFlowMode === 'protected_single' ? 'Protected Single' : 'Manual Chain'}</div>
            <div>Auto-End: {turnFlowMode === 'protected_single' ? '1 action' : 'disabled'}</div>
            <div>{overdriveArmed ? 'Overdrive: chaining enabled' : 'Overdrive: idle'}</div>
          </div>
        </div>
        {projection ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Projected Turn State</div>
            <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] font-bold text-[var(--text-secondary)]">
              {typeof resourcePreview?.tempoSparkCost === 'number' ? (
                <div>Tempo: +{resourcePreview.tempoSparkCost} SP</div>
              ) : null}
              {typeof resourcePreview?.skillSparkSurcharge === 'number' ? (
                <div>Skill: +{resourcePreview.skillSparkSurcharge} SP</div>
              ) : null}
              {typeof resourcePreview?.sparkCostTotal === 'number' && resourcePreview.sparkCostTotal > 0 ? (
                <div>Total Spark Cost: {resourcePreview.sparkCostTotal} SP</div>
              ) : null}
              {typeof resourcePreview?.manaCost === 'number' && resourcePreview.manaCost > 0 ? (
                <div>Mana Cost: {resourcePreview.manaCost} MP</div>
              ) : null}
              <div>Spark: {projection.spark.current} to {projection.spark.projected} ({formatDelta(projection.spark.delta)})</div>
              <div>Mana: {projection.mana.current} to {projection.mana.projected} ({formatDelta(projection.mana.delta)})</div>
              <div>State: {projection.sparkStateBefore || gameState.player.ires?.currentState} to {projection.sparkStateAfter || projection.stateAfter}</div>
              {typeof projection.projectedSparkRecoveryIfEndedNow === 'number' ? (
                <div>Recover If Ended Now: +{projection.projectedSparkRecoveryIfEndedNow} SP</div>
              ) : null}
              {resourcePreview?.travelRecoveryApplied && <div className="text-emerald-700">Travel recovery applies</div>}
              {resourcePreview?.sparkBurnOutcome === 'travel_suppressed' ? <div className="text-emerald-700">Burn suppressed in travel</div> : null}
              {resourcePreview?.sparkBurnHpDelta ? <div className="text-[var(--accent-danger)]">Spark Burn: {resourcePreview.sparkBurnHpDelta} HP</div> : null}
            </div>
          </div>
        ) : null}
        <UiMetabolicProfileSection gameState={gameState} compact={compact} />
      </div>
    </div>
  );
};

export default UiVitalsDetailCard;
