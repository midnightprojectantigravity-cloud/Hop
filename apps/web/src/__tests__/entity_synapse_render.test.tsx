import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Entity } from '../components/Entity';
import { EntityRenderShell } from '../components/entity/entity-render-shell';

const parseImageMetric = (html: string, attribute: 'y' | 'height') => {
  const imageTag = html.match(/<image[^>]+>/)?.[0] || '';
  const match = imageTag.match(new RegExp(`${attribute}="([^"]+)"`));
  return match ? Number(match[1]) : Number.NaN;
};

describe('entity synapse render shell', () => {
  it('renders inspectable and pulse classes when synapse flags are active', () => {
    const html = renderToStaticMarkup(
      <svg>
        <EntityRenderShell
          entity={{
            id: 'enemy-1',
            type: 'enemy',
            subtype: 'raider',
            position: { q: 0, r: 0, s: 0 },
            hp: 4,
            maxHp: 4,
            speed: 2,
            factionId: 'enemy',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: []
          } as any}
          x={0}
          y={0}
          isFlashing={false}
          isInvisible={false}
          visualOpacity={1}
          isPlayer={false}
          isFlying={false}
          unitIconYOffset={0}
          unitIconScale={1}
          unitIconSize={10}
          handleAssetError={() => { }}
          contrastBoost={1}
          stunned={false}
          blinded={false}
          showFacing={false}
          borderColor="#fff"
          interactive={true}
          onInspect={() => { }}
          synapsePulseActive={true}
        />
      </svg>
    );

    expect(html).toContain('entity-synapse-inspectable');
    expect(html).toContain('entity-synapse-pulse');
    expect(html).toContain('data-synapse-pulse="active"');
  });

  it('scales unit portraits 50 percent larger by default', () => {
    const html = renderToStaticMarkup(
      <svg>
        <Entity
          entity={{
            id: 'enemy-2',
            type: 'enemy',
            subtype: 'footman',
            position: { q: 0, r: 0, s: 0 },
            hp: 4,
            maxHp: 4,
            speed: 1,
            factionId: 'enemy',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: []
          } as any}
        />
      </svg>
    );

    expect(html).toMatch(/translate\(0,-2\) scale\(1\.5\)/);
  });

  it('applies extra scale compensation for bestiary portraits', () => {
    const html = renderToStaticMarkup(
      <svg>
        <EntityRenderShell
          entity={{
            id: 'enemy-3',
            type: 'enemy',
            subtype: 'footman',
            position: { q: 0, r: 0, s: 0 },
            hp: 4,
            maxHp: 4,
            speed: 1,
            factionId: 'enemy',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: []
          } as any}
          x={0}
          y={0}
          isFlashing={false}
          isInvisible={false}
          visualOpacity={1}
          isPlayer={false}
          isFlying={false}
          unitIconYOffset={0}
          unitIconScale={1}
          unitIconSize={10}
          resolvedAssetHref="/assets/bestiary/unit.goblin.footman.01.webp"
          handleAssetError={() => { }}
          contrastBoost={1}
          stunned={false}
          blinded={false}
          showFacing={false}
          borderColor="#fff"
        />
      </svg>
    );

    expect(html).toContain('width="28"');
    expect(html).toContain('height="28"');
    expect(html).toContain('y="-21"');
  });

  it('keeps larger bestiary portraits anchored to the same feet line', () => {
    const footmanHtml = renderToStaticMarkup(
      <svg>
        <EntityRenderShell
          entity={{
            id: 'enemy-4',
            type: 'enemy',
            subtype: 'footman',
            position: { q: 0, r: 0, s: 0 },
            hp: 4,
            maxHp: 4,
            speed: 1,
            factionId: 'enemy',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: []
          } as any}
          x={0}
          y={0}
          isFlashing={false}
          isInvisible={false}
          visualOpacity={1}
          isPlayer={false}
          isFlying={false}
          unitIconYOffset={0}
          unitIconScale={1}
          unitIconSize={10}
          resolvedAssetHref="/assets/bestiary/unit.goblin.footman.01.webp"
          handleAssetError={() => { }}
          contrastBoost={1}
          stunned={false}
          blinded={false}
          showFacing={false}
          borderColor="#fff"
        />
      </svg>
    );
    const sentinelHtml = renderToStaticMarkup(
      <svg>
        <EntityRenderShell
          entity={{
            id: 'enemy-5',
            type: 'enemy',
            subtype: 'sentinel',
            enemyType: 'boss',
            position: { q: 0, r: 0, s: 0 },
            hp: 10,
            maxHp: 10,
            speed: 1,
            factionId: 'enemy',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: []
          } as any}
          x={0}
          y={0}
          isFlashing={false}
          isInvisible={false}
          visualOpacity={1}
          isPlayer={false}
          isFlying={false}
          unitIconYOffset={0}
          unitIconScale={1}
          unitIconSize={10}
          resolvedAssetHref="/assets/bestiary/unit.goblin.warrior.01.webp"
          handleAssetError={() => { }}
          contrastBoost={1}
          stunned={false}
          blinded={false}
          showFacing={false}
          borderColor="#fff"
        />
      </svg>
    );

    const footmanBottom = parseImageMetric(footmanHtml, 'y') + parseImageMetric(footmanHtml, 'height');
    const sentinelBottom = parseImageMetric(sentinelHtml, 'y') + parseImageMetric(sentinelHtml, 'height');

    expect(parseImageMetric(sentinelHtml, 'height')).toBeGreaterThan(parseImageMetric(footmanHtml, 'height'));
    expect(sentinelBottom).toBeCloseTo(footmanBottom, 5);
  });

  it('lifts player raster portraits upward with the same framing rule', () => {
    const html = renderToStaticMarkup(
      <svg>
        <EntityRenderShell
          entity={{
            id: 'player-1',
            type: 'player',
            position: { q: 0, r: 0, s: 0 },
            hp: 10,
            maxHp: 10,
            speed: 1,
            factionId: 'player',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: []
          } as any}
          x={0}
          y={0}
          isFlashing={false}
          isInvisible={false}
          visualOpacity={1}
          isPlayer={true}
          isFlying={false}
          unitIconYOffset={0}
          unitIconScale={1}
          unitIconSize={10}
          resolvedAssetHref="/assets/units/unit.player.vanguard.01.webp"
          handleAssetError={() => { }}
          contrastBoost={1}
          stunned={false}
          blinded={false}
          showFacing={false}
          borderColor="#fff"
        />
      </svg>
    );

    expect(html).toContain('y="-14"');
  });
});
