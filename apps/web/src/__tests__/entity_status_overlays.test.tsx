import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EntityStatusOverlays } from '../components/entity/entity-status-overlays';

describe('entity status overlays', () => {
  it('renders blinded overlay glyph when blinded is true', () => {
    const html = renderToStaticMarkup(
      <svg>
        <EntityStatusOverlays
          stunned={false}
          blinded={true}
          showFacing={false}
          borderColor="#fff"
        />
      </svg>
    );

    expect(html).toContain('blind-icon');
    expect(html).toContain('<title>Blinded</title>');
  });

  it('renders stunned overlay glyph when stunned is true', () => {
    const html = renderToStaticMarkup(
      <svg>
        <EntityStatusOverlays
          stunned={true}
          blinded={false}
          showFacing={false}
          borderColor="#fff"
        />
      </svg>
    );

    expect(html).toContain('stun-icon');
    expect(html).toContain('<title>Stunned</title>');
  });
});
