import React from 'react';
import type { GameState, Point } from '@hop/engine';
import { hexToPixel, TILE_SIZE, pointToKey } from '@hop/engine';
import { HexTile } from '../HexTile';
import PreviewOverlay from '../PreviewOverlay';
import type { VisualAssetEntry } from '../../visual/asset-manifest';
import { resolveTileAssetId } from '../../visual/asset-selectors';

type TileFlags = { isWall: boolean; isLava: boolean; isFire: boolean };
type BoardDecal = { id: string; position: Point; href: string; createdAt: number };

interface InteractionTilesLayerProps {
    gameState: GameState;
    selectedSkillId: string | null;
    showMovementRange: boolean;
    hoveredTile: Point | null;
    enginePreviewGhost?: {
        path: Point[];
        aoe: Point[];
        hasEnemy: boolean;
        target: Point;
        ailmentDeltaLines?: string[];
    } | null;
    cells: Point[];
    tileVisualFlags: Map<string, TileFlags>;
    movementTargetSet: Set<string>;
    hasPrimaryMovementSkills: boolean;
    fallbackNeighborSet: Set<string>;
    selectedSkillTargetSet: Set<string>;
    stairsKey: string;
    shrineKey?: string | null;
    mountainCoveredWallKeys: Set<string>;
    hybridInteractionLayerEnabled: boolean;
    assetById: Map<string, VisualAssetEntry>;
    onTileClick: (hex: Point) => void;
    onTileHover: (hex: Point) => void;
    decals: BoardDecal[];
}

export const InteractionTilesLayer: React.FC<InteractionTilesLayerProps> = ({
    gameState,
    selectedSkillId,
    showMovementRange,
    hoveredTile,
    enginePreviewGhost,
    cells,
    tileVisualFlags,
    movementTargetSet,
    hasPrimaryMovementSkills,
    fallbackNeighborSet,
    selectedSkillTargetSet,
    stairsKey,
    shrineKey,
    mountainCoveredWallKeys,
    hybridInteractionLayerEnabled,
    assetById,
    onTileClick,
    onTileHover,
    decals,
}) => {
    return (
        <>
            <g data-layer="interaction-preview">
                <PreviewOverlay
                    gameState={gameState}
                    selectedSkillId={selectedSkillId}
                    showMovementRange={showMovementRange}
                    hoveredTile={hoveredTile}
                    enginePreviewGhost={enginePreviewGhost}
                />
            </g>
            <g data-layer="interaction-tiles">
                {cells.map((hex) => {
                    const tileKey = pointToKey(hex);
                    const flags = tileVisualFlags.get(tileKey) || { isWall: false, isLava: false, isFire: false };
                    const isWall = flags.isWall;
                    const isLava = flags.isLava;
                    const isFire = flags.isFire;

                    const isMoveHighlight =
                        (showMovementRange && !selectedSkillId && movementTargetSet.has(tileKey))
                        || (
                            showMovementRange
                            && !selectedSkillId
                            && !hasPrimaryMovementSkills
                            && fallbackNeighborSet.has(tileKey)
                            && !isWall
                        );
                    const isSkillHighlight = !!selectedSkillId && selectedSkillTargetSet.has(tileKey);
                    const showRangeHighlight = isSkillHighlight || isMoveHighlight;
                    const isStairs = tileKey === stairsKey;
                    const isShrine = shrineKey ? tileKey === shrineKey : false;
                    const renderWallTile = isWall && !mountainCoveredWallKeys.has(tileKey);
                    const interactionOnly = hybridInteractionLayerEnabled && !renderWallTile;
                    const tileAssetId = resolveTileAssetId({ isWall: renderWallTile, isLava, isFire, isStairs, isShrine, theme: gameState.theme });
                    const tileAssetHref = interactionOnly ? undefined : assetById.get(tileAssetId)?.path;

                    return (
                        <HexTile
                            key={tileKey}
                            hex={hex}
                            onClick={onTileClick}
                            isValidMove={showRangeHighlight}
                            isTargeted={false}
                            isStairs={isStairs}
                            isLava={isLava}
                            isFire={isFire}
                            isShrine={isShrine}
                            isWall={renderWallTile}
                            onMouseEnter={onTileHover}
                            assetHref={tileAssetHref}
                            interactionOnly={interactionOnly}
                        />
                    );
                })}

                <g>
                    {decals.map((decal) => {
                        const { x, y } = hexToPixel(decal.position, TILE_SIZE);
                        const ageMs = Date.now() - decal.createdAt;
                        const opacity = Math.max(0.18, 0.75 - (ageMs / 12000) * 0.57);
                        return (
                            <image
                                key={decal.id}
                                href={decal.href}
                                x={x - TILE_SIZE * 0.7}
                                y={y - TILE_SIZE * 0.7}
                                width={TILE_SIZE * 1.4}
                                height={TILE_SIZE * 1.4}
                                preserveAspectRatio="xMidYMid meet"
                                opacity={opacity}
                            />
                        );
                    })}
                </g>
            </g>
        </>
    );
};
