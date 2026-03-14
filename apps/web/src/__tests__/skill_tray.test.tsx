import { describe, expect, it, vi } from 'vitest';
import { createHex, generateInitialState, recomputeVisibility } from '@hop/engine';
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
});
