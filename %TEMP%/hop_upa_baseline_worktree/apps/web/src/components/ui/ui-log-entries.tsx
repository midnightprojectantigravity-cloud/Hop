import React from 'react';
import type { ClassifiedLog } from './ui-log-types';

interface UiLogEntriesProps {
  entries: ClassifiedLog[];
  listRef: React.RefObject<HTMLDivElement | null>;
}

const levelBadgeClass = (level: ClassifiedLog['level']): string => {
  if (level === 'critical') return 'text-red-300 border-red-400/40 bg-red-500/10';
  if (level === 'debug') return 'text-cyan-300 border-cyan-400/40 bg-cyan-500/10';
  if (level === 'verbose') return 'text-amber-300 border-amber-400/40 bg-amber-500/10';
  return 'text-white/60 border-white/20 bg-white/5';
};

export const UiLogEntries: React.FC<UiLogEntriesProps> = ({ entries, listRef }) => (
  <div
    ref={listRef}
    className="flex flex-col gap-2 bg-white/[0.02] border border-white/5 p-4 rounded-2xl overflow-y-auto max-h-[140px]"
  >
    {entries.slice(-20).map((entry) => (
      <div key={entry.idx} className="flex gap-2 items-start">
        <span className="text-[10px] text-white/20 font-bold mt-1 leading-none shrink-0">
          [{entry.idx}]
        </span>
        <span className={`text-[9px] mt-1 px-1.5 py-0.5 rounded border shrink-0 ${levelBadgeClass(entry.level)}`}>
          {entry.level.toUpperCase()}
        </span>
        <span className="text-[9px] mt-1 px-1.5 py-0.5 rounded border border-white/20 bg-white/5 text-white/60 shrink-0">
          {entry.channel.toUpperCase()}
        </span>
        <p className="text-[11px] leading-tight text-white/70 font-medium whitespace-pre-wrap">{entry.text}</p>
      </div>
    ))}
    {entries.length === 0 && (
      <div className="text-[11px] text-white/40 italic">No messages match current filters.</div>
    )}
  </div>
);
