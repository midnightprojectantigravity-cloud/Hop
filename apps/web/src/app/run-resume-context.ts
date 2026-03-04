export interface RunResumeContext {
  lastLoadoutId: string;
  lastRunMode: 'normal' | 'daily';
  lastDailyDate?: string;
}

export interface StartRunQuickRestartPayload {
  loadoutId: string;
  mode: 'normal' | 'daily';
  seed?: string;
  date?: string;
}

export const RUN_RESUME_CONTEXT_STORAGE_KEY = 'hop_last_run_context_v1';

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

const getBrowserStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

const isRunMode = (value: unknown): value is RunResumeContext['lastRunMode'] => {
  return value === 'normal' || value === 'daily';
};

const isDateKey = (value: unknown): value is string => {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
};

export const toDateKey = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeRunResumeContext = (input: unknown): RunResumeContext | null => {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  if (typeof record.lastLoadoutId !== 'string' || !record.lastLoadoutId.trim()) return null;
  if (!isRunMode(record.lastRunMode)) return null;

  const normalized: RunResumeContext = {
    lastLoadoutId: record.lastLoadoutId,
    lastRunMode: record.lastRunMode
  };

  if (isDateKey(record.lastDailyDate)) {
    normalized.lastDailyDate = record.lastDailyDate;
  }

  return normalized;
};

export const readRunResumeContext = (
  storage: StorageReader | null = getBrowserStorage()
): RunResumeContext | null => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(RUN_RESUME_CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    return normalizeRunResumeContext(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const writeRunResumeContext = (
  context: RunResumeContext,
  storage: StorageWriter | null = getBrowserStorage()
): void => {
  if (!storage) return;
  storage.setItem(RUN_RESUME_CONTEXT_STORAGE_KEY, JSON.stringify(context));
};

export const buildRunResumeContext = (params: {
  loadoutId: string;
  mode: 'normal' | 'daily';
  dailyDate?: string;
}): RunResumeContext => {
  const base: RunResumeContext = {
    lastLoadoutId: params.loadoutId,
    lastRunMode: params.mode
  };
  if (params.mode === 'daily') {
    base.lastDailyDate = isDateKey(params.dailyDate) ? params.dailyDate : toDateKey();
  }
  return base;
};

export const deriveQuickRestartStartRunPayload = (params: {
  context: RunResumeContext | null;
  fallbackLoadoutId?: string;
  fallbackDailyDate?: string;
  now?: Date;
  seedFactory?: () => string;
}): StartRunQuickRestartPayload | null => {
  const { context, fallbackLoadoutId, fallbackDailyDate, now = new Date(), seedFactory } = params;

  const loadoutId = context?.lastLoadoutId || fallbackLoadoutId;
  if (!loadoutId) return null;

  const mode: 'normal' | 'daily' = context?.lastRunMode || (isDateKey(fallbackDailyDate) ? 'daily' : 'normal');
  if (mode === 'daily') {
    const date = context?.lastDailyDate || (isDateKey(fallbackDailyDate) ? fallbackDailyDate : toDateKey(now));
    return {
      loadoutId,
      mode,
      date
    };
  }

  return {
    loadoutId,
    mode,
    seed: seedFactory ? seedFactory() : String(Date.now())
  };
};
