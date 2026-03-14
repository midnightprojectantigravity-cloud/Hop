import { getGridForShape, pointToKey } from '../hex';
import { buildModuleRegistryIndex } from './modules';
import { hexDistanceInt } from './math/hex-int';
import type {
    AuthoredFloorFamilySpec,
    AuthoredFloorSpec,
    ClosedPathRequirement,
    GenerationMapShape,
    GenerationPoint,
    GenerationSpecInput,
    GenerationSpecLintFinding,
    ModuleRegistryIndex
} from './schema';
import { DEFAULT_WORLDGEN_SPEC } from './specs/default-worldgen-spec';

export interface GenerationBoardDefaults {
    width: number;
    height: number;
    mapShape: GenerationMapShape;
}

const DEFAULT_BOARD: GenerationBoardDefaults = {
    width: 9,
    height: 11,
    mapShape: 'diamond'
};

const resolveAnchors = (family: AuthoredFloorFamilySpec, floor?: AuthoredFloorSpec): Record<string, GenerationPoint> => ({
    ...(family.anchors || {}),
    ...(floor?.anchors || {})
});

const COMMON_PATH_TARGETS = ['entry', 'exit', 'shrine', 'primary_slot', 'secondary_slot', 'boss_anchor'];

const buildParityStressFinding = (
    familyId: string,
    requirement: ClosedPathRequirement,
    entry: GenerationPoint,
    exit: GenerationPoint
): GenerationSpecLintFinding | undefined => {
    const distance = hexDistanceInt(entry, exit);
    const requiresWiggle = (
        (distance % 2 === 1 && requirement.requiredParity === 'even')
        || (distance % 2 === 0 && requirement.requiredParity === 'odd')
    );
    if (!requiresWiggle) return undefined;
    return {
        code: 'SPEC_PARITY_STRESS',
        severity: 'error',
        familyId,
        anchorIds: [requirement.entryAnchorId, requirement.exitAnchorId],
        hexes: [entry, exit],
        message: `Closed path ${requirement.id} requires an extra parity wiggle between ${requirement.entryAnchorId} and ${requirement.exitAnchorId}.`
    };
};

const lintFamilyModules = (
    familyId: string,
    floor: AuthoredFloorSpec | undefined,
    family: AuthoredFloorFamilySpec,
    registry: ModuleRegistryIndex,
    boardKeys: Set<string>
): GenerationSpecLintFinding[] => {
    const findings: GenerationSpecLintFinding[] = [];
    const requiredTacticalTags = floor?.requiredTacticalTags || family.requiredTacticalTags || [];
    const requiredNarrativeTags = floor?.requiredNarrativeTags || family.requiredNarrativeTags || [];
    const modules = [...(family.pinnedModules || []), ...(floor?.pinnedModules || [])];
    const coveredTacticalTags = new Set<string>();
    const coveredNarrativeTags = new Set<string>();

    for (const placed of modules) {
        const entry = registry.entriesById[placed.id];
        if (!entry) {
            findings.push({
                code: 'SPEC_MODULE_CAPABILITY_MISMATCH',
                severity: 'error',
                familyId,
                hexes: [placed.anchor],
                message: `Pinned module ${placed.id} is not present in the registry.`
            });
            continue;
        }
        const footprintKeys = entry.footprint.map(local => `${placed.anchor.q + local.dq},${placed.anchor.r + local.dr}`);
        if (footprintKeys.some(key => !boardKeys.has(key))) {
            findings.push({
                code: 'SPEC_FOOTPRINT_OUT_OF_BOUNDS',
                severity: 'error',
                familyId,
                hexes: [placed.anchor],
                message: `Pinned module ${placed.id} exceeds the default board envelope.`
            });
        }
        entry.capability.tacticalTags.forEach(tag => coveredTacticalTags.add(tag));
        entry.capability.narrativeTags.forEach(tag => coveredNarrativeTags.add(tag));
    }

    const preferredModuleEntries = [...(floor?.preferredModuleIds || family.preferredModuleIds || [])]
        .map(moduleId => registry.entriesById[moduleId])
        .filter((entry): entry is ModuleRegistryIndex['entries'][number] => !!entry);
    preferredModuleEntries.forEach(entry => {
        entry.capability.tacticalTags.forEach(tag => coveredTacticalTags.add(tag));
        entry.capability.narrativeTags.forEach(tag => coveredNarrativeTags.add(tag));
    });

    for (const tag of requiredTacticalTags) {
        if (coveredTacticalTags.has(tag)) continue;
        findings.push({
            code: 'SPEC_MODULE_CAPABILITY_MISMATCH',
            severity: 'error',
            familyId,
            message: `Authored family ${familyId} has no pinned or preferred module that covers tactical tag ${tag}.`
        });
    }

    for (const tag of requiredNarrativeTags) {
        if (coveredNarrativeTags.has(tag)) continue;
        findings.push({
            code: 'SPEC_MODULE_CAPABILITY_MISMATCH',
            severity: 'error',
            familyId,
            message: `Authored family ${familyId} has no pinned or preferred module that covers narrative tag ${tag}.`
        });
    }

    return findings;
};

