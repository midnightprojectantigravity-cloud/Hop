import React from 'react';
import type { LogChannel, LogLevel } from './ui-log-types';

interface UiLogFilterControlsProps {
  compact?: boolean;
  levelFilter: LogLevel;
  channelFilter: LogChannel;
  onLevelFilterChange: (level: LogLevel) => void;
  onChannelFilterChange: (channel: LogChannel) => void;
}

export const UiLogFilterControls: React.FC<UiLogFilterControlsProps> = ({
  compact = false,
  levelFilter,
  channelFilter,
  onLevelFilterChange,
  onChannelFilterChange
}) => (
  <div className={`items-center gap-2 ${compact ? 'hidden sm:flex' : 'flex'}`}>
    <select
      value={channelFilter}
      onChange={(e) => onChannelFilterChange(e.target.value as LogChannel)}
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
      onChange={(e) => onLevelFilterChange(e.target.value as LogLevel)}
      className="text-[10px] bg-white/5 border border-white/10 rounded px-2 py-1 text-white/80"
    >
      <option value="all">All Levels</option>
      <option value="info">Info</option>
      <option value="verbose">Verbose</option>
      <option value="debug">Debug</option>
      <option value="critical">Critical</option>
    </select>
  </div>
);

