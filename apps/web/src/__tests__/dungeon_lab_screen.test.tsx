import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getDungeonLabSkillDisplayName, IssueNotice, PreviewMarkerOverlay } from '../app/DungeonLabScreen';

describe('dungeon lab arena screen helpers', () => {
  it('preserves static string names', () => {
    expect(getDungeonLabSkillDisplayName({
      id: 'BASIC_ATTACK',
      name: 'Basic Attack'
    })).toBe('Basic Attack');
  });

  it('falls back to a humanized id when a skill name is dynamic', () => {
    expect(getDungeonLabSkillDisplayName({
      id: 'SPEAR_THROW',
      name: () => 'unused at editor boot'
    })).toBe('Spear Throw');
  });

  it('renders preview markers and validation notices for arena diagnostics', () => {
    const markup = renderToStaticMarkup(
      <div>
        <IssueNotice issue={{
          code: 'MISSING_ALPHA',
          severity: 'error',
          message: 'Arena needs at least one Alpha actor.'
        }} />
        <PreviewMarkerOverlay markers={[{
          kind: 'actor_issue',
          severity: 'error',
          point: { q: 4, r: 2, s: -6 },
          label: 'Actor is outside the arena bounds.'
        }]} />
      </div>
    );

    expect(markup).toContain('Arena needs at least one Alpha actor');
    expect(markup).toContain('Actor is outside the arena bounds.');
  });
});
