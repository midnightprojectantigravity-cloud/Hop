import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('tutorial session contract', () => {
  it('owns tutorial session state and progression helpers', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/use-tutorial-session.ts'),
      'utf8'
    );

    expect(source).toContain('export interface TutorialSessionController');
    expect(source).toContain('startGuidedTutorial');
    expect(source).toContain('dismissTutorialOnboarding');
    expect(source).toContain('finishGuidedTutorialStep');
    expect(source).toContain('skipGuidedTutorial');
    expect(source).toContain('resetGuidedTutorialProgress');
    expect(source).toContain('dismissTutorialInstructions');
  });
});
