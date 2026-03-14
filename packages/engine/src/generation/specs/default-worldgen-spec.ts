import type { GenerationSpecInput } from '../schema';
import { INFERNO_VERTICAL_SLICE_SPEC } from './inferno-vertical-slice';

// The shipped default worldgen surface is generic by API even while content remains inferno-only.
export const DEFAULT_WORLDGEN_SPEC: GenerationSpecInput = INFERNO_VERTICAL_SLICE_SPEC;

export const getDefaultWorldgenSpec = (): GenerationSpecInput => DEFAULT_WORLDGEN_SPEC;
