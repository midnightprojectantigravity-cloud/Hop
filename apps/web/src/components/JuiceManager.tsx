import React, { useMemo } from 'react';
import type { TimelineEvent, SimulationEvent } from '@hop/engine';
import type { VisualAssetManifest, VisualAssetEntry } from '../visual/asset-manifest';
import { JuiceEffectsLayer } from './juice/JuiceEffectsLayer';
import type { JuiceActorSnapshot } from './juice/juice-types';
import { useJuiceManagerEffects } from './juice/use-juice-manager-effects';

interface JuiceManagerProps {
    visualEvents: { type: string; payload: any }[];
    timelineEvents?: TimelineEvent[];
    simulationEvents?: SimulationEvent[];
    actorSnapshots?: JuiceActorSnapshot[];
    onBusyStateChange?: (busy: boolean) => void;
    assetManifest?: VisualAssetManifest | null;
}

export const JuiceManager: React.FC<JuiceManagerProps> = ({
    visualEvents,
    timelineEvents = [],
    simulationEvents = [],
    actorSnapshots = [],
    onBusyStateChange,
    assetManifest
}) => {
    const assetById = useMemo(() => {
        const map = new Map<string, VisualAssetEntry>();
        for (const asset of assetManifest?.assets || []) {
            map.set(asset.id, asset);
        }
        return map;
    }, [assetManifest]);
    const effects = useJuiceManagerEffects({
        visualEvents,
        timelineEvents,
        simulationEvents,
        actorSnapshots,
        onBusyStateChange
    });

    return <JuiceEffectsLayer effects={effects} assetById={assetById} />;
}
