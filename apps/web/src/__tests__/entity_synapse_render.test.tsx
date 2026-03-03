import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EntityRenderShell } from '../components/entity/entity-render-shell';

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
          waapiControlled={true}
          segmentDurationMs={0}
          segmentEasing="linear"
          stretchTransform=""
          isFlashing={false}
          teleportPhase="none"
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
});

