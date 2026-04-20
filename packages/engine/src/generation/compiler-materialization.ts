import type { FloorTheme, Point } from '../types';
import { createHex, pointToKey } from '../hex';
import { buildModuleRegistryIndex } from './modules';
import { hexDistanceInt, hexRaycastInt } from './math/hex-int';
import { createRng32, shuffleStable } from './rng32';
import type {
    AuthoredFloorSpec,
    AuthoredPathOverride,
    GenerationFailure,
    ModulePlan,
    ModulePlacement,
    NarrativeAnchor,
    NarrativeSceneRequest,
    RouteMembership,
    SpatialPlan,
    SpatialClaim,
    TopologicalBlueprint
} from './schema';
import type { BaseArena } from './compiler-context';

type AuthoredFloor = AuthoredFloorSpec;

const chooseAnchorCandidates = (arena: BaseArena, kind: 'center' | 'upper' | 'lower' | 'left' | 'right'): Point[] => {
    const all = [...arena.allHexes].sort((a, b) => pointToKey(a).localeCompare(pointToKey(b)));
    switch (kind) {
        case 'upper':
            return all.sort((a, b) => a.r - b.r || a.q - b.q);
        case 'lower':
            return all.sort((a, b) => b.r - a.r || a.q - b.q);
        case 'left':
            return all.sort((a, b) => a.q - b.q || a.r - b.r);
        case 'right':
            return all.sort((a, b) => b.q - a.q || a.r - b.r);
        default:
            return all.sort((a, b) =>
                hexDistanceInt(a, arena.center) - hexDistanceInt(b, arena.center)
                || pointToKey(a).localeCompare(pointToKey(b))
            );
    }
};

const toWorld = (anchor: Point, local: { dq: number; dr: number }): Point =>
    createHex(anchor.q + local.dq, anchor.r + local.dr);

const fitsFootprint = (
    anchor: Point,
    footprint: { dq: number; dr: number }[],
    arena: BaseArena,
    occupied: ReadonlySet<string>,
    allowedOccupiedKeys: ReadonlySet<string> = new Set<string>()
): boolean => {
    const specials = {
        playerStart: arena.playerSpawn,
        stairsPosition: arena.stairsPosition,
        shrinePosition: arena.shrinePosition
    };
    return footprint.every(local => {
        const point = toWorld(anchor, local);
        const key = pointToKey(point);
        return arena.allHexes.some(cell => pointToKey(cell) === key)
            && (!occupied.has(key) || allowedOccupiedKeys.has(key))
            && !Object.values(specials).some(special => special && pointToKey(special) === key);
    });
};

const entryMatchesSlot = (
    entry: ReturnType<typeof buildModuleRegistryIndex>['entries'][number],
    slot: TopologicalBlueprint['slots'][number],
    theme: string,
    blockedIds: ReadonlySet<string>
): boolean =>
    entry.theme === theme
    && !blockedIds.has(entry.id)
    && slot.requiredTacticalTags.every(tag => entry.capability.tacticalTags.includes(tag))
    && slot.requiredNarrativeTags.every(tag => entry.capability.narrativeTags.includes(tag));

const getCandidateModuleEntriesForSlot = (
    slot: TopologicalBlueprint['slots'][number],
    authoredFloor: AuthoredFloor | undefined,
    theme: string,
    registry: ReturnType<typeof buildModuleRegistryIndex>,
    blockedIds: ReadonlySet<string>
) => {
    const authoredPreferred = (authoredFloor?.preferredModuleIds || [])
        .map(id => registry.entriesById[id])
        .filter((entry): entry is ReturnType<typeof buildModuleRegistryIndex>['entries'][number] => Boolean(entry))
        .filter(entry => entryMatchesSlot(entry, slot, theme, blockedIds));

    if (authoredPreferred.length > 0) {
        return authoredPreferred;
    }

    return registry.entries
        .filter(entry => entryMatchesSlot(entry, slot, theme, blockedIds))
        .sort((a, b) =>
            b.constraintDensityScore - a.constraintDensityScore
            || a.id.localeCompare(b.id)
        );
};

