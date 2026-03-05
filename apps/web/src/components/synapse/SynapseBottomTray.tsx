import React from 'react';
import { pointToKey, type Actor, type GameState, type Point, type SynapseThreatPreview } from '@hop/engine';
import { getUiActorInformation, type UiInformationRevealMode } from '../../app/information-reveal';
import { DELTA_VISUAL_THRESHOLD, type SynapseDeltaEntry, type SynapseSelection } from '../../app/synapse';

interface SynapseBottomTrayProps {
    gameState: GameState;
    synapsePreview: SynapseThreatPreview | null;
    synapseSelection: SynapseSelection;
    intelMode: UiInformationRevealMode;
    deltasByActorId: Record<string, SynapseDeltaEntry>;
    onSelectSource: (actorId: string) => void;
    onClearSelection: () => void;
    docked?: boolean;
}

const round1 = (value: number): string => Number(value.toFixed(1)).toString();
const formatUPS = (value: number): string => Math.round(value).toString();
const formatSignedUpsDelta = (value: number): string => `${value >= 0 ? '+' : ''}${Math.round(value).toString()}`;
const formatSignedStateDelta = (value: number): string => `${value >= 0 ? '+' : ''}${round1(value)}`;

const resolveActorById = (state: GameState, actorId: string) => {
    if (state.player.id === actorId) return state.player;
    return state.enemies.find(enemy => enemy.id === actorId) || state.companions?.find(companion => companion.id === actorId);
};

const resolveActorAtTile = (state: GameState, tile: Point): Actor | null => {
    const tileKey = pointToKey(tile);
    if (pointToKey(state.player.position) === tileKey) return state.player;
    const enemy = state.enemies.find(candidate => candidate.hp > 0 && pointToKey(candidate.position) === tileKey);
    if (enemy) return enemy;
    const companion = (state.companions || []).find(candidate => candidate.hp > 0 && pointToKey(candidate.position) === tileKey);
    return companion || null;
};

const DeltaBadge: React.FC<{ value: number; label: string; threshold?: number; formatter?: (value: number) => string }> = ({
    value,
    label,
    threshold = 0.05,
    formatter = formatSignedStateDelta
}) => {
    if (Math.abs(value) < threshold) {
        return (
            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                {label} +0
            </span>
        );
    }
    const isUp = value > 0;
    const tone = isUp ? 'text-emerald-300' : 'text-rose-300';
    const arrow = isUp ? '^' : 'v';
    return (
        <span className={`text-[10px] font-bold uppercase tracking-wide ${tone}`}>
            {label} {arrow} {formatter(value)}
        </span>
    );
};

const EmptyTray: React.FC = () => (
    <div className="text-xs text-[var(--text-secondary)] font-semibold tracking-wide">
        Select a tile or enemy for details.
    </div>
);

