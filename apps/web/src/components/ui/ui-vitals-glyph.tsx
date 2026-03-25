import React from 'react';
import {
  type ActionResourcePreview,
  type GameState
} from '@hop/engine';
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

  const sparkPct = toPct(ires.spark, ires.maxSpark);
  const hpPct = toPct(gameState.player.hp, gameState.player.maxHp);
  const manaPct = toPct(ires.mana, ires.maxMana);
  const hpProjectionDelta = Number((gameState.intentPreview as { playerHpDelta?: number } | undefined)?.playerHpDelta || 0);
  const projectedHpPct = hpProjectionDelta !== 0
    ? toPct(gameState.player.hp + hpProjectionDelta, gameState.player.maxHp)
    : undefined;
  const projectedSparkPct = resourcePreview?.turnProjection ? toPct(resourcePreview.turnProjection.spark.projected, ires.maxSpark) : undefined;
  const projectedManaPct = resourcePreview?.turnProjection ? toPct(resourcePreview.turnProjection.mana.projected, ires.maxMana) : undefined;
  const compactMode = layoutMode !== 'desktop_command_center';
  const isMobilePortrait = layoutMode === 'mobile_portrait';
  const detailCardClassName = isMobilePortrait
    ? 'fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+5.25rem)] z-40 w-[min(24rem,calc(100vw-0.75rem))] -translate-x-1/2'
    : 'absolute left-1/2 top-[calc(100%+0.6rem)] z-30 w-[min(24rem,92vw)] -translate-x-1/2';
  const stateLabel = ires.currentState === 'exhausted' ? 'RED' : ires.currentState === 'rested' ? 'RST' : 'BAS';

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
      className={`ui-vitals-glyph-shell relative ${compactMode ? 'w-[min(14rem,42vw)] max-w-full' : 'w-72'}`}
      data-layout-mode={layoutMode}
    >
      <button
        type="button"
        onClick={onToggleDetail}
        className={`ui-vitals-glyph ${ires.currentState === 'exhausted' ? 'ui-vitals-glyph-redline' : ''} w-full text-left`}
        aria-expanded={showDetail}
        aria-label="Toggle vitals details"
      >
        <div className="ui-vitals-glyph-frame">
          <div className="ui-vitals-glyph-meter ui-vitals-glyph-meter-hp">
            <div className="ui-vitals-glyph-meter-label">HP</div>
            <div className="ui-vitals-glyph-meter-value ui-vitals-glyph-meter-value-danger">
              {formatCompactValue(gameState.player.hp, gameState.player.maxHp)}
            </div>
            <div className="ui-vitals-glyph-meter-track">
              <div className="ui-vitals-glyph-meter-fill ui-vitals-glyph-meter-fill-danger" style={{ width: `${hpPct}%` }} />
              {projectedHpPct !== undefined ? (
                <div
                  className="ui-vitals-glyph-meter-projection"
                  style={{ left: `calc(${projectedHpPct}% - 1px)` }}
                />
              ) : null}
            </div>
          </div>

          <div className="ui-vitals-glyph-core-readout">
            <div className="ui-vitals-glyph-meter ui-vitals-glyph-meter-spark">
              <div className="ui-vitals-glyph-meter-label">Spark</div>
              <div className="ui-vitals-glyph-core-value">{Math.round(ires.spark)}</div>
              <div className="ui-vitals-glyph-core-subvalue">/ {Math.round(ires.maxSpark)}</div>
              <div className="ui-vitals-glyph-meter-track">
                <div className="ui-vitals-glyph-meter-fill ui-vitals-glyph-meter-fill-spark" style={{ width: `${sparkPct}%` }} />
                {projectedSparkPct !== undefined ? (
                  <div
                    className="ui-vitals-glyph-meter-projection"
                    style={{ left: `calc(${projectedSparkPct}% - 1px)` }}
                  />
                ) : null}
              </div>
            </div>

            <div className="ui-vitals-glyph-meter ui-vitals-glyph-meter-ex" aria-label={`State ${ires.currentState}`}>
              <div className="ui-vitals-glyph-meter-row">
                <span className="ui-vitals-glyph-meter-label">ST</span>
                <span className={`ui-vitals-glyph-meter-value ${ires.currentState === 'exhausted' ? 'ui-vitals-glyph-meter-value-danger' : ires.currentState === 'rested' ? 'ui-vitals-glyph-meter-value-neutral' : 'ui-vitals-glyph-meter-value-ex'}`}>{stateLabel}</span>
              </div>
              <div className="ui-vitals-glyph-meter-track">
                <div className="ui-vitals-glyph-meter-fill ui-vitals-glyph-meter-fill-ex" style={{ width: `${sparkPct}%` }} />
                {projectedSparkPct !== undefined ? (
                  <div
                    className="ui-vitals-glyph-meter-projection"
                    style={{ left: `calc(${projectedSparkPct}% - 1px)` }}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="ui-vitals-glyph-meter ui-vitals-glyph-meter-mp">
            <div className="ui-vitals-glyph-meter-label">MP</div>
            <div className="ui-vitals-glyph-meter-value ui-vitals-glyph-meter-value-mp">
              {formatCompactValue(ires.mana, ires.maxMana)}
            </div>
            <div className="ui-vitals-glyph-meter-track">
              <div className="ui-vitals-glyph-meter-fill ui-vitals-glyph-meter-fill-mp" style={{ width: `${manaPct}%` }} />
              {projectedManaPct !== undefined ? (
                <div
                  className="ui-vitals-glyph-meter-projection"
                  style={{ left: `calc(${projectedManaPct}% - 1px)` }}
                />
              ) : null}
            </div>
          </div>
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
