import type { AtomicEffect, Entity, GameState, PendingFrameType } from './types';
import { hexEquals, getNeighbors } from './hex';
import { checkShrine, checkStairs } from './helpers';
import { SkillRegistry } from './skillRegistry';
import { applyEffects } from './systems/effect-engine';
import { addUpgrade, increaseMaxHp } from './systems/entities/actor';
import { tickTileEffects } from './systems/tiles/tile-tick';
import { consumeRandom } from './systems/rng';
import { buildRunSummary } from './systems/run-objectives';
import { UnifiedTileService } from './systems/tiles/unified-tile-service';
import { appendTaggedMessage } from './systems/engine-messages';
import { resetCooldownsForFreeMove } from './systems/free-move';
import { ensureActorTrinity } from './systems/entities/entity-factory';
import { ensurePlayerLoadoutIntegrity } from './systems/loadout';
import { buildInitiativeQueue } from './systems/initiative';
import { SpatialSystem } from './systems/spatial-system';
import { resolveAcaeRuleset } from './systems/ailments/runtime';

type PendingFrameStateBuilder = (
    state: GameState,
    pendingStatus: NonNullable<GameState['pendingStatus']>,
    frameType: PendingFrameType,
    framePayload?: Record<string, unknown>
) => GameState;

type GenerateInitialStateFn = (
    floor?: number,
    seed?: string,
    initialSeed?: string,
    preservePlayer?: any,
    loadout?: any
) => GameState;

export const hydrateLoadedState = (loaded: GameState): GameState => {
    if (Array.isArray(loaded.tiles)) {
        loaded.tiles = new Map(
            loaded.tiles.map(([key, tile]: [string, any]) => [
                key,
                {
                    ...tile,
                    traits: new Set(tile.traits),
                }
            ])
        );
    }
    loaded.player = ensurePlayerLoadoutIntegrity(ensureActorTrinity(loaded.player));
    loaded.enemies = (loaded.enemies || []).map(ensureActorTrinity);
    if (loaded.companions) {
        loaded.companions = loaded.companions.map(ensureActorTrinity);
    }
    loaded.ruleset = resolveAcaeRuleset(loaded);
    return loaded;
};

export const resolveSelectUpgradeAction = (s: GameState, upgradeId: string): GameState => {
    const offered = s.pendingStatus?.shrineOptions || s.shrineOptions || [];
    if (!offered.includes(upgradeId)) {
        return {
            ...s,
            message: appendTaggedMessage(s.message, `Upgrade ${upgradeId} was not offered.`, 'CRITICAL', 'SYSTEM')
        };
    }

    let player = s.player;
    let applied = false;
    const upgradeDef = SkillRegistry.getUpgrade(upgradeId);
    if (upgradeDef) {
        const skillId = SkillRegistry.getSkillForUpgrade(upgradeId);
        const ownsSkill = !!skillId && player.activeSkills.some(sk => sk.id === skillId);
        if (skillId && ownsSkill) {
            const beforeSerialized = JSON.stringify(player.activeSkills);
            player = addUpgrade(player, skillId, upgradeId);
            applied = JSON.stringify(player.activeSkills) !== beforeSerialized;
        }
    } else if (upgradeId === 'EXTRA_HP') {
        player = increaseMaxHp(player, 1, true);
        applied = true;
    }

    if (!applied && upgradeId !== 'EXTRA_HP') {
        return {
            ...s,
            message: appendTaggedMessage(s.message, `Upgrade ${upgradeId} could not be applied.`, 'CRITICAL', 'SYSTEM')
        };
    }

    return {
        ...s,
        player,
        upgrades: s.upgrades.includes(upgradeId) ? s.upgrades : [...s.upgrades, upgradeId],
        gameStatus: 'playing',
        shrinePosition: undefined,
        shrineOptions: undefined,
        pendingStatus: undefined,
        pendingFrames: undefined,
        message: appendTaggedMessage(s.message, `Gained ${upgradeDef?.name || upgradeId}!`, 'INFO', 'OBJECTIVE')
    };
};

