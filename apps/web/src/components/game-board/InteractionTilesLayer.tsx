import React from 'react';
import type { Point } from '@hop/engine';
import { hexToPixel, TILE_SIZE } from '@hop/engine';
import { HexTile } from '../HexTile';

export type BoardDecal = { id: string; position: Point; href: string; createdAt: number };

export interface InteractionTileModel {
  key: string;
  hex: Point;
  isValidMove: boolean;
  isStairs: boolean;
  isLava: boolean;
  isFire: boolean;
  isShrine: boolean;
  isWall: boolean;
  assetHref?: string;
  interactionOnly: boolean;
}

interface InteractionTilesLayerProps {
  tiles: ReadonlyArray<InteractionTileModel>;
  decals: ReadonlyArray<BoardDecal>;
}

const InteractionTilesLayerBase: React.FC<InteractionTilesLayerProps> = ({
  tiles,
  decals,
}) => {
  return (
    <g data-layer="interaction-tiles">
      {tiles.map((tile) => (
        <HexTile
          key={tile.key}
          hex={tile.hex}
          isValidMove={tile.isValidMove}
          isTargeted={false}
          isStairs={tile.isStairs}
          isLava={tile.isLava}
          isFire={tile.isFire}
          isShrine={tile.isShrine}
          isWall={tile.isWall}
          assetHref={tile.assetHref}
          interactionOnly={tile.interactionOnly}
        />
      ))}

      <g>
        {decals.map((decal) => {
          const { x, y } = hexToPixel(decal.position, TILE_SIZE);
          return (
            <image
              key={decal.id}
              href={decal.href}
              x={x - TILE_SIZE * 0.7}
              y={y - TILE_SIZE * 0.7}
              width={TILE_SIZE * 1.4}
              height={TILE_SIZE * 1.4}
              preserveAspectRatio="xMidYMid meet"
              className="board-decal-fade"
            />
          );
        })}
      </g>
    </g>
  );
};

export const InteractionTilesLayer = React.memo(InteractionTilesLayerBase);
