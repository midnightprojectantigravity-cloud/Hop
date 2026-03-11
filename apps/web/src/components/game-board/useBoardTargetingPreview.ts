import { useMemo } from 'react';
import {
    buildAilmentDeltaSummary,
    getHexLine,
    isHexInRectangularGrid,
    pointToKey,
    previewActionOutcome,
    resolveMovementPreviewPath,
    SkillRegistry,
    type GameState,
    type Point,
} from '@hop/engine';

interface EnginePreviewGhost {
    path: Point[];
    aoe: Point[];
    hasEnemy: boolean;
    target: Point;
    ailmentDeltaLines?: string[];
}

export const extractAilmentDeltaLines = (events: GameState['simulationEvents'] | undefined): string[] => {
    if (!events) return [];
    return buildAilmentDeltaSummary(events);
};

interface UseBoardTargetingPreviewArgs {
    gameState: GameState;
    playerPos: Point;
    selectedSkillId: string | null;
    showMovementRange: boolean;
    hoveredTile: Point | null;
    enginePreviewGhost?: EnginePreviewGhost | null;
}

export const useBoardTargetingPreview = ({
    gameState,
    playerPos,
    selectedSkillId,
    showMovementRange,
    hoveredTile,
    enginePreviewGhost,
}: UseBoardTargetingPreviewArgs) => {
    const movementTargets = useMemo(() => {
        if (!showMovementRange || selectedSkillId) return [] as Point[];

        const movementSkillIds = ['BASIC_MOVE', 'DASH'] as const;
        const playerSkillIds = new Set(gameState.player.activeSkills.map(s => s.id));
        const validSet = new Set<string>();
        const results: Point[] = [];

        for (const id of movementSkillIds) {
            if (!playerSkillIds.has(id)) continue;
            const def = SkillRegistry.get(id);
            if (!def?.getValidTargets) continue;
            const targets = def.getValidTargets(gameState, playerPos);
            for (const t of targets) {
                const key = pointToKey(t);
                if (!validSet.has(key)) {
                    validSet.add(key);
                    results.push(t);
                }
            }
        }
        return results;
    }, [showMovementRange, selectedSkillId, gameState, playerPos]);

    const movementTargetSet = useMemo(() => {
        const set = new Set<string>();
        for (const p of movementTargets) set.add(pointToKey(p));
        return set;
    }, [movementTargets]);

    const hasPrimaryMovementSkills = useMemo(
        () => gameState.player.activeSkills.some(s => s.id === 'BASIC_MOVE' || s.id === 'DASH'),
        [gameState.player.activeSkills]
    );

    const stairsKey = useMemo(() => pointToKey(gameState.stairsPosition), [gameState.stairsPosition]);
    const shrineKey = useMemo(
        () => (gameState.shrinePosition ? pointToKey(gameState.shrinePosition) : null),
        [gameState.shrinePosition]
    );

    const fallbackNeighborSet = useMemo(() => {
        const neighbors = [
            { q: playerPos.q + 1, r: playerPos.r, s: playerPos.s - 1 },
            { q: playerPos.q + 1, r: playerPos.r - 1, s: playerPos.s },
            { q: playerPos.q, r: playerPos.r - 1, s: playerPos.s + 1 },
            { q: playerPos.q - 1, r: playerPos.r, s: playerPos.s + 1 },
            { q: playerPos.q - 1, r: playerPos.r + 1, s: playerPos.s },
            { q: playerPos.q, r: playerPos.r + 1, s: playerPos.s - 1 }
        ];
        const set = new Set<string>();
        for (const n of neighbors) {
            if (isHexInRectangularGrid(n, gameState.gridWidth, gameState.gridHeight, gameState.mapShape)) {
                set.add(pointToKey(n));
            }
        }
        return set;
    }, [playerPos, gameState.gridWidth, gameState.gridHeight, gameState.mapShape]);

    const selectedSkillTargetSet = useMemo(() => {
        const set = new Set<string>();
        if (!selectedSkillId) return set;
        const def = SkillRegistry.get(selectedSkillId);
        if (!def?.getValidTargets) return set;
        const visibleActorIds = new Set(gameState.visibility?.playerFog?.visibleActorIds || []);
        const detectedActorIds = new Set(gameState.visibility?.playerFog?.detectedActorIds || []);
        const enforceVisibility = !!gameState.visibility;
        const targets = def.getValidTargets(gameState, playerPos);
        for (const t of targets) {
            const key = pointToKey(t);
            if (!enforceVisibility) {
                set.add(key);
                continue;
            }
            const targetEnemy = gameState.enemies.find(enemy => pointToKey(enemy.position) === key && enemy.hp > 0);
            if (
                targetEnemy
                && !visibleActorIds.has(targetEnemy.id)
                && !detectedActorIds.has(targetEnemy.id)
            ) {
                continue;
            }
            set.add(key);
        }
        return set;
    }, [selectedSkillId, gameState, playerPos]);

    const resolvedEnginePreviewGhost = useMemo(() => {
        if (enginePreviewGhost) return enginePreviewGhost;
        if (!hoveredTile) return null;

        const hoveredKey = pointToKey(hoveredTile);
        if (showMovementRange && !selectedSkillId) {
            const isMoveTile = movementTargetSet.has(hoveredKey)
                || (!hasPrimaryMovementSkills && fallbackNeighborSet.has(hoveredKey));
            if (!isMoveTile) return null;
            const previewPath = gameState.player.activeSkills.some(skill => skill.id === 'BASIC_MOVE')
                ? resolveMovementPreviewPath(gameState, gameState.player, 'BASIC_MOVE', hoveredTile)
                : null;
            return {
                path: previewPath?.ok ? previewPath.path : getHexLine(playerPos, hoveredTile),
                aoe: [],
                hasEnemy: false,
                target: hoveredTile,
                ailmentDeltaLines: []
            };
        }

        if (!selectedSkillId) return null;

        const selectedSkill = gameState.player.activeSkills.find(skill => skill.id === selectedSkillId);
        const selectedMovementSkill = selectedSkillId === 'BASIC_MOVE'
            || selectedSkillId === 'DASH'
            || selectedSkillId === 'JUMP'
            ? selectedSkillId
            : null;
        const preview = previewActionOutcome(gameState, {
            actorId: gameState.player.id,
            skillId: selectedSkillId,
            target: hoveredTile,
            activeUpgrades: selectedSkill?.activeUpgrades || []
        });

        if (!preview.ok) return null;

        const aoeByKey = new Map<string, Point>();
        for (const event of preview.simulationEvents) {
            if (!event.position) continue;
            if (event.type !== 'DamageTaken' && event.type !== 'StatusApplied' && event.type !== 'UnitMoved') continue;
            aoeByKey.set(pointToKey(event.position), event.position);
        }

        const hasEnemy = preview.simulationEvents.some(event =>
            (event.type === 'DamageTaken' || event.type === 'StatusApplied')
            && Boolean(event.targetId)
            && event.targetId !== gameState.player.id
        );
        const ailmentDeltaLines = extractAilmentDeltaLines(preview.simulationEvents);
        const movementPreview = selectedMovementSkill
            ? resolveMovementPreviewPath(gameState, gameState.player, selectedMovementSkill, hoveredTile)
            : null;

        return {
            path: movementPreview?.ok ? movementPreview.path : getHexLine(playerPos, hoveredTile),
            aoe: [...aoeByKey.values()],
            hasEnemy,
            target: hoveredTile,
            ailmentDeltaLines
        };
    }, [
        enginePreviewGhost,
        hoveredTile,
        showMovementRange,
        selectedSkillId,
        movementTargetSet,
        hasPrimaryMovementSkills,
        fallbackNeighborSet,
        gameState,
        playerPos
    ]);

    return {
        movementTargetSet,
        hasPrimaryMovementSkills,
        stairsKey,
        shrineKey,
        fallbackNeighborSet,
        selectedSkillTargetSet,
        resolvedEnginePreviewGhost,
    };
};
