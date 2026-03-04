export type UiMetricName =
  | 'hub_select_to_start_ms'
  | 'defeat_to_restart_ms'
  | 'first_action_ms';

interface UiMetricEnvelope {
  metric: UiMetricName;
  value: number;
  at: string;
  details?: Record<string, unknown>;
}

export const emitUiMetric = (
  metric: UiMetricName,
  value: number,
  details?: Record<string, unknown>
): void => {
  if (typeof window === 'undefined' || !Number.isFinite(value) || value < 0) return;

  const payload: UiMetricEnvelope = {
    metric,
    value: Math.round(value),
    at: new Date().toISOString(),
    details
  };

  window.dispatchEvent(new CustomEvent<UiMetricEnvelope>('hop-ui-metric', { detail: payload }));
};