const lintPathOverrides = (
    familyId: string,
    floorNumber: number | undefined,
    family: AuthoredFloorFamilySpec,
    floor: AuthoredFloorSpec | undefined
): GenerationSpecLintFinding[] => {
    const findings: GenerationSpecLintFinding[] = [];
    const familyOverrides = family.pathOverrides || {};
    const floorOverrides = floor?.pathOverrides || {};
    const resolvedAnchors = resolveAnchors(family, floor);
    const validTargets = new Set<string>([
        ...COMMON_PATH_TARGETS,
        ...Object.keys(resolvedAnchors),
        ...(family.pinnedModules || []).map(placed => placed.id),
        ...(floor?.pinnedModules || []).map(placed => placed.id),
    ]);

    const validateSource = (
        sourceName: 'family' | 'floor',
        overrides: Record<string, { onPath?: boolean; pathOrder?: number }>
    ) => {
        for (const targetId of Object.keys(overrides).sort()) {
            if (validTargets.has(targetId)) continue;
            findings.push({
                code: 'SPEC_PATH_OVERRIDE_UNKNOWN_TARGET',
                severity: 'error',
                familyId,
                floor: floorNumber,
                anchorIds: [targetId],
                message: `${sourceName} path override targets unknown id ${targetId}.`
            });
        }
    };

    validateSource('family', familyOverrides);
    validateSource('floor', floorOverrides);

    for (const targetId of Object.keys(familyOverrides).sort()) {
        if (!(targetId in floorOverrides)) continue;
        const familyValue = familyOverrides[targetId];
        const floorValue = floorOverrides[targetId];
        if (JSON.stringify(familyValue) === JSON.stringify(floorValue)) continue;
        findings.push({
            code: 'SPEC_PATH_OVERRIDE_CONFLICT',
            severity: 'error',
            familyId,
            floor: floorNumber,
            anchorIds: [targetId],
            message: `Conflicting path overrides for ${targetId} between family ${familyId} and floor ${floorNumber}.`
        });
    }

    return findings;
};

export const lintGenerationSpecInput = (
    spec: GenerationSpecInput,
    registry: ModuleRegistryIndex = buildModuleRegistryIndex(),
    boardDefaults: GenerationBoardDefaults = DEFAULT_BOARD
): GenerationSpecLintFinding[] => {
    const findings: GenerationSpecLintFinding[] = [];
    const boardKeys = new Set(
        getGridForShape(boardDefaults.width, boardDefaults.height, boardDefaults.mapShape).map(pointToKey)
    );

    for (const [familyId, family] of Object.entries(spec.authoredFloorFamilies || {}).sort((a, b) => a[0].localeCompare(b[0]))) {
        const floorsUsingFamily = Object.entries(spec.floorFamilyAssignments || {})
            .filter(([, value]) => value === familyId)
            .map(([floorKey]) => Number(floorKey))
            .sort((a, b) => a - b);

        findings.push(...lintFamilyModules(familyId, undefined, family, registry, boardKeys));
        findings.push(...lintPathOverrides(familyId, floorsUsingFamily[0], family, undefined));

        const anchors = resolveAnchors(family);
        for (const requirement of family.closedPaths || []) {
            const entry = anchors[requirement.entryAnchorId];
            const exit = anchors[requirement.exitAnchorId];
            if (!entry || !exit) {
                findings.push({
                    code: 'SPEC_UNKNOWN_ANCHOR',
                    severity: 'error',
                    familyId,
                    floor: floorsUsingFamily[0],
                    anchorIds: [requirement.entryAnchorId, requirement.exitAnchorId],
                    message: `Closed path ${requirement.id} references an unknown anchor.`
                });
                continue;
            }
            const parityFinding = buildParityStressFinding(familyId, requirement, entry, exit);
            if (parityFinding) findings.push(parityFinding);
        }
    }

    for (const [floorKey, floor] of Object.entries(spec.authoredFloors || {}).sort((a, b) => Number(a[0]) - Number(b[0]))) {
        const floorNumber = Number(floorKey);
        const familyId = floor.floorFamilyId || spec.floorFamilyAssignments?.[floorNumber];
        const family = familyId ? spec.authoredFloorFamilies?.[familyId] : undefined;
        if (familyId && !family) {
            findings.push({
                code: 'SPEC_UNKNOWN_ANCHOR',
                severity: 'error',
                floor: floorNumber,
                message: `Floor ${floorNumber} references missing family ${familyId}.`
            });
            continue;
        }
        if (!family) continue;

        findings.push(...lintFamilyModules(familyId!, floor, family, registry, boardKeys));
        findings.push(...lintPathOverrides(familyId!, floorNumber, family, floor));

        const anchors = resolveAnchors(family, floor);
        for (const requirement of floor.closedPaths || family.closedPaths || []) {
            const entry = anchors[requirement.entryAnchorId];
            const exit = anchors[requirement.exitAnchorId];
            if (!entry || !exit) {
                findings.push({
                    code: 'SPEC_UNKNOWN_ANCHOR',
                    severity: 'error',
                    familyId,
                    floor: floorNumber,
                    anchorIds: [requirement.entryAnchorId, requirement.exitAnchorId],
                    message: `Floor ${floorNumber} closed path ${requirement.id} references an unknown anchor.`
                });
                continue;
            }
            const parityFinding = buildParityStressFinding(familyId!, requirement, entry, exit);
            if (parityFinding) findings.push({ ...parityFinding, floor: floorNumber });
        }
    }

    return findings.sort((a, b) =>
        (a.familyId || '').localeCompare(b.familyId || '')
        || (a.floor || 0) - (b.floor || 0)
        || a.code.localeCompare(b.code)
        || a.message.localeCompare(b.message)
    );
};

export const validateDefaultWorldgenSpec = (): GenerationSpecLintFinding[] =>
    lintGenerationSpecInput(DEFAULT_WORLDGEN_SPEC, buildModuleRegistryIndex(), DEFAULT_BOARD);

export const validateDefaultInfernoSpec = (): GenerationSpecLintFinding[] =>
    validateDefaultWorldgenSpec();
