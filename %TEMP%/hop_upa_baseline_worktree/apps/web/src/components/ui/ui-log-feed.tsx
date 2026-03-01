import React from 'react';
import { classifyMessage } from './ui-log-classifier';
import type { LogChannel, LogLevel } from './ui-log-types';
import { UiLogFilterControls } from './ui-log-filter-controls';
import { UiLogEntries } from './ui-log-entries';

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
        <UiLogFilterControls
          compact={compact}
          levelFilter={levelFilter}
          channelFilter={channelFilter}
          onLevelFilterChange={setLevelFilter}
          onChannelFilterChange={setChannelFilter}
        />
      </div>
      <UiLogEntries entries={filteredLogs} listRef={logRef} />
    </div>
  );
};
