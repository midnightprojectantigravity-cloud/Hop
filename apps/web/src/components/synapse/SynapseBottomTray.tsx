import React from 'react';
import { pointToKey, type GameState, type Point, type SynapseThreatPreview } from '@hop/engine';
import { getUiActorInformation, type UiInformationRevealMode } from '../../app/information-reveal';
import type { SynapseDeltaEntry, SynapseSelection } from '../../app/synapse';

interface SynapseBottomTrayProps {
    gameState: GameState;
    synapsePreview: SynapseThreatPreview | null;
    synapseSelection: SynapseSelection;
    intelMode: UiInformationRevealMode;
    deltasByActorId: Record<string, SynapseDeltaEntry>;
    onSelectSource: (actorId: string) => void;
    onClearSelection: () => void;
}

const round1 = (value: number): string => Number(value.toFixed(1)).toString();

const formatSigned = (value: number): string => `${value >= 0 ? '+' : ''}${round1(value)}`;

const resolveActorById = (state: GameState, actorId: string) => {
    if (state.player.id === actorId) return state.player;
    return state.enemies.find(enemy => enemy.id === actorId) || state.companions?.find(companion => companion.id === actorId);
};

const DeltaBadge: React.FC<{ value: number; label: string }> = ({ value, label }) => {
    if (Math.abs(value) < 0.05) {
        return (
            <span className="text-[10px] font-bold uppercase tracking-wide text-white/35">
                {label} +0.0
            </span>
        );
    }
    const isUp = value > 0;
    const tone = isUp ? 'text-emerald-300' : 'text-rose-300';
    const arrow = isUp ? '^' : 'v';
    return (
        <span className={`text-[10px] font-bold uppercase tracking-wide ${tone}`}>
            {label} {arrow} {formatSigned(value)}
        </span>
    );
};

const EmptyTray: React.FC = () => (
    <div className="text-xs text-white/60 font-semibold tracking-wide">
        Select a tile or enemy for details.
    </div>
);

const TileModeTray: React.FC<{
    gameState: GameState;
    tile: Point;
    preview: SynapseThreatPreview;
    intelMode: UiInformationRevealMode;
    onSelectSource: (actorId: string) => void;
}> = ({ gameState, tile, preview, intelMode, onSelectSource }) => {
    const tileEntry = preview.tiles.find(entry => pointToKey(entry.tile) === pointToKey(tile));
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
        <div className="flex flex-col gap-2.5 min-w-[260px]">
            <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Tile Intel</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-white/55">
                    {tile.q},{tile.r}
                </div>
            </div>
            <div className="flex items-center justify-between text-xs">
                <span className="text-white/70">Heat</span>
                <span className="font-black text-white">{round1(tileEntry?.heat || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
                <span className="text-white/70">Threat Sources</span>
                <span className="font-black text-white">{sources.length}</span>
            </div>
            <div className="max-h-28 overflow-y-auto pr-1 space-y-1">
                {sources.length === 0 && (
                    <div className="text-[11px] text-white/45">No elevated hostile sources on this tile.</div>
                )}
                {sources.map(({ source, actor, info }) => {
                    const name = info?.reveal.name ? (info.data.name || actor.subtype || actor.id) : `Enemy ${actor.id}`;
                    return (
                        <button
                            key={`source-${actor.id}`}
                            onClick={() => onSelectSource(actor.id)}
                            className="w-full px-2.5 py-1.5 rounded-md border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] transition-colors text-left"
                        >
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-white/85 truncate">{name}</span>
                                <span className="font-black text-amber-200">z {round1(source.zScore)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] mt-0.5 text-white/55">
                                <span>UPS {round1(source.ups)}</span>
                                <span>{source.sigmaTier.toUpperCase()}</span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const EntityModeTray: React.FC<{
    gameState: GameState;
    actorId: string;
    preview: SynapseThreatPreview | null;
    intelMode: UiInformationRevealMode;
    deltasByActorId: Record<string, SynapseDeltaEntry>;
}> = ({ gameState, actorId, preview, intelMode, deltasByActorId }) => {
    const actor = resolveActorById(gameState, actorId);
    if (!actor) {
        return <EmptyTray />;
    }
    const info = getUiActorInformation(gameState, gameState.player.id, actor.id, intelMode);
    const score = preview?.unitScores.find(entry => entry.actorId === actor.id);
    const delta = deltasByActorId[actor.id] || { upsDelta: 0, stateDelta: 0 };

    return (
        <div className="flex flex-col gap-2.5 min-w-[260px]">
            <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Entity Intel</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-white/55">{actor.id}</div>
            </div>
            <div className="text-sm font-black text-white">
                {info.reveal.name ? (info.data.name || actor.subtype || actor.id) : `Unknown ${actor.type}`}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
                    <div className="text-white/55 text-[10px] uppercase font-bold">UPS</div>
                    <div className="font-black text-white">{round1(score?.ups || 0)}</div>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
                    <div className="text-white/55 text-[10px] uppercase font-bold">Sigma</div>
                    <div className="font-black text-amber-200">{round1(score?.zScore || 0)}</div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <DeltaBadge value={delta.upsDelta} label="UPS D" />
                <DeltaBadge value={delta.stateDelta} label="State D" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
                    <div className="text-white/55 text-[10px] uppercase font-bold">HP</div>
                    <div className="font-black text-white">
                        {info.reveal.hp ? `${actor.hp}/${actor.maxHp}` : '?/?'}
                    </div>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
                    <div className="text-white/55 text-[10px] uppercase font-bold">Intent</div>
                    <div className="font-black text-white">
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
}) => {
    return (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,34rem)] pointer-events-auto">
            <div className="rounded-xl border border-cyan-300/30 bg-[#041120]/90 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.45)] p-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        {synapseSelection.mode === 'empty' && <EmptyTray />}
                        {synapseSelection.mode === 'tile' && synapsePreview && (
                            <TileModeTray
                                gameState={gameState}
                                tile={synapseSelection.tile}
                                preview={synapsePreview}
                                intelMode={intelMode}
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
                        className="shrink-0 px-2 py-1 rounded border border-white/15 bg-white/[0.03] text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white/[0.08]"
                    >
                        Clear
                    </button>
                </div>
            </div>
        </div>
    );
};
