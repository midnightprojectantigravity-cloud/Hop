import type {
    Actor,
    GameState,
    Point,
    Skill,
    SynapseThreatBand,
    SynapseThreatPreview,
    SynapseThreatSource,
    SynapseThreatTile,
    UnifiedPowerScoreEntry
} from '../types';
import { hexDistance, isTileInDiamond, pointToKey } from '../hex';
import { SkillRegistry } from '../skillRegistry';
import { computeRelativeThreatScores } from './threat-scoring';

const DEAD_ZONE_Z_MIN = 0.25;
// Heat bands tuned for 4-tier readability:
// - 0 => safe (white)
// - 1 => contested_low (orange)
// - 2..4 => contested_high (red)
// - 5+ => deadly (black)
const CONTESTED_HIGH_MIN = 2;
const DEADLY_MIN = 5;
const SYNAPSE_GHOST_PREFIX = '__synapse_probe__';

const byPoint = (a: Point, b: Point): number => {
    if (a.q !== b.q) return a.q - b.q;
    if (a.r !== b.r) return a.r - b.r;
    return a.s - b.s;
};

const round4 = (value: number): number => Number(value.toFixed(4));

const resolveTileBand = (heat: number): SynapseThreatBand => {
    if (heat <= 0) return 'safe';
    if (heat < CONTESTED_HIGH_MIN) return 'contested_low';
    if (heat < DEADLY_MIN) return 'contested_high';
    return 'deadly';
};

// Banding semantics:
// - low-danger source contributes 1 threat unit
// - high/extreme source contributes 2 threat units (deadly by itself)
const resolveThreatUnit = (source: SynapseThreatSource): number =>
    source.sigmaTier === 'high' || source.sigmaTier === 'extreme' ? 2 : 1;

const resolveSkillDefinition = (skill: Skill) => SkillRegistry.get(skill.id);

const resolveSkillSlot = (skill: Skill): string => {
    const definition = resolveSkillDefinition(skill);
    return definition?.slot || skill.slot || 'utility';
};

const isThreatSkill = (skill: Skill): boolean => {
    if (skill.id === 'BASIC_MOVE') return false;
    if (skill.id === 'BASIC_ATTACK') return true;
    const definition = resolveSkillDefinition(skill);
    if (!definition) {
        return resolveSkillSlot(skill) !== 'passive';
    }
    const intentTags = definition.intentProfile?.intentTags || [];
    if (intentTags.includes('damage') || intentTags.includes('hazard')) return true;
    return resolveSkillSlot(skill) !== 'passive';
};

const resolveSkillRange = (skill: Skill): number => {
    const definition = resolveSkillDefinition(skill);
    if (definition) return Math.max(0, Number(definition.baseVariables.range || 0));
    return Math.max(0, Number(skill.range || 0));
};

const resolveMaxSkillRange = (actor: Actor): number => {
    const ranges = (actor.activeSkills || [])
        .filter(isThreatSkill)
        .map(resolveSkillRange);
    if (ranges.length === 0) return 0;
    return Math.max(...ranges);
};

const buildOccupiedTileKeySet = (
    state: GameState,
    options?: { includePlayer?: boolean }
): Set<string> => {
    const occupied = new Set<string>();
    if (options?.includePlayer !== false) {
        occupied.add(pointToKey(state.player.position));
    }
    for (const enemy of state.enemies) {
        if (enemy.hp <= 0) continue;
        occupied.add(pointToKey(enemy.position));
    }
    for (const companion of state.companions || []) {
        if (companion.hp <= 0) continue;
        occupied.add(pointToKey(companion.position));
    }
    return occupied;
};

const buildPlayableCells = (state: GameState): Point[] => {
    // Keep the player's current tile in the heatmap so Synapse/INFO always reflects
    // the danger state of the tile the player is standing on.
    const occupiedTileKeys = buildOccupiedTileKeySet(state, { includePlayer: false });
    const roomHexes = state.rooms?.[0]?.hexes || [];
    const raw = roomHexes.length > 0
        ? roomHexes
        : (() => {
            const generated: Point[] = [];
            for (let q = 0; q < state.gridWidth; q++) {
                for (let r = 0; r < state.gridHeight; r++) {
                    generated.push({ q, r, s: -q - r });
                }
            }
            return generated;
        })();

    const deduped = new Map<string, Point>();
    for (const tile of raw) {
        if (!isTileInDiamond(tile.q, tile.r, state.gridWidth, state.gridHeight)) continue;
        const key = pointToKey(tile);
        if (occupiedTileKeys.has(key)) continue;
        deduped.set(key, tile);
    }
    return [...deduped.values()].sort(byPoint);
};

export const computeActionReach = (actor: Actor): number => {
    // Synapse danger projects damage threat only. If a unit can either move or attack,
    // movement does not extend immediate damage range for this overlay.
    const maxSkillRange = resolveMaxSkillRange(actor);
    return Math.max(0, maxSkillRange);
};

