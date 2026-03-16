import React from 'react';
import {
  isEnemyAlertActive,
  resolveCombatPressureMode,
  type ActionResourcePreview,
  type GameState
} from '@hop/engine';
import { UiStateBadge } from './ui-status-panel-sections';
import { UiVitalsDetailCard } from './ui-vitals-detail-card';

interface UiVitalsGlyphProps {
  gameState: GameState;
  layoutMode: 'mobile_portrait' | 'tablet' | 'desktop_command_center';
  showDetail: boolean;
  onToggleDetail: () => void;
  resourcePreview?: ActionResourcePreview;
  turnFlowMode?: 'protected_single' | 'manual_chain';
  overdriveArmed?: boolean;
}

const toPct = (value: number, max: number): number =>
  Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));

const formatCompactValue = (value: number, max: number): string => `${Math.round(value)}/${Math.round(max)}`;

export const UiVitalsGlyph: React.FC<UiVitalsGlyphProps> = ({
  gameState,
  layoutMode,
  showDetail,
  onToggleDetail,
  resourcePreview,
  turnFlowMode = 'protected_single',
  overdriveArmed = false
}) => {
  const shellRef = React.useRef<HTMLDivElement | null>(null);
  const ires = gameState.player.ires;
  if (!ires) return null;

  const combatPressureMode = resolveCombatPressureMode(gameState);
  const enemyAlert = isEnemyAlertActive(gameState);
  const stateLabel = ires.currentState === 'exhausted'
    ? 'Exhausted'
    : ires.currentState === 'rested'
      ? 'Rested'
      : 'Base';
  const sparkPct = toPct(ires.spark, ires.maxSpark);
  const hpPct = toPct(gameState.player.hp, gameState.player.maxHp);
  const manaPct = toPct(ires.mana, ires.maxMana);
  const exhaustionPct = toPct(ires.exhaustion, 100);
  const projectedSparkPct = resourcePreview?.turnProjection ? toPct(resourcePreview.turnProjection.spark.projected, ires.maxSpark) : undefined;
  const projectedExhaustionPct = resourcePreview?.turnProjection ? toPct(resourcePreview.turnProjection.exhaustion.projected, 100) : undefined;
  const compactMode = layoutMode !== 'desktop_command_center';
  const isMobilePortrait = layoutMode === 'mobile_portrait';
  const sparkGradient = `conic-gradient(from 210deg, rgba(245, 158, 11, 0.12) 0deg, rgba(245, 158, 11, 0.12) ${sparkPct * 3.6}deg, rgba(120, 53, 15, 0.18) ${sparkPct * 3.6}deg 360deg)`;
  const exhaustionGradient = ires.exhaustion >= 80
    ? `conic-gradient(from 180deg, rgba(239, 68, 68, 0.92) 0deg, rgba(239, 68, 68, 0.92) ${exhaustionPct * 3.6}deg, rgba(127, 29, 29, 0.2) ${exhaustionPct * 3.6}deg 360deg)`
    : ires.exhaustion <= 20
      ? `conic-gradient(from 180deg, rgba(255, 255, 255, 0.92) 0deg, rgba(255, 255, 255, 0.92) ${exhaustionPct * 3.6}deg, rgba(148, 163, 184, 0.16) ${exhaustionPct * 3.6}deg 360deg)`
      : `conic-gradient(from 180deg, rgba(168, 85, 247, 0.92) 0deg, rgba(168, 85, 247, 0.92) ${exhaustionPct * 3.6}deg, rgba(88, 28, 135, 0.18) ${exhaustionPct * 3.6}deg 360deg)`;
  const detailCardClassName = isMobilePortrait
    ? 'fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+5.25rem)] z-40 w-[min(24rem,calc(100vw-0.75rem))] -translate-x-1/2'
    : 'absolute left-1/2 top-[calc(100%+0.6rem)] z-30 w-[min(24rem,92vw)] -translate-x-1/2';

  React.useEffect(() => {
    if (!showDetail || typeof document === 'undefined') return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (shellRef.current?.contains(target)) return;
      onToggleDetail();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onToggleDetail();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onToggleDetail, showDetail]);

  return (
    <div
      ref={shellRef}
      className={`ui-vitals-glyph-shell relative ${compactMode ? 'w-[min(17.5rem,50vw)] max-w-full' : 'w-72'}`}
      data-layout-mode={layoutMode}
    >
      <button
        type="button"
        onClick={onToggleDetail}
        className={`ui-vitals-glyph ${ires.currentState === 'exhausted' ? 'ui-vitals-glyph-redline' : ''} w-full rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 py-2 text-left shadow-[0_8px_20px_rgba(15,23,42,0.08)]`}
        aria-expanded={showDetail}
        aria-label="Toggle vitals details"
      >
        <div className="flex items-center justify-center">
          <div className="ui-vitals-glyph-frame relative flex items-center justify-center">
            <div className="ui-vitals-glyph-wing ui-vitals-glyph-wing-left">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">HP</div>
              <div className="text-sm font-black text-[var(--accent-danger)]">{formatCompactValue(gameState.player.hp, gameState.player.maxHp)}</div>
              <div className="ui-vitals-glyph-wing-bar">
                <div className="ui-vitals-glyph-wing-fill bg-[var(--accent-danger)]" style={{ width: `${hpPct}%` }} />
              </div>
            </div>

            <div className="ui-vitals-glyph-core-shell relative">
              <div className="ui-vitals-glyph-exhaustion-ring" style={{ backgroundImage: exhaustionGradient }} />
              {projectedExhaustionPct !== undefined ? (
                <div
                  className="ui-vitals-glyph-projection-ring"
                  style={{ backgroundImage: `conic-gradient(from 180deg, rgba(255,255,255,0.85) 0deg, rgba(255,255,255,0.85) ${projectedExhaustionPct * 3.6}deg, rgba(255,255,255,0) ${projectedExhaustionPct * 3.6}deg 360deg)` }}
                />
              ) : null}
              <div className="ui-vitals-glyph-core" style={{ backgroundImage: sparkGradient }}>
                {projectedSparkPct !== undefined ? (
                  <div
                    className="ui-vitals-glyph-core-projection"
                    style={{ backgroundImage: `conic-gradient(from 210deg, rgba(255,255,255,0.8) 0deg, rgba(255,255,255,0.8) ${projectedSparkPct * 3.6}deg, rgba(255,255,255,0) ${projectedSparkPct * 3.6}deg 360deg)` }}
                  />
                ) : null}
                <div className="ui-vitals-glyph-core-inner">
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-900/70">Spark</div>
                  <div className="text-2xl font-black text-amber-950">{Math.round(ires.spark)}</div>
                  <div className="text-[10px] font-bold text-amber-900/70">/ {Math.round(ires.maxSpark)}</div>
                </div>
              </div>
              {resourcePreview?.sparkBurnHpDelta ? (
                <div className="ui-vitals-glyph-badge ui-vitals-glyph-badge-burn">Burn {resourcePreview.sparkBurnHpDelta}</div>
              ) : null}
            </div>

            <div className="ui-vitals-glyph-wing ui-vitals-glyph-wing-right">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">MP</div>
              <div className="text-sm font-black text-cyan-700">{formatCompactValue(ires.mana, ires.maxMana)}</div>
              <div className="ui-vitals-glyph-wing-bar">
                <div className="ui-vitals-glyph-wing-fill bg-cyan-500" style={{ width: `${manaPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          <UiStateBadge stateLabel={stateLabel} />
          {combatPressureMode === 'travel' ? (
            <span className="ui-vitals-glyph-chip ui-vitals-glyph-chip-travel">Travel Mode</span>
          ) : null}
          <span className="ui-vitals-glyph-chip ui-vitals-glyph-chip-calm">
            {turnFlowMode === 'protected_single' ? 'Protected' : 'Manual Chain'}
          </span>
          {turnFlowMode === 'protected_single' ? (
            <span className="ui-vitals-glyph-chip ui-vitals-glyph-chip-calm">Auto-End: 1</span>
          ) : null}
          <span className={`ui-vitals-glyph-chip ${enemyAlert ? 'ui-vitals-glyph-chip-alert' : 'ui-vitals-glyph-chip-calm'}`}>
            Alert {enemyAlert ? 'On' : 'Off'}
          </span>
          {overdriveArmed ? <span className="ui-vitals-glyph-chip ui-vitals-glyph-chip-bonus">Overdrive Armed</span> : null}
          {ires.pendingRestedBonus ? <span className="ui-vitals-glyph-chip ui-vitals-glyph-chip-bonus">Bonus Armed</span> : null}
        </div>
      </button>

      {showDetail ? (
        <>
          {compactMode ? (
            <button
              type="button"
              aria-label="Close vitals details"
              className="fixed inset-0 z-30 bg-transparent"
              onClick={onToggleDetail}
            />
          ) : null}
          <div className={detailCardClassName}>
          <UiVitalsDetailCard
            gameState={gameState}
            resourcePreview={resourcePreview}
            compact
            turnFlowMode={turnFlowMode}
            overdriveArmed={overdriveArmed}
          />
          </div>
        </>
      ) : null}
    </div>
  );
};

export default UiVitalsGlyph;
