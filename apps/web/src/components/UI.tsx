import React from 'react';
import type { GameState } from '@hop/engine';
import { computeScore } from '@hop/engine';

interface UIProps {
    gameState: GameState;
    onReset: () => void;
    onWait: () => void;
    onExitToHub: () => void;
    inputLocked?: boolean;
}

// Use canonical engine score

import { InitiativeDisplay } from './InitiativeQueue';

export const UI: React.FC<UIProps> = ({ gameState, onReset, onWait, onExitToHub, inputLocked = false }) => {
    const score = computeScore(gameState);

    const messages = Array.isArray(gameState.message) ? gameState.message : [];
    const logRef = React.useRef<HTMLDivElement>(null);
    type LogLevel = 'all' | 'info' | 'verbose' | 'debug' | 'critical';
    type LogChannel = 'all' | 'combat' | 'hazard' | 'objective' | 'ai' | 'system';
    const [levelFilter, setLevelFilter] = React.useState<LogLevel>('all');
    const [channelFilter, setChannelFilter] = React.useState<LogChannel>('all');

    type ClassifiedLog = {
        idx: number;
        raw: string;
        text: string;
        level: Exclude<LogLevel, 'all'>;
        channel: Exclude<LogChannel, 'all'>;
    };

    const classifyMessage = (raw: string, idx: number): ClassifiedLog => {
        const msg = raw || '';
        const lower = msg.toLowerCase();
        const tagged = msg.match(/^\[(INFO|VERBOSE|DEBUG|CRITICAL)\|([A-Z_]+)\]\s*(.*)$/i);
        if (tagged) {
            const level = tagged[1]!.toLowerCase() as ClassifiedLog['level'];
            const channelRaw = tagged[2]!.toLowerCase();
            const text = tagged[3] || '';
            const channel: ClassifiedLog['channel'] =
                channelRaw.includes('combat') ? 'combat'
                    : channelRaw.includes('hazard') ? 'hazard'
                        : channelRaw.includes('objective') || channelRaw.includes('score') ? 'objective'
                            : channelRaw.includes('ai') ? 'ai'
                                : 'system';
            return { idx, raw, text, level, channel };
        }

        const channel: ClassifiedLog['channel'] =
            /(attacked|killed|blast|stunned|damage|hit|healed|shield|bash|spear|fireball|jump|dash)/i.test(lower) ? 'combat'
                : /(lava|burn|hazard|void|sink|fire damage)/i.test(lower) ? 'hazard'
                    : /(score|objective|floor|stairs|descending|arcade cleared)/i.test(lower) ? 'objective'
                        : /(enemy|falcon|intent|telegraph|moves to|repositioning|attacks)/i.test(lower) ? 'ai'
                            : 'system';

        const level: ClassifiedLog['level'] =
            /(fallen|warning|error|failed|invalid|blocked|cannot)/i.test(lower) ? 'critical'
                : /(debug|trace|telemetry|seed|counter|rng)/i.test(lower) ? 'debug'
                    : /(marks the impact zone|telegraph|planning|intent)/i.test(lower) ? 'verbose'
                        : 'info';

        return { idx, raw, text: msg, level, channel };
    };

    const classifiedLogs = React.useMemo(() => messages.map((m, i) => classifyMessage(m, i)), [messages]);
    const filteredLogs = React.useMemo(() => {
        return classifiedLogs.filter(l =>
            (levelFilter === 'all' || l.level === levelFilter) &&
            (channelFilter === 'all' || l.channel === channelFilter)
        );
    }, [classifiedLogs, levelFilter, channelFilter]);

    // Auto-scroll to bottom of log
    React.useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [filteredLogs]);

    return (
        <div className="flex flex-col h-full max-h-screen">
            <div className="flex flex-col gap-8 p-8 overflow-y-auto flex-1 min-h-0">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-widest text-white/90 mb-1">Hoplite</h1>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Tactical Arena</p>
                    </div>
                    <div className="px-2 py-1 bg-white/10 rounded border border-white/20 text-[10px] font-black text-white/60">
                        V2.1.0
                    </div>
                </div>

                {/* Initiative Queue */}
                <InitiativeDisplay gameState={gameState} />

                {/* Health & Armor Section */}
                <div className="space-y-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Vitality</span>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-black text-red-500 leading-none">{gameState.player.hp}</span>
                            <span className="text-xl text-white/20 font-bold leading-none mb-1">/</span>
                            <span className="text-xl text-gray-500 font-bold leading-none mb-1">{gameState.player.maxHp}</span>
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Guardian Plating</span>
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-sm ${gameState.player.temporaryArmor ? 'bg-blue-400 rotate-45' : 'bg-white/5 border border-white/10'}`}></div>
                            <span className="text-2xl font-black text-blue-400 leading-none">{gameState.player.temporaryArmor || 0}</span>
                        </div>
                    </div>

                    {/* Boss Health Bar */}
                    {gameState.enemies.filter(e => e.subtype === 'sentinel').map(boss => (
                        <div key={boss.id} className="pt-4 animate-in slide-in-from-right-8 duration-500">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-xs font-black text-red-500 uppercase tracking-tighter italic">Sentinel Directive</span>
                                <span className="text-lg font-black">{boss.hp} <span className="text-white/20 text-xs">/ {boss.maxHp}</span></span>
                            </div>
                            <div className="h-4 w-full bg-red-950/30 rounded-md border border-red-500/20 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all duration-300"
                                    style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Stats Section */}
                <div className="py-8 border-y border-white/5 space-y-6">
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Arcade Progress</span>
                            <span className="text-xl font-black">{gameState.floor} <span className="text-white/20 text-sm">/ 10</span></span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <div
                                className="h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all duration-1000 ease-out"
                                style={{ width: `${(gameState.floor / 10) * 100}%` }}
                            />
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Current Score</span>
                        <span className="text-xl font-black text-white">{score.toLocaleString()}</span>
                    </div>
                </div>

                {/* Actions Section */}
                <div className="flex flex-col gap-3">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Directives</span>
                    <button
                        disabled={inputLocked}
                        onClick={onWait}
                        className={`w-full flex justify-between items-center px-4 py-3 border rounded-xl transition-all group ${inputLocked
                            ? 'bg-white/[0.03] border-white/5 text-white/30 cursor-not-allowed opacity-50'
                            : 'bg-white/5 hover:bg-white/10 border-white/10'
                            }`}
                    >
                        <span className="text-sm font-bold text-white/70">Secure & Wait</span>
                        <span className="text-lg grayscale group-hover:grayscale-0 transition-all">🛡️</span>
                    </button>
                    <button
                        onClick={onReset}
                        className="w-full flex justify-between items-center px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all group"
                    >
                        <span className="text-sm font-bold text-red-400/80">Reset Chronology</span>
                        <span className="text-lg grayscale group-hover:grayscale-0 transition-all">🔄</span>
                    </button>
                    <button
                        onClick={onExitToHub}
                        className="w-full flex justify-between items-center px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group"
                    >
                        <span className="text-sm font-bold text-white/70">Return to Hub</span>
                        <span className="text-lg grayscale group-hover:grayscale-0 transition-all">🏠</span>
                    </button>
                </div>
            </div>

            {/* Message Feed - Fixed at bottom */}
            {messages.length > 0 && (
                <div className="p-8 border-t border-white/5 bg-[#030712]/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold block">Tactical Log</span>
                        <div className="flex items-center gap-2">
                            <select
                                value={channelFilter}
                                onChange={(e) => setChannelFilter(e.target.value as LogChannel)}
                                className="text-[10px] bg-white/5 border border-white/10 rounded px-2 py-1 text-white/80"
                            >
                                <option value="all">All Channels</option>
                                <option value="combat">Combat</option>
                                <option value="hazard">Hazard</option>
                                <option value="objective">Objective</option>
                                <option value="ai">AI</option>
                                <option value="system">System</option>
                            </select>
                            <select
                                value={levelFilter}
                                onChange={(e) => setLevelFilter(e.target.value as LogLevel)}
                                className="text-[10px] bg-white/5 border border-white/10 rounded px-2 py-1 text-white/80"
                            >
                                <option value="all">All Levels</option>
                                <option value="info">Info</option>
                                <option value="verbose">Verbose</option>
                                <option value="debug">Debug</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                    </div>
                    <div
                        ref={logRef}
                        className="flex flex-col gap-2 bg-white/[0.02] border border-white/5 p-4 rounded-2xl overflow-y-auto max-h-[140px]"
                    >
                        {filteredLogs.slice(-20).map((entry) => (
                            <div key={entry.idx} className="flex gap-2 items-start">
                                <span className="text-[10px] text-white/20 font-bold mt-1 leading-none shrink-0">
                                    [{entry.idx}]
                                </span>
                                <span className={`text-[9px] mt-1 px-1.5 py-0.5 rounded border shrink-0 ${entry.level === 'critical'
                                        ? 'text-red-300 border-red-400/40 bg-red-500/10'
                                        : entry.level === 'debug'
                                            ? 'text-cyan-300 border-cyan-400/40 bg-cyan-500/10'
                                            : entry.level === 'verbose'
                                                ? 'text-amber-300 border-amber-400/40 bg-amber-500/10'
                                                : 'text-white/60 border-white/20 bg-white/5'
                                    }`}>
                                    {entry.level.toUpperCase()}
                                </span>
                                <span className="text-[9px] mt-1 px-1.5 py-0.5 rounded border border-white/20 bg-white/5 text-white/60 shrink-0">
                                    {entry.channel.toUpperCase()}
                                </span>
                                <p className="text-[11px] leading-tight text-white/70 font-medium whitespace-pre-wrap">{entry.text}</p>
                            </div>
                        ))}
                        {filteredLogs.length === 0 && (
                            <div className="text-[11px] text-white/40 italic">No messages match current filters.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

