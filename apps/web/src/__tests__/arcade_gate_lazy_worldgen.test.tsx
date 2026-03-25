import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArcadeSplashGate } from '../app/route-shell-shared';

describe('arcade gate lazy worldgen', () => {
  it('shows the new splash title stack and warm-up messaging while worldgen initializes', () => {
    const html = renderToStaticMarkup(
      <ArcadeSplashGate
        worldgenInitialized={false}
        worldgenWarmState="warming"
        waitingForReady
        showDelayedPulse
        statusLine="Warming worldgen runtime..."
        onStartArcade={vi.fn()}
        onOpenHub={vi.fn()}
      />
    );

    expect(html).toContain('ASHES');
    expect(html).toContain('OF THE');
    expect(html).toContain('WORLD');
    expect(html).toContain('Preparing...');
    expect(html).toContain('Hub');
    expect(html).toContain('Warming worldgen runtime...');
    expect(html).toContain('arcade-splash-action-stack');
    expect(html).not.toContain('backdrop-blur-md');
    expect(html).not.toContain('sm:flex-row');
  });
});
