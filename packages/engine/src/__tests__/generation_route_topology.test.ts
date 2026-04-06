import { describe, expect, it } from 'vitest';
import { compileStandaloneFloor, createGenerationState, hexDistanceInt } from '../generation';

describe('generated route topology', () => {
    it('builds multi-route pressure floors with bounded straight runs and visible pressure beats', () => {
        const result = compileStandaloneFloor(2, 'route-topology-pressure:2', {
            generationState: createGenerationState('route-topology-pressure')
        });
        const summary = result.generationState.currentFloorSummary?.pathSummary;
        const sharedObstacleClusters = result.artifact.pathNetwork.environmentalPressureClusters.filter(cluster =>
            cluster.kind === 'obstacle' && cluster.routeMembership === 'shared'
        );
        const hazardClusters = result.artifact.pathNetwork.environmentalPressureClusters.filter(cluster =>
            cluster.kind === 'trap' || cluster.kind === 'lava'
        );
        const lavaClusters = result.artifact.pathNetwork.environmentalPressureClusters.filter(cluster => cluster.kind === 'lava');

        expect(result.verificationReport.code).toBe('OK');
        expect(result.generationState.currentFloorSummary?.role).toBe('pressure_spike');
        expect(summary?.routeCount).toBeGreaterThanOrEqual(2);
        expect(summary?.junctionCount).toBeGreaterThanOrEqual(2);
        expect(summary?.maxStraightRun).toBeLessThanOrEqual(4);
        expect(summary?.obstacleClusterCount).toBeGreaterThan(0);
        expect((summary?.trapClusterCount || 0) + (summary?.lavaClusterCount || 0)).toBeGreaterThan(0);
        expect(sharedObstacleClusters.length).toBeGreaterThan(0);
        expect(hazardClusters.length).toBeGreaterThan(0);
        expect(lavaClusters.length).toBeGreaterThan(0);
    });

    it('keeps recovery floors biased toward an alternate risky lane', () => {
        const result = compileStandaloneFloor(3, 'route-topology-recovery:3', {
            generationState: createGenerationState('route-topology-recovery')
        });
        const pathNetwork = result.artifact.pathNetwork;
        const alternatePressureClusters = pathNetwork.environmentalPressureClusters.filter(cluster =>
            (cluster.kind === 'trap' || cluster.kind === 'lava' || cluster.kind === 'obstacle') && cluster.routeMembership === 'alternate'
        );
        const primaryPressureClusters = pathNetwork.environmentalPressureClusters.filter(cluster =>
            (cluster.kind === 'trap' || cluster.kind === 'lava' || cluster.kind === 'obstacle') && cluster.routeMembership === 'primary'
        );

        expect(result.verificationReport.code).toBe('OK');
        expect(result.generationState.currentFloorSummary?.role).toBe('recovery');
        expect(result.generationState.currentFloorSummary?.pathSummary.routeCount).toBeGreaterThanOrEqual(2);
        expect(alternatePressureClusters.length).toBeGreaterThan(0);
        expect(primaryPressureClusters.length).toBe(0);
    });

    it('keeps boss floors on a single readable approach', () => {
        const result = compileStandaloneFloor(10, 'route-topology-boss:10', {
            generationState: createGenerationState('route-topology-boss')
        });
        const summary = result.generationState.currentFloorSummary?.pathSummary;
        const arenaCenter = result.dungeon.rooms[0]?.center || { q: 3, r: 5, s: -8 };
        const centralBlockers = Array.from(result.dungeon.tiles.values()).filter(tile =>
            tile.baseId === 'WALL'
            && hexDistanceInt(tile.position, arenaCenter) <= 3
        );

        expect(result.verificationReport.code).toBe('OK');
        expect(result.artifact.enemySpawns).toHaveLength(1);
        expect(result.artifact.enemySpawns[0]?.subtype).toBe('butcher');
        expect(result.artifact.enemySpawns[0]?.position).toEqual({ q: 5, r: 2, s: -7 });
        expect(summary?.routeCount).toBe(1);
        expect(summary?.trapClusterCount).toBe(0);
        expect(summary?.maxStraightRun).toBeLessThanOrEqual(4);
        expect(centralBlockers.length).toBeGreaterThanOrEqual(13);
        expect(centralBlockers.some(tile => hexDistanceInt(tile.position, arenaCenter) === 3)).toBe(true);
    });
});
