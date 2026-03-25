export type UiMetricName =
  | 'boot_shell_ready_ms'
  | 'boot_asset_manifest_ready_ms'
  | 'hub_select_to_start_ms'
  | 'defeat_to_restart_ms'
  | 'first_action_ms'
  | 'boot_ready_ms'
  | 'worldgen_init_ms'
  | 'worldgen_first_compile_ms'
  | 'worldgen_runtime_error'
  | 'splash_delayed_ready_pulse_shown'
  | 'run_lost_overlay_to_action_ms'
  | 'sensory_preemption_count'
  | 'sensory_low_priority_dropped_count'
  | 'sensory_audio_failure_count';

export interface UiMetricEnvelope {
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