const TileModeTray: React.FC<{
    gameState: GameState;
    tile: Point;
    preview: SynapseThreatPreview;
    intelMode: UiInformationRevealMode;
    deltasByActorId: Record<string, SynapseDeltaEntry>;
    onSelectSource: (actorId: string) => void;
}> = ({ gameState, tile, preview, intelMode, deltasByActorId, onSelectSource }) => {
    const tileEntry = preview.tiles.find(entry => pointToKey(entry.tile) === pointToKey(tile));
    const occupiedActor = resolveActorAtTile(gameState, tile);
    const sources = (tileEntry?.sourceActorIds || [])
        .map(actorId => {
            const source = preview.sources.find(item => item.actorId === actorId);
            const actor = resolveActorById(gameState, actorId);
            const info = actor ? getUiActorInformation(gameState, gameState.player.id, actor.id, intelMode) : null;
            return source && actor ? { source, actor, info } : null;
        })
        .filter((row): row is NonNullable<typeof row> => !!row)
        .sort((a, b) => b.source.zScore - a.source.zScore);

    return (
        <div className="flex flex-col gap-2.5 min-w-0">
            <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Tile Intel</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                    {tile.q},{tile.r}
                </div>
            </div>
            <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">Heat</span>
                <span className="font-black text-[var(--text-primary)]">{round1(tileEntry?.heat || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">Threat Sources</span>
                <span className="font-black text-[var(--text-primary)]">{sources.length}</span>
            </div>
            <div className="max-h-28 overflow-y-auto pr-1 space-y-1">
                {sources.length === 0 && (
                    <div className="text-[11px] text-[var(--text-muted)]">No elevated hostile sources on this tile.</div>
                )}
                {sources.map(({ source, actor, info }) => {
                    const name = info?.reveal.name ? (info.data.name || actor.subtype || actor.id) : `Enemy ${actor.id}`;
                    return (
                        <button
                            key={`source-${actor.id}`}
                            onClick={() => onSelectSource(actor.id)}
                            className="w-full px-2.5 py-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] hover:bg-[var(--surface-panel-hover)] transition-colors text-left"
                        >
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-[var(--text-primary)] truncate">{name}</span>
                                <span className="font-black text-amber-200">z {round1(source.zScore)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] mt-0.5 text-[var(--text-secondary)]">
                                <span>UPS {formatUPS(source.ups)}</span>
                                <span>{source.sigmaTier.toUpperCase()}</span>
                            </div>
                        </button>
                    );
                })}
            </div>
            {occupiedActor && (
                <div className="mt-1 border-t border-[var(--border-subtle)] pt-2">
                    <EntityModeTray
                        gameState={gameState}
                        actorId={occupiedActor.id}
                        preview={preview}
                        intelMode={intelMode}
                        deltasByActorId={deltasByActorId}
                        hideTileIntel
                    />
                </div>
            )}
        </div>
    );
};

const EntityModeTray: React.FC<{
    gameState: GameState;
    actorId: string;
    preview: SynapseThreatPreview | null;
    intelMode: UiInformationRevealMode;
    deltasByActorId: Record<string, SynapseDeltaEntry>;
    hideTileIntel?: boolean;
}> = ({ gameState, actorId, preview, intelMode, deltasByActorId, hideTileIntel = false }) => {
    const actor = resolveActorById(gameState, actorId);
    if (!actor) {
        return <EmptyTray />;
    }
    const info = getUiActorInformation(gameState, gameState.player.id, actor.id, intelMode);
    const score = preview?.unitScores.find(entry => entry.actorId === actor.id);
    const tileEntry = preview?.tiles.find(entry => pointToKey(entry.tile) === pointToKey(actor.position));
    const delta = deltasByActorId[actor.id] || { upsDelta: 0, stateDelta: 0 };

    return (
        <div className="flex flex-col gap-2.5 min-w-0">
            {!hideTileIntel && (
                <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[var(--text-secondary)]">
                        <span>Tile Intel</span>
                        <span>{actor.position.q},{actor.position.r}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--text-primary)]">
                        <span className="font-black">Heat {round1(tileEntry?.heat || 0)}</span>
                        <span className="font-bold text-[var(--text-secondary)]">Sources {tileEntry?.sourceActorIds.length || 0}</span>
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Entity Intel</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{actor.id}</div>
            </div>
            <div className="text-sm font-black text-[var(--text-primary)]">
                {info.reveal.name ? (info.data.name || actor.subtype || actor.id) : `Unknown ${actor.type}`}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
                    <div className="text-[var(--text-secondary)] text-[10px] uppercase font-bold">UPS</div>
                    <div className="font-black text-[var(--text-primary)]">{formatUPS(score?.ups || 0)}</div>
                </div>
                <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
                    <div className="text-[var(--text-secondary)] text-[10px] uppercase font-bold">Sigma</div>
                    <div className="font-black text-amber-200">{round1(score?.zScore || 0)}</div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <DeltaBadge value={delta.upsDelta} label="UPS D" threshold={DELTA_VISUAL_THRESHOLD} formatter={formatSignedUpsDelta} />
                <DeltaBadge value={delta.stateDelta} label="State D" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
                    <div className="text-[var(--text-secondary)] text-[10px] uppercase font-bold">HP</div>
                    <div className="font-black text-[var(--text-primary)]">
                        {info.reveal.hp ? `${actor.hp}/${actor.maxHp}` : '?/?'}
                    </div>
                </div>
                <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
                    <div className="text-[var(--text-secondary)] text-[10px] uppercase font-bold">Intent</div>
                    <div className="font-black text-[var(--text-primary)]">
                        {info.reveal.intentBadge ? (info.data.intentBadge || actor.intent || 'Unknown') : 'Unknown'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const SynapseBottomTray: React.FC<SynapseBottomTrayProps> = ({
    gameState,
    synapsePreview,
    synapseSelection,
    intelMode,
    deltasByActorId,
    onSelectSource,
    onClearSelection,
    docked = false,
}) => {
    const containerClass = docked
        ? 'relative w-full'
        : 'absolute bottom-3 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,34rem)] pointer-events-auto';

    return (
        <div className={containerClass}>
            <div className="rounded-xl border border-[var(--synapse-border)] bg-[color:var(--synapse-surface)] backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)] p-3 transition-transform duration-150 ease-out">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        {synapseSelection.mode === 'empty' && <EmptyTray />}
                        {synapseSelection.mode === 'tile' && synapsePreview && (
                            <TileModeTray
                                gameState={gameState}
                                tile={synapseSelection.tile}
                                preview={synapsePreview}
                                intelMode={intelMode}
                                deltasByActorId={deltasByActorId}
                                onSelectSource={onSelectSource}
                            />
                        )}
                        {synapseSelection.mode === 'entity' && (
                            <EntityModeTray
                                gameState={gameState}
                                actorId={synapseSelection.actorId}
                                preview={synapsePreview}
                                intelMode={intelMode}
                                deltasByActorId={deltasByActorId}
                            />
                        )}
                    </div>
                    <button
                        onClick={onClearSelection}
                        className="shrink-0 px-2 py-1 rounded border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:bg-[var(--surface-panel-hover)]"
                    >
                        Clear
                    </button>
                </div>
            </div>
        </div>
    );
};