const buildSynapseProbeState = (
    state: GameState,
    source: Actor,
    tile: Point
): GameState => {
    const ghostId = `${SYNAPSE_GHOST_PREFIX}:${source.id}:${tile.q},${tile.r},${tile.s}`;
    const hostileFactionId = source.factionId === state.player.factionId ? 'enemy' : state.player.factionId;
    const ghost: Actor = {
        ...state.player,
        id: ghostId,
        type: source.type === 'enemy' ? 'player' : 'enemy',
        subtype: 'synapse_probe',
        factionId: hostileFactionId,
        position: tile,
        hp: 1,
        maxHp: 1,
        speed: 1,
        activeSkills: [],
        statusEffects: [],
        temporaryArmor: 0
    };

    return {
        ...state,
        enemies: [...state.enemies, ghost]
    };
};

const collectThreatenedTileKeys = (
    state: GameState,
    actor: Actor,
    playableCells: Point[]
): Set<string> => {
    const threatenedKeys = new Set<string>();
    const playableByKey = new Map<string, Point>();
    for (const cell of playableCells) {
        playableByKey.set(pointToKey(cell), cell);
    }

    for (const skill of actor.activeSkills || []) {
        if (!isThreatSkill(skill)) continue;
        const definition = resolveSkillDefinition(skill);
        if (definition?.getValidTargets) {
            const directTargets = definition.getValidTargets(state, actor.position) || [];
            for (const directTarget of directTargets) {
                const key = pointToKey(directTarget);
                if (playableByKey.has(key)) threatenedKeys.add(key);
            }

            for (const cell of playableCells) {
                const cellKey = pointToKey(cell);
                if (threatenedKeys.has(cellKey)) continue;
                const probeState = buildSynapseProbeState(state, actor, cell);
                const probeTargets = definition.getValidTargets(probeState, actor.position) || [];
                if (probeTargets.some(target => pointToKey(target) === cellKey)) {
                    threatenedKeys.add(cellKey);
                }
            }
            continue;
        }

        const range = resolveSkillRange(skill);
        if (range <= 0) continue;
        for (const cell of playableCells) {
            const distance = hexDistance(actor.position, cell);
            if (distance < 1 || distance > range) continue;
            threatenedKeys.add(pointToKey(cell));
        }
    }

    return threatenedKeys;
};

const resolveHostileSources = (
    state: GameState,
    unitScores: UnifiedPowerScoreEntry[]
): SynapseThreatSource[] => {
    const actorById = new Map<string, Actor>();
    for (const enemy of state.enemies) {
        if (enemy.hp <= 0) continue;
        actorById.set(enemy.id, enemy);
    }

    return unitScores
        .filter(entry => entry.isHostileToPlayer)
        .map(entry => {
            const actor = actorById.get(entry.actorId);
            if (!actor) return null;
            const actionReach = computeActionReach(actor);
            const emitterWeight = entry.zScore >= DEAD_ZONE_Z_MIN ? entry.zScore : 0;
            return {
                actorId: actor.id,
                position: actor.position,
                actionReach,
                ups: entry.ups,
                zScore: entry.zScore,
                sigmaTier: entry.sigmaTier,
                emitterWeight: round4(emitterWeight)
            } as SynapseThreatSource;
        })
        .filter((source): source is SynapseThreatSource => !!source)
        .sort((a, b) => a.actorId.localeCompare(b.actorId));
};

const computeTileThreat = (
    tile: Point,
    sources: SynapseThreatSource[],
    threatenedTilesBySourceId: Map<string, Set<string>>
): SynapseThreatTile => {
    const contributorIds: string[] = [];
    let heat = 0;
    const tileKey = pointToKey(tile);

    for (const source of sources) {
        const threatenedTiles = threatenedTilesBySourceId.get(source.actorId);
        if (!threatenedTiles?.has(tileKey)) continue;
        heat += resolveThreatUnit(source);
        contributorIds.push(source.actorId);
    }

    const roundedHeat = round4(heat);
    return {
        tile,
        heat: roundedHeat,
        band: resolveTileBand(roundedHeat),
        sourceActorIds: contributorIds.sort((a, b) => a.localeCompare(b))
    };
};

export const buildSynapseThreatPreview = (state: GameState): SynapseThreatPreview => {
    const relative = computeRelativeThreatScores(state);
    const cells = buildPlayableCells(state);
    const sources = resolveHostileSources(state, relative.entries);
    const actorById = new Map<string, Actor>();
    for (const enemy of state.enemies) {
        if (enemy.hp <= 0) continue;
        actorById.set(enemy.id, enemy);
    }
    const threatenedTilesBySourceId = new Map<string, Set<string>>();
    for (const source of sources) {
        const actor = actorById.get(source.actorId);
        if (!actor) {
            threatenedTilesBySourceId.set(source.actorId, new Set<string>());
            continue;
        }
        threatenedTilesBySourceId.set(
            source.actorId,
            collectThreatenedTileKeys(state, actor, cells)
        );
    }
    const tiles = cells.map(tile => computeTileThreat(tile, sources, threatenedTilesBySourceId));

    return {
        sourceTurn: state.turnNumber,
        playerScore: relative.playerScore,
        sigmaRef: relative.sigmaRef,
        unitScores: relative.entries,
        sources,
        tiles,
        bandThresholds: {
            contestedHighMin: CONTESTED_HIGH_MIN,
            deadlyMin: DEADLY_MIN,
            deadZoneZMin: DEAD_ZONE_Z_MIN
        }
    };
};
