import { describe, expect, it, vi } from 'vitest';
import { createHex, generateInitialState, recomputeVisibility } from '@hop/engine';
import { DEFAULT_LOADOUTS } from '../../../../packages/engine/src/systems/loadout';
import { renderToStaticMarkup } from 'react-dom/server';
import { SkillTray } from '../components/SkillTray';

describe('SkillTray', () => {
  it('shows a Travel pill for pure movement skills while alert is off', () => {
    const base = generateInitialState(1, 'skill-tray-travel-mode');
    const html = renderToStaticMarkup(
      <SkillTray
        skills={base.player.activeSkills || []}
        selectedSkillId={null}
        onSelectSkill={vi.fn()}
        hasSpear={base.hasSpear}
        gameState={{ ...base, enemies: [] }}
      />
    );

    expect(html).toContain('Travel');
    expect(html).toMatch(/\b(?:\d+ SP|\d+ MP|Burn \d+ HP)\b/);
    expect(html).not.toMatch(/\+\d+\sEX|\+0\sEX/);
  });

  it('hides the Travel pill once enemy alert is active', () => {
    const base = generateInitialState(1, 'skill-tray-battle-mode');
    const playerPos = createHex(4, 8);
    const battleState = recomputeVisibility({
      ...base,
      player: { ...base.player, position: playerPos, previousPosition: playerPos },
      enemies: [{
        ...base.enemies[0]!,
        position: createHex(4, 7),
        previousPosition: createHex(4, 7),
        hp: 99,
        maxHp: 99
      }]
    });
    const html = renderToStaticMarkup(
      <SkillTray
        skills={battleState.player.activeSkills || []}
        selectedSkillId={null}
        onSelectSkill={vi.fn()}
        hasSpear={battleState.hasSpear}
        gameState={battleState}
      />
    );

    expect(html).not.toContain('Travel');
  });

  it('shows explicit no-target feedback for Necromancer opening skills', () => {
    const necromancer = recomputeVisibility(
      generateInitialState(1, 'skill-tray-necro-start', 'skill-tray-necro-start', undefined, DEFAULT_LOADOUTS.NECROMANCER)
    );

    const html = renderToStaticMarkup(
      <SkillTray
        skills={necromancer.player.activeSkills || []}
        selectedSkillId={null}
        onSelectSkill={vi.fn()}
        hasSpear={necromancer.hasSpear}
        gameState={necromancer}
        compact
      />
    );

    expect(html).toContain('Death Touch');
    expect(html).toContain('Raise Dead');
    expect(html).toContain('Soul Swap');
    expect(html.match(/No Target/g)?.length).toBe(2);
  });

  it('hides archer shot from the skill tray while keeping passive click targeting available', () => {
    const hunter = recomputeVisibility(
      generateInitialState(1, 'skill-tray-hunter-start', 'skill-tray-hunter-start', undefined, DEFAULT_LOADOUTS.HUNTER)
    );

    const html = renderToStaticMarkup(
      <SkillTray
        skills={hunter.player.activeSkills || []}
        selectedSkillId={null}
        onSelectSkill={vi.fn()}
        hasSpear={hunter.hasSpear}
        gameState={hunter}
        compact
      />
    );

    expect(html).not.toContain('Archer Shot');
  });
});
