import type { RunTelemetryCounters } from '../../generation/schema';

export const applyIresTelemetryDelta = (
    telemetry: RunTelemetryCounters,
    delta: Partial<RunTelemetryCounters>
): RunTelemetryCounters => ({
    damageTaken: Math.max(0, Number(telemetry.damageTaken || 0) + Number(delta.damageTaken || 0)),
    healingReceived: Math.max(0, Number(telemetry.healingReceived || 0) + Number(delta.healingReceived || 0)),
    forcedDisplacementsTaken: Math.max(0, Number(telemetry.forcedDisplacementsTaken || 0) + Number(delta.forcedDisplacementsTaken || 0)),
    controlIncidents: Math.max(0, Number(telemetry.controlIncidents || 0) + Number(delta.controlIncidents || 0)),
    hazardDamageEvents: Math.max(0, Number(telemetry.hazardDamageEvents || 0) + Number(delta.hazardDamageEvents || 0)),
    sparkSpent: Math.max(0, Number(telemetry.sparkSpent || 0) + Number(delta.sparkSpent || 0)),
    sparkRecovered: Math.max(0, Number(telemetry.sparkRecovered || 0) + Number(delta.sparkRecovered || 0)),
    manaSpent: Math.max(0, Number(telemetry.manaSpent || 0) + Number(delta.manaSpent || 0)),
    manaRecovered: Math.max(0, Number(telemetry.manaRecovered || 0) + Number(delta.manaRecovered || 0)),
    exhaustionGained: Math.max(0, Number(telemetry.exhaustionGained || 0) + Number(delta.exhaustionGained || 0)),
    exhaustionCleared: Math.max(0, Number(telemetry.exhaustionCleared || 0) + Number(delta.exhaustionCleared || 0)),
    sparkBurnHpLost: Math.max(0, Number(telemetry.sparkBurnHpLost || 0) + Number(delta.sparkBurnHpLost || 0)),
    redlineActions: Math.max(0, Number(telemetry.redlineActions || 0) + Number(delta.redlineActions || 0)),
    exhaustedTurns: Math.max(0, Number(telemetry.exhaustedTurns || 0) + Number(delta.exhaustedTurns || 0)),
    sparkOutageBlocks: Math.max(0, Number(telemetry.sparkOutageBlocks || 0) + Number(delta.sparkOutageBlocks || 0)),
    manaOutageBlocks: Math.max(0, Number(telemetry.manaOutageBlocks || 0) + Number(delta.manaOutageBlocks || 0)),
    restTurns: Math.max(0, Number(telemetry.restTurns || 0) + Number(delta.restTurns || 0)),
    actionsTaken: Math.max(0, Number(telemetry.actionsTaken || 0) + Number(delta.actionsTaken || 0))
});