const getPathOverride = (
    authoredFloor: AuthoredFloor | undefined,
    targetId: string
): AuthoredPathOverride | undefined => authoredFloor?.pathOverrides?.[targetId];

const resolveLandmarkRoute = (
    override: AuthoredPathOverride | undefined,
    onPathDefault: boolean,
    fallbackMembership: Exclude<RouteMembership, 'hidden'>
): { onPath: boolean; routeMembership: RouteMembership } => {
    if (override?.routeHint === 'hidden') {
        return {
            onPath: false,
            routeMembership: 'hidden'
        };
    }
    if (override?.routeHint === 'primary' || override?.routeHint === 'alternate') {
        const onPath = override.onPath ?? true;
        return {
            onPath,
            routeMembership: onPath ? override.routeHint : 'hidden'
        };
    }
    const onPath = override?.onPath ?? onPathDefault;
    return {
        onPath,
        routeMembership: onPath ? fallbackMembership : 'hidden'
    };
};

export const resolveModulePlan = (
    blueprint: TopologicalBlueprint,
    authoredFloor: AuthoredFloor | undefined,
    theme: string,
    arena: BaseArena,
    spatialPlan: SpatialPlan,
    rngSeed: string
): ModulePlan | GenerationFailure => {
    const registry = buildModuleRegistryIndex();
    const occupied = new Set<string>();
    occupied.add(pointToKey(arena.playerSpawn));
    occupied.add(pointToKey(arena.stairsPosition));
    if (arena.shrinePosition) {
        occupied.add(pointToKey(arena.shrinePosition));
    }
    const placements: ModulePlacement[] = [];
    const rng = createRng32(`${rngSeed}:modules`);
    const blockedIds = new Set(authoredFloor?.blockedModuleIds || []);

    const updateSlotAnchor = (slotId: string, anchor: Point) => {
        spatialPlan.anchorById[slotId] = anchor;
        const slotPlacement = spatialPlan.slotPlacements.find(item => item.slotId === slotId);
        if (slotPlacement) {
            slotPlacement.anchor = anchor;
        } else {
            spatialPlan.slotPlacements.push({ slotId, anchor });
        }
        spatialPlan.gasketAnchors[slotId] = anchor;
    };

    const candidateModuleIdsForSlot = (slot: TopologicalBlueprint['slots'][number]): string[] =>
        getCandidateModuleEntriesForSlot(slot, authoredFloor, theme, registry, blockedIds).map(entry => entry.id);

    const candidateAnchorsForSlot = (slot: TopologicalBlueprint['slots'][number]): Point[] => {
        const seen = new Set<string>();
        const preferred = spatialPlan.anchorById[slot.id];
        const otherCandidates = chooseAnchorCandidates(arena, slot.preferredAnchorKind);
        const shuffledOthers = shuffleStable(otherCandidates, rng);
        return [preferred, ...shuffledOthers]
            .filter((anchor): anchor is Point => Boolean(anchor))
            .filter(anchor => {
                const key = pointToKey(anchor);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    };

    const placeModule = (moduleId: string, slotId: string, anchor: Point): GenerationFailure | undefined => {
        const module = registry.entriesById[moduleId];
        if (!module) {
            return {
                stage: 'resolveModulePlan',
                code: 'MODULE_NOT_FOUND',
                severity: 'error',
                conflict: {
                    authoredId: moduleId,
                    constraintType: 'MODULE_NOT_FOUND',
                    spatialContext: { hexes: [anchor], anchorIds: [slotId] }
                },
                diagnostics: [`Unknown module ${moduleId}.`]
            };
        }
        if (!fitsFootprint(anchor, module.footprint, arena, occupied, new Set([pointToKey(anchor)]))) {
            return {
                stage: 'resolveModulePlan',
                code: 'MODULE_FOOTPRINT_BLOCKED',
                severity: 'error',
                conflict: {
                    authoredId: moduleId,
                    constraintType: 'MODULE_FOOTPRINT_BLOCKED',
                    spatialContext: { hexes: [anchor], anchorIds: [slotId] }
                },
                diagnostics: [`Module ${moduleId} cannot fit at ${pointToKey(anchor)}.`]
            };
        }

        const footprintKeys = module.footprint.map(local => pointToKey(toWorld(anchor, local)));
        footprintKeys.forEach(key => occupied.add(key));
        placements.push({ moduleId, slotId, anchor, footprintKeys, onPath: false });
        return undefined;
    };

    for (const pinned of authoredFloor?.pinnedModules || []) {
        const anchor = createHex(pinned.anchor.q, pinned.anchor.r);
        const matchingSlotId = blueprint.slots.find(slot =>
            pointToKey(spatialPlan.anchorById[slot.id] || arena.center) === pointToKey(anchor)
            && !placements.some(item => item.slotId === slot.id)
        )?.id;
        const failure = placeModule(pinned.id, matchingSlotId || pinned.id, anchor);
        if (failure) return failure;
    }

    for (const slot of blueprint.slots) {
        if (placements.some(item => item.slotId === slot.id)) continue;
        const explicitCandidateIds = candidateModuleIdsForSlot(slot);

        if (explicitCandidateIds.length === 0) continue;
        const candidates = shuffleStable(explicitCandidateIds, rng);
        let placed = false;
        const anchorCandidates = candidateAnchorsForSlot(slot);
        let lastAnchor = spatialPlan.anchorById[slot.id] || arena.center;
        for (const anchor of anchorCandidates) {
            lastAnchor = anchor;
            for (const moduleId of candidates) {
                const failure = placeModule(moduleId, slot.id, anchor);
                if (!failure) {
                    updateSlotAnchor(slot.id, anchor);
                    placed = true;
                    break;
                }
            }
            if (placed) {
                break;
            }
        }
        if (!placed && slot.requiredTacticalTags.length > 0) {
            return {
                stage: 'resolveModulePlan',
                code: 'SEARCH_BUDGET_EXCEEDED',
                severity: 'error',
                conflict: {
                    authoredId: slot.id,
                    constraintType: 'SEARCH_BUDGET_EXCEEDED',
                    spatialContext: { hexes: [lastAnchor], anchorIds: [slot.id] }
                },
                diagnostics: [`No candidate module could satisfy slot ${slot.id}.`]
            };
        }
    }

    return { placements };
};

export const registerSpatialClaims = (modulePlan: ModulePlan): SpatialClaim[] => {
    const registry = buildModuleRegistryIndex();
    const claims: SpatialClaim[] = [];
    for (const placement of modulePlan.placements) {
        const module = registry.entriesById[placement.moduleId];
        const anchor = placement.anchor;
        for (const template of module.claimTemplates || []) {
            const from = toWorld(anchor, template.from);
            const to = toWorld(anchor, template.to);
            claims.push({
                id: `${placement.slotId}:${template.id}`,
                kind: template.kind,
                hardness: template.hardness,
                sourceModuleId: placement.moduleId,
                from,
                to,
                cells: hexRaycastInt(from, to)
            });
        }
    }
    return claims.sort((a, b) => a.id.localeCompare(b.id));
};

export const realizeSceneEvidence = (
    scene: NarrativeSceneRequest,
    plan: ModulePlan,
    arena: BaseArena
): { anchors: NarrativeAnchor[]; evidence: Array<{ id: string; tag: string; point: Point }> } => {
    const anchors: NarrativeAnchor[] = [];
    const evidence: Array<{ id: string; tag: string; point: Point }> = [];
    const preferredPoint = plan.placements[0]?.anchor || arena.center;
    anchors.push({
        id: `scene_anchor_${scene.motif}`,
        kind: scene.motif,
        point: preferredPoint
    });
    evidence.push({
        id: `evidence_primary_${scene.motif}`,
        tag: scene.motif,
        point: preferredPoint
    });
    if (scene.evidenceQuota > 1 && arena.shrinePosition) {
        evidence.push({
            id: `evidence_secondary_${scene.encounterPosture}`,
            tag: scene.encounterPosture,
            point: arena.shrinePosition
        });
    }
    return { anchors, evidence };
};
