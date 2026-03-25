import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TutorialReplayScreen } from '../app/TutorialReplayScreen';

describe('tutorial launcher screen', () => {
  it('shows guided tutorial controls alongside the legacy scenario browser', () => {
    const html = renderToStaticMarkup(
      <TutorialReplayScreen
        onLoadScenario={vi.fn()}
        onStartGuidedTutorial={vi.fn()}
        tutorialProgress={{ completed: false, skipped: false, lastStepId: null }}
        onResetTutorialProgress={vi.fn()}
        onSkipTutorial={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain('Guided Tutorial');
    expect(html).toContain('Start Guided Tutorial');
    expect(html).toContain('Scenario Browser');
  });
});
