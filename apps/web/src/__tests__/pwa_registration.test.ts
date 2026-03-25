import { describe, expect, it, vi } from 'vitest';
import { registerAppServiceWorker, resolveAppBaseUrl, resolveServiceWorkerUrl } from '../app/pwa';

describe('pwa registration', () => {
  it('normalizes the base url and resolves the service worker path', () => {
    expect(resolveAppBaseUrl('/Hop')).toBe('/Hop/');
    expect(resolveServiceWorkerUrl('/Hop')).toBe('/Hop/service-worker.js');
  });

  it('registers the service worker on window load', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    let capturedLoadHandler = false;
    let loadHandler: () => void = () => {
      throw new Error('load handler was not captured');
    };

    await registerAppServiceWorker(
      { serviceWorker: { register } as unknown as Navigator['serviceWorker'] },
      {
        addEventListener: ((event: string, handler: () => void) => {
          if (event === 'load') {
            capturedLoadHandler = true;
            loadHandler = handler;
          }
        }) as Window['addEventListener']
      },
      '/Hop/'
    );

    expect(register).not.toHaveBeenCalled();
    expect(capturedLoadHandler).toBe(true);
    loadHandler();
    expect(register).toHaveBeenCalledWith('/Hop/service-worker.js');
  });
});
