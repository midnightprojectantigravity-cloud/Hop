export type LogLevel = 'all' | 'info' | 'verbose' | 'debug' | 'critical';
export type LogChannel = 'all' | 'combat' | 'hazard' | 'objective' | 'ai' | 'system';

export type ClassifiedLog = {
  idx: number;
  raw: string;
  text: string;
  level: Exclude<LogLevel, 'all'>;
  channel: Exclude<LogChannel, 'all'>;
};

