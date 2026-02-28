import React from 'react';

type LogLevel = 'all' | 'info' | 'verbose' | 'debug' | 'critical';
type LogChannel = 'all' | 'combat' | 'hazard' | 'objective' | 'ai' | 'system';

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

interface UiLogFeedProps {
  messages: string[];
  compact?: boolean;
}

export const UiLogFeed: React.FC<UiLogFeedProps> = ({
  messages,
  compact = false
}) => {
  const logRef = React.useRef<HTMLDivElement>(null);
  const [levelFilter, setLevelFilter] = React.useState<LogLevel>('all');
  const [channelFilter, setChannelFilter] = React.useState<LogChannel>('all');

  const classifiedLogs = React.useMemo(() => messages.map((m, i) => classifyMessage(m, i)), [messages]);
  const filteredLogs = React.useMemo(() => {
    return classifiedLogs.filter(l =>
      (levelFilter === 'all' || l.level === levelFilter) &&
      (channelFilter === 'all' || l.channel === channelFilter)
    );
  }, [classifiedLogs, levelFilter, channelFilter]);

  React.useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [filteredLogs]);

  if (messages.length === 0) return null;

  return (
    <div className={`${compact ? 'p-4' : 'p-8'} border-t border-white/5 bg-[#030712]/80 backdrop-blur-sm`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold block">Tactical Log</span>
        <div className={`items-center gap-2 ${compact ? 'hidden sm:flex' : 'flex'}`}>
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
  );
};

