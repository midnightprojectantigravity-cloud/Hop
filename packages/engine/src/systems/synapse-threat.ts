import type {
    Actor,
    GameState,
    Point,
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
const CONTESTED_HIGH_MIN = 1;
const DEADLY_MIN = 2;

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

const resolveMaxSkillRange = (actor: Actor): number => {
    const ranges = (actor.activeSkills || []).map(skill => {
        const def = SkillRegistry.get(skill.id);
        const slot = def?.slot || skill.slot;
        if (slot === 'passive') return 0;
        if (skill.id === 'BASIC_MOVE') return 0;
        if (def) return Math.max(0, Number(def.baseVariables.range || 0));
        return Math.max(0, Number(skill.range || 0));
    });
    if (ranges.length === 0) return 0;
    return Math.max(...ranges);
};

const buildPlayableCells = (state: GameState): Point[] => {
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
        deduped.set(pointToKey(tile), tile);
    }
    return [...deduped.values()].sort(byPoint);
};

export const computeActionReach = (actor: Actor): number => {
    const moveReach = Math.max(1, Number(actor.speed || 1));
    const maxSkillRange = resolveMaxSkillRange(actor);
    return moveReach + maxSkillRange;
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
        .filter(entry => entry.isHostileToPlayer && entry.zScore >= 0)
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
    sources: SynapseThreatSource[]
): SynapseThreatTile => {
    const contributorIds: string[] = [];
    let heat = 0;

    for (const source of sources) {
        if (source.emitterWeight <= 0) continue;
        if (hexDistance(source.position, tile) > source.actionReach) continue;
        heat += source.emitterWeight;
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
    const tiles = cells.map(tile => computeTileThreat(tile, sources));

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

