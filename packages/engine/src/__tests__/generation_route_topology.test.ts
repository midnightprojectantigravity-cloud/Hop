import { describe, expect, it } from 'vitest';
import { compileStandaloneFloor, createGenerationState } from '../generation';

describe('generated route topology', () => {
    it('builds multi-route pressure floors with bounded straight runs and visible pressure beats', () => {
        const result = compileStandaloneFloor(2, 'route-topology-pressure:2', {
            generationState: createGenerationState('route-topology-pressure')
        });
        const summary = result.generationState.currentFloorSummary?.pathSummary;
        const sharedObstacleClusters = result.artifact.pathNetwork.environmentalPressureClusters.filter(cluster =>
            cluster.kind === 'obstacle' && cluster.routeMembership === 'shared'
        );
        const alternateTrapClusters = result.artifact.pathNetwork.environmentalPressureClusters.filter(cluster =>
            cluster.kind === 'trap' && cluster.routeMembership === 'alternate'
        );

        expect(result.verificationReport.code).toBe('OK');
        expect(result.generationState.currentFloorSummary?.role).toBe('pressure_spike');
        expect(summary?.routeCount).toBeGreaterThanOrEqual(2);
        expect(summary?.junctionCount).toBeGreaterThanOrEqual(2);
        expect(summary?.maxStraightRun).toBeLessThanOrEqual(4);
        expect(summary?.obstacleClusterCount).toBeGreaterThan(0);
        expect(summary?.trapClusterCount).toBeGreaterThan(0);
        expect(sharedObstacleClusters.length).toBeGreaterThan(0);
        expect(alternateTrapClusters.length).toBeGreaterThan(0);
    });

    it('keeps recovery floors biased toward an alternate risky lane', () => {
        const result = compileStandaloneFloor(3, 'route-topology-recovery:3', {
            generationState: createGenerationState('route-topology-recovery')
        });
        const pathNetwork = result.artifact.pathNetwork;
        const alternateTrapClusters = pathNetwork.environmentalPressureClusters.filter(cluster =>
            cluster.kind === 'trap' && cluster.routeMembership === 'alternate'
        );
        const primaryPressureClusters = pathNetwork.environmentalPressureClusters.filter(cluster =>
            (cluster.kind === 'trap' || cluster.kind === 'obstacle') && cluster.routeMembership === 'primary'
        );

        expect(result.verificationReport.code).toBe('OK');
        expect(result.generationState.currentFloorSummary?.role).toBe('recovery');
        expect(result.generationState.currentFloorSummary?.pathSummary.routeCount).toBeGreaterThanOrEqual(2);
        expect(alternateTrapClusters.length).toBeGreaterThan(0);
        expect(primaryPressureClusters.length).toBe(0);
    });

    it('keeps boss floors on a single readable approach', () => {
        const result = compileStandaloneFloor(10, 'route-topology-boss:10', {
            generationState: createGenerationState('route-topology-boss')
        });
        const summary = result.generationState.currentFloorSummary?.pathSummary;

        expect(result.verificationReport.code).toBe('OK');
        expect(summary?.routeCount).toBe(1);
        expect(summary?.trapClusterCount).toBe(0);
    });
});
