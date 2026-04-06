import { safeParse, safeStringify } from '@hop/engine';

export const toDungeonLabWorkerTransportSafe = <T>(value: T): T =>
  safeParse(safeStringify(value)) as T;