export const resolvePendingStateAction = (
    s: GameState,
    deps: { generateInitialState: GenerateInitialStateFn }
): GameState => {
    const pendingFrames = s.pendingFrames || [];
    if (pendingFrames.length > 1) {
        return {
            ...s,
            pendingFrames: pendingFrames.slice(1)
        };
    }
    if (!s.pendingStatus) {
        if (pendingFrames.length === 1) {
            return {
                ...s,
                pendingFrames: []
            };
        }
        return s;
    }

    const { status, shrineOptions, completedRun } = s.pendingStatus;
    if (status === 'playing' && s.gameStatus === 'playing') {
        const baseSeed = s.initialSeed ?? s.rngSeed ?? '0';
        const nextSeed = `${baseSeed}:${s.floor + 1}`;
        const migratingSummons = s.enemies
            .filter(e => e.hp > 0 && e.factionId === 'player' && e.companionOf === s.player.id)
            .sort((a, b) => a.id.localeCompare(b.id));
        const next = deps.generateInitialState(s.floor + 1, nextSeed, baseSeed, {
            ...s.player,
            hp: Math.min(s.player.maxHp, s.player.hp + 1),
            upgrades: s.upgrades,
        });
        next.ruleset = resolveAcaeRuleset({
            ...next,
            ruleset: s.ruleset || next.ruleset
        });
        if (migratingSummons.length > 0) {
            const candidates = [next.player.position, ...getNeighbors(next.player.position)];
            const occupied: Entity[] = [next.player, ...next.enemies];
            const migrated: Entity[] = [];

            for (let i = 0; i < migratingSummons.length; i++) {
                const summon = migratingSummons[i];
                const fallback = candidates[candidates.length - 1] || next.player.position;
                const spawnPos = candidates.find(pos => {
                    const unoccupied = !occupied.some(a => hexEquals(a.position, pos));
                    return unoccupied && UnifiedTileService.isWalkable(next, pos);
                }) || fallback;
                const migratedSummon: Entity = {
                    ...summon,
                    position: spawnPos,
                    previousPosition: spawnPos
                };
                occupied.push(migratedSummon);
                migrated.push(migratedSummon);
            }

            next.enemies = [...next.enemies, ...migrated];
            next.companions = [
                ...(next.companions || []),
                ...migrated.filter(e => e.companionOf === s.player.id)
            ];
            next.initiativeQueue = buildInitiativeQueue(next);
            next.occupancyMask = SpatialSystem.refreshOccupancyMask(next);
        }
        return {
            ...next,
            actionLog: [...(s.actionLog || [])],
            dailyRunDate: s.dailyRunDate,
            runObjectives: s.runObjectives,
            hazardBreaches: s.hazardBreaches || 0,
            pendingFrames: undefined
        };
    }

    return {
        ...s,
        gameStatus: status,
        shrineOptions: shrineOptions || s.shrineOptions,
        completedRun: completedRun || (s as any).completedRun,
        pendingStatus: undefined,
        pendingFrames: undefined
    };
};

