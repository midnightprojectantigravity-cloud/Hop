import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScreenTransitionShell, resolveTransitionClasses } from '../app/screen-transition-shell';

describe('screen transition visibility', () => {
  it('uses animated entrance classes in snappy mode', () => {
    expect(resolveTransitionClasses('snappy', 'screen')).toContain('slide-in-from-bottom-3');
    expect(resolveTransitionClasses('snappy', 'overlay')).toContain('zoom-in-95');
    expect(resolveTransitionClasses('snappy', 'floor')).toContain('slide-in-from-bottom-6');
  });

  it('reduces transitions to a simple fade in reduced mode', () => {
    expect(resolveTransitionClasses('reduced', 'screen')).toBe('animate-in fade-in duration-150');
    expect(resolveTransitionClasses('reduced', 'overlay')).toBe('animate-in fade-in duration-150');
  });

  it('renders transition metadata on the wrapper', () => {
    const html = renderToStaticMarkup(
      <ScreenTransitionShell motionMode="snappy" screenId="hub">
        <div>Hub</div>
      </ScreenTransitionShell>
    );

    expect(html).toContain('data-screen-transition="hub"');
    expect(html).toContain('data-motion-mode="snappy"');
    expect(html).toContain('Hub');
  });
});
