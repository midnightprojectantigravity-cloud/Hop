import React from 'react';
import type { ClassifiedLog } from './ui-log-types';

interface UiLogEntriesProps {
  entries: ClassifiedLog[];
  listRef: React.RefObject<HTMLDivElement | null>;
}

const levelBadgeClass = (level: ClassifiedLog['level']): string => {
  if (level === 'critical') return 'text-[var(--accent-danger)] border-[var(--accent-danger-border)] bg-[var(--accent-danger-soft)]';
  if (level === 'debug') return 'text-[var(--accent-royal)] border-[var(--accent-royal)] bg-[var(--accent-royal-soft)]';
  if (level === 'verbose') return 'text-[var(--accent-brass)] border-[var(--accent-brass)] bg-[var(--accent-brass-soft)]';
  return 'text-[var(--text-secondary)] border-[var(--border-subtle)] bg-[var(--surface-panel-hover)]';
};

export const UiLogEntries: React.FC<UiLogEntriesProps> = ({ entries, listRef }) => (
  <div
    ref={listRef}
    className="flex flex-col gap-2 bg-[var(--surface-panel-muted)] border border-[var(--border-subtle)] p-4 rounded-2xl overflow-y-auto max-h-[140px]"
  >
    {entries.slice(-20).map((entry) => (
      <div key={entry.idx} className="flex gap-2 items-start">
        <span className="text-[10px] text-[var(--text-muted)] font-bold mt-1 leading-none shrink-0">
          [{entry.idx}]
        </span>
        <span className={`text-[9px] mt-1 px-1.5 py-0.5 rounded border shrink-0 ${levelBadgeClass(entry.level)}`}>
          {entry.level.toUpperCase()}
        </span>
        <span className="text-[9px] mt-1 px-1.5 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--surface-panel-hover)] text-[var(--text-secondary)] shrink-0">
          {entry.channel.toUpperCase()}
        </span>
        <p className="text-[11px] leading-tight text-[var(--text-secondary)] font-medium whitespace-pre-wrap">{entry.text}</p>
      </div>
    ))}
    {entries.length === 0 && (
      <div className="text-[11px] text-[var(--text-muted)] italic">No messages match current filters.</div>
    )}
  </div>
);
