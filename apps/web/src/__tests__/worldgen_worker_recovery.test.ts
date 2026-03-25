import { describe, expect, it, vi } from 'vitest';
import { ensureCompileWorker } from '../app/use-worldgen-worker';

describe('worldgen worker recovery', () => {
  it('returns the active worker when the ref is already populated', async () => {
    const worker = { id: 'active-worker' };
    const reinitializeWorker = vi.fn(async () => undefined);

    const resolved = await ensureCompileWorker({
      workerRef: { current: worker },
      reinitializeWorker
    });

    expect(resolved).toBe(worker);
    expect(reinitializeWorker).not.toHaveBeenCalled();
  });

  it('reinitializes the worker when the ref is missing', async () => {
    const workerRef: { current: { id: string } | null } = { current: null };
    const worker = { id: 'reinitialized-worker' };
    const reinitializeWorker = vi.fn(async () => {
      workerRef.current = worker;
    });

    const resolved = await ensureCompileWorker({
      workerRef,
      reinitializeWorker
    });

    expect(reinitializeWorker).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(worker);
  });

  it('throws when the worker is still unavailable after reinitialization', async () => {
    const reinitializeWorker = vi.fn(async () => undefined);

    await expect(ensureCompileWorker({
      workerRef: { current: null as { id: string } | null },
      reinitializeWorker
    })).rejects.toThrow('Worldgen worker unavailable');

    expect(reinitializeWorker).toHaveBeenCalledTimes(1);
  });
});
