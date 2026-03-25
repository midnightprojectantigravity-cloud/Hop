import React from 'react';

const toPct = (value: number, max: number): number =>
  Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

interface UiMobileTopHudProps {
  floor: number;
  floorCap?: number;
  hp: number;
  maxHp: number;
  spark: number;
  maxSpark: number;
  mana: number;
  maxMana: number;
  exhaustion: number;
  compactHeightPx: number;
  labelFontPx: number;
  valueFontPx: number;
  infoActive: boolean;
  trayOpen: boolean;
  waitLabel: string;
  isInputLocked: boolean;
  sigmaValue: number;
  turnFlowLabel: string;
  turnFlowMode: 'protected_single' | 'manual_chain';
  enemyAlerted: boolean;
  hpProjectionDelta: number;
  projectedHp: number;
  overdriveArmed: boolean;
  overdriveButtonLabel: string;
  onToggleInfo: () => void;
  onToggleTray: () => void;
  onToggleOverdrive: () => void;
  trayActionButtonStyle?: React.CSSProperties;
}

export const UiMobileTopHud: React.FC<UiMobileTopHudProps> = ({
  floor,
  floorCap = 10,
  hp,
  maxHp,
  spark,
  maxSpark,
  mana,
  maxMana,
  exhaustion,
  compactHeightPx,
  labelFontPx,
  valueFontPx,
  infoActive,
  trayOpen,
  waitLabel,
  isInputLocked,
  sigmaValue,
  turnFlowLabel,
  turnFlowMode,
  enemyAlerted,
  hpProjectionDelta,
  projectedHp,
  overdriveArmed,
  overdriveButtonLabel,
  onToggleInfo,
  onToggleTray,
  onToggleOverdrive,
  trayActionButtonStyle
}) => {
  const hpPct = toPct(hp, maxHp);
  const sparkPct = toPct(spark, maxSpark);
  const manaPct = toPct(mana, maxMana);
  void exhaustion;
  const sigmaDanger = Math.abs(sigmaValue) >= 2;
  const valueFont = clamp(Math.round(valueFontPx * 0.72), 10, 18);
  const labelFont = clamp(Math.round(labelFontPx), 8, 12);
  const controlFont = clamp(Math.round(labelFontPx * 0.95), 8, 11);
  const controlHeight = clamp(Math.round(compactHeightPx * 0.34), 18, 24);
  const sparkSize = clamp(Math.round(compactHeightPx * 0.46), 34, 37);
  const compactStyle = {
    '--mobile-top-hud-fixed-height': `${compactHeightPx}px`,
    '--mobile-top-hud-label-font': `${labelFont}px`,
    '--mobile-top-hud-value-font': `${valueFont}px`,
    '--mobile-top-hud-control-font': `${controlFont}px`,
    '--mobile-top-hud-control-height': `${controlHeight}px`,
    '--mobile-top-hud-spark-size': `${sparkSize}px`
  } as React.CSSProperties;

  return (
    <div className="ui-mobile-top-hud relative" data-mobile-top-hud>
      <div
        className="ui-mobile-top-hud-compact"
        data-mobile-top-hud-compact
        data-mobile-top-hud-fixed-height={compactHeightPx}
        style={{ ...compactStyle, height: `${compactHeightPx}px` }}
      >
        <div className="ui-mobile-top-hud-floor">
          <div className="ui-mobile-top-hud-floor-label">Floor</div>
          <div className="ui-mobile-top-hud-floor-value">
            <span>{floor}</span>
            <span className="ui-mobile-top-hud-floor-cap">/ {floorCap}</span>
          </div>
        </div>

        <div className="ui-mobile-top-hud-vitals" data-mobile-top-hud-vitals>
          <div className="ui-mobile-top-hud-vitals-row ui-mobile-top-hud-vitals-row-primary">
            <div className="ui-mobile-top-hud-vitals-core" data-mobile-top-hud-vitals-core>
              <div
                className="ui-mobile-top-hud-meter ui-mobile-top-hud-meter-hp"
                aria-label={`HP ${hp}/${maxHp}`}
                data-mobile-top-hud-hp
              >
                <div className="ui-mobile-top-hud-meter-track">
                  <div className="ui-mobile-top-hud-meter-fill" style={{ width: `${hpPct}%` }} />
                  <span
                    className="ui-mobile-top-hud-meter-value ui-mobile-top-hud-meter-value-hp"
                    data-mobile-top-hud-hp-value
                  >
                    {Math.round(hp)}/{Math.round(maxHp)}
                  </span>
                </div>
              </div>

              <div
                className="ui-mobile-top-hud-meter ui-mobile-top-hud-meter-mp"
                aria-label={`MP ${Math.round(mana)}/${Math.round(maxMana)}`}
                data-mobile-top-hud-mp
              >
                <div className="ui-mobile-top-hud-meter-track">
                  <div className="ui-mobile-top-hud-meter-fill" style={{ width: `${manaPct}%` }} />
                  <span
                    className="ui-mobile-top-hud-meter-value ui-mobile-top-hud-meter-value-mp"
                    data-mobile-top-hud-mp-value
                  >
                    {Math.round(mana)}/{Math.round(maxMana)}
                  </span>
                </div>
              </div>

              <div
                className="ui-mobile-top-hud-spark"
                aria-label={`Spark ${Math.round(spark)}/${Math.round(maxSpark)}`}
                data-mobile-top-hud-spark-bubble
              >
                <div className="ui-mobile-top-hud-spark-fill" style={{ height: `${sparkPct}%` }} />
              </div>
            </div>
          </div>

          <div
            className="ui-mobile-top-hud-vitals-row ui-mobile-top-hud-vitals-row-exhaustion"
            aria-label={`Spark reserve ${Math.round(spark)}/${Math.round(maxSpark)}`}
            data-mobile-top-hud-exhaustion
          >
            <div className="ui-mobile-top-hud-exhaustion-track">
              <div className="ui-mobile-top-hud-exhaustion-fill" style={{ width: `${sparkPct}%` }} />
              {Array.from({ length: 5 }, (_unused, index) => (
                <span
                  key={`mobile-top-hud-exhaustion-${index}`}
                  className="ui-mobile-top-hud-exhaustion-segment"
                  data-mobile-top-hud-exhaustion-segment
                />
              ))}
            </div>
          </div>
        </div>

        <div className="ui-mobile-top-hud-controls">
          <button
            type="button"
            className={`ui-mobile-top-hud-control ${infoActive ? 'ui-mobile-top-hud-control-active' : ''}`}
            data-mobile-top-hud-info-button
            aria-pressed={infoActive}
            aria-label={infoActive ? 'Close INFO tray' : 'Open INFO tray'}
            onClick={onToggleInfo}
          >
            INFO
          </button>
          <button
            type="button"
            className="ui-mobile-top-hud-control ui-mobile-top-hud-fold-toggle"
            data-mobile-top-hud-chevron
            data-mobile-top-hud-fold-toggle
            aria-expanded={trayOpen}
            aria-label={trayOpen ? 'Close top HUD tray' : 'Open top HUD tray'}
            onClick={onToggleTray}
          >
            <span className="ui-mobile-top-hud-chevron-glyph">{trayOpen ? '^' : 'v'}</span>
          </button>
        </div>
      </div>

      {trayOpen ? (
        <div className="ui-mobile-top-hud-tray" data-mobile-top-hud-tray>
          <div className="ui-mobile-top-hud-tray-grid">
            <div className="ui-mobile-top-hud-chip">
              {waitLabel}: {isInputLocked ? 'Resolving' : 'Ready'}
            </div>
            <div className={`ui-mobile-top-hud-chip ${sigmaDanger ? 'ui-mobile-top-hud-chip-danger' : ''}`}>
              Sigma {sigmaValue >= 0 ? '+' : ''}{sigmaValue.toFixed(1)}
            </div>
            {hpProjectionDelta !== 0 ? (
              <div
                className={`ui-mobile-top-hud-chip ui-mobile-top-hud-chip-span ${
                  hpProjectionDelta < 0 ? 'ui-mobile-top-hud-chip-danger' : 'ui-mobile-top-hud-chip-positive'
                }`}
              >
                HP {hpProjectionDelta > 0 ? '+' : ''}{hpProjectionDelta}{' -> '}{projectedHp}
              </div>
            ) : null}
          </div>

          <div className="ui-mobile-top-hud-chip-row">
            <span className="ui-mobile-top-hud-chip">{turnFlowLabel}</span>
            {turnFlowMode === 'protected_single' ? (
              <span className="ui-mobile-top-hud-chip">Auto-End: 1</span>
            ) : null}
            <span
              className={`ui-mobile-top-hud-chip ${
                enemyAlerted ? 'ui-mobile-top-hud-chip-danger' : ''
              }`}
            >
              Enemy Alert: {enemyAlerted ? 'On' : 'Off'}
            </span>
          </div>

          {turnFlowMode === 'protected_single' ? (
            <button
              type="button"
              onClick={onToggleOverdrive}
              style={trayActionButtonStyle}
              className={`ui-mobile-top-hud-overdrive ${
                overdriveArmed
                  ? 'bg-emerald-950/60 border-emerald-400/50 text-emerald-100'
                  : 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)] text-[var(--text-primary)]'
              }`}
            >
              {overdriveButtonLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default UiMobileTopHud;