export const applyPlayerEndOfTurnRules = (
    state: GameState,
    actorStepId: string,
    deps: { withPendingFrame: PendingFrameStateBuilder }
): { state: GameState; messages: string[]; haltTurnLoop: boolean } => {
    let curState = state;
    const messages: string[] = [];
    const playerPos = curState.player.position;

    if (curState.spearPosition && hexEquals(playerPos, curState.spearPosition)) {
        const spearSkill = curState.player.activeSkills?.find(s => s.id === 'SPEAR_THROW');
        const hasSpearCleave = !!spearSkill?.activeUpgrades?.some(up => up === 'SPEAR_CLEAVE' || up === 'CLEAVE');
        if (hasSpearCleave) {
            const cleaveTargets = getNeighbors(playerPos)
                .map(pos => curState.enemies.find(e => e.hp > 0 && hexEquals(e.position, pos)))
                .filter((e): e is Entity => !!e && e.factionId !== curState.player.factionId);
            if (cleaveTargets.length > 0) {
                const cleaveEffects: AtomicEffect[] = cleaveTargets.map(e => ({
                    type: 'Damage',
                    target: e.id,
                    amount: 1,
                    reason: 'spear_cleave_pickup'
                }));
                curState = applyEffects(curState, cleaveEffects, { sourceId: curState.player.id, stepId: actorStepId });
                messages.push(`Spear cleave hit ${cleaveTargets.length} target(s).`);
            }
        }
        curState = {
            ...curState,
            hasSpear: true,
            spearPosition: undefined,
            message: appendTaggedMessage(curState.message, 'Picked up your spear.', 'INFO', 'OBJECTIVE')
        };
    }

    const tileTickResult = tickTileEffects(curState);
    curState = tileTickResult.state;
    messages.push(...tileTickResult.messages);

    curState = { ...curState, turnNumber: curState.turnNumber + 1, turnsSpent: (curState.turnsSpent || 0) + 1 };
    if (curState.traps && curState.traps.length > 0) {
        curState = {
            ...curState,
            traps: curState.traps.map(t => ({
                ...t,
                cooldown: Math.max(0, t.cooldown - 1)
            }))
        };
    }

    curState = resetCooldownsForFreeMove(curState);

    if (checkShrine(curState, curState.player.position)) {
        const playerSkills = curState.player.activeSkills || [];
        const playerSkillIds = new Set(playerSkills.map(s => s.id));
        const appliedBySkill = new Map<string, Set<string>>();
        for (const sk of playerSkills) {
            appliedBySkill.set(sk.id, new Set(sk.activeUpgrades || []));
        }
        const available = SkillRegistry.getAllUpgrades()
            .filter(u => playerSkillIds.has(u.skillId))
            .filter(u => {
                if (curState.upgrades.includes(u.id)) return false;
                const owned = appliedBySkill.get(u.skillId);
                return !owned || !owned.has(u.id);
            })
            .map(u => u.id)
            .filter((id, idx, arr) => arr.indexOf(id) === idx);
        const picked: string[] = [];
        let rngState = { ...curState };
        for (let i = 0; i < 3 && available.length > 0; i++) {
            const res = consumeRandom(rngState);
            rngState = res.nextState;
            const idx = Math.floor(res.value * available.length);
            picked.push(available[idx]);
            available.splice(idx, 1);
        }
        const shrineOptions = picked.length > 0 ? picked : ['EXTRA_HP'];
        return {
            state: deps.withPendingFrame(
                {
                    ...curState,
                    rngCounter: rngState.rngCounter,
                    message: appendTaggedMessage(curState.message, 'A holy shrine! Choose an upgrade.', 'INFO', 'OBJECTIVE')
                },
                {
                    status: 'choosing_upgrade',
                    shrineOptions
                },
                'SHRINE_CHOICE',
                { shrineOptions }
            ),
            messages,
            haltTurnLoop: true
        };
    }

    if (checkStairs(curState, curState.player.position)) {
        const arcadeMax = 10;
        if (curState.floor >= arcadeMax) {
            const completedRun = buildRunSummary(curState);
            return {
                state: deps.withPendingFrame(
                    {
                        ...curState,
                        message: appendTaggedMessage(curState.message, `Arcade Cleared! Final Score: ${completedRun.score}`, 'INFO', 'OBJECTIVE')
                    },
                    {
                        status: 'won',
                        completedRun
                    },
                    'RUN_WON',
                    { score: completedRun.score ?? 0 }
                ),
                messages,
                haltTurnLoop: true
            };
        }

        return {
            state: deps.withPendingFrame(
                {
                    ...curState,
                    message: appendTaggedMessage(curState.message, 'Descending to the next level...', 'INFO', 'OBJECTIVE')
                },
                {
                    status: 'playing',
                },
                'STAIRS_TRANSITION',
                { nextFloor: curState.floor + 1 }
            ),
            messages,
            haltTurnLoop: true
        };
    }

    return {
        state: curState,
        messages,
        haltTurnLoop: false
    };
};
