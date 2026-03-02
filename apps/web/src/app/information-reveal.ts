import type { GameState, InformationQuery, InformationResult } from '@hop/engine';
import { getActorInformation } from '@hop/engine';

export type UiInformationRevealMode = NonNullable<InformationQuery['revealMode']>;

const normalizeRevealMode = (value: string | null | undefined): UiInformationRevealMode | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'strict') return 'strict';
  if (normalized === 'force' || normalized === 'force_reveal' || normalized === 'full') return 'force_reveal';
  return null;
};

const resolveRevealModeFromQuery = (search: string): UiInformationRevealMode | null => {
  const params = new URLSearchParams(search);
  return normalizeRevealMode(params.get('intel'));
};

const resolveRevealModeFromEnv = (envMode?: string | null): UiInformationRevealMode | null =>
  normalizeRevealMode(envMode ?? import.meta.env.VITE_INFORMATION_REVEAL_MODE);

export const resolveUiInformationRevealMode = (options: {
  search?: string;
  envMode?: string | null;
} = {}): UiInformationRevealMode => {
  const search = options.search ?? (typeof window === 'undefined' ? '' : window.location.search);
  return resolveRevealModeFromQuery(search) || resolveRevealModeFromEnv(options.envMode) || 'strict';
};

export const getUiInformationRevealMode = (): UiInformationRevealMode =>
  resolveUiInformationRevealMode();

export const getUiActorInformation = (
  state: GameState,
  viewerId: string,
  subjectId: string
): InformationResult =>
  getActorInformation(state, viewerId, subjectId, { revealMode: getUiInformationRevealMode() });
