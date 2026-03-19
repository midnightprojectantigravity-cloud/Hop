import React, { useMemo, useSyncExternalStore } from 'react';
import type { TimelineEvent, SimulationEvent } from '@hop/engine';
import type { VisualAssetManifest, VisualAssetEntry } from '../visual/asset-manifest';
import { JuiceEffectsLayer } from './juice/JuiceEffectsLayer';
import type { JuiceActorSnapshot } from './juice/juice-types';
import { useJuiceManagerEffects } from './juice/use-juice-manager-effects';
import type { BoardEventDigest } from './game-board/board-event-digest';

interface JuiceManagerProps {
    visualEvents: { type: string; payload: any }[];
    timelineEvents?: TimelineEvent[];
    simulationEvents?: SimulationEvent[];
    boardEventDigest?: BoardEventDigest;
    actorSnapshots?: JuiceActorSnapshot[];
    playerActorId: string;
    playerDefeated: boolean;
    onBusyStateChange?: (busy: boolean) => void;
    assetManifest?: VisualAssetManifest | null;
}

export const JuiceManager: React.FC<JuiceManagerProps> = ({
    visualEvents,
    timelineEvents = [],
    simulationEvents = [],
    boardEventDigest,
    actorSnapshots = [],
    playerActorId,
    playerDefeated,
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
    const effectsStore = useJuiceManagerEffects({
        visualEvents,
        timelineEvents,
        simulationEvents,
        boardEventDigest,
        actorSnapshots,
        playerActorId,
        playerDefeated,
        onBusyStateChange
    });
    const { effects, nowMs } = useSyncExternalStore(
        effectsStore.subscribe,
        effectsStore.getSnapshot,
        effectsStore.getSnapshot
    );

    return <JuiceEffectsLayer effects={effects} nowMs={nowMs} assetById={assetById} />;
}
