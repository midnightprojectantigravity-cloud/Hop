import { describe, expect, it } from 'vitest';
import { createHex, getNeighbors, hexDistance, hexEquals, pointToKey } from '../hex';
import { gameReducer, generateHubState, generateInitialState } from '../logic';
import { createActiveSkill, SkillRegistry } from '../skillRegistry';
import { buildIntentPreview } from '../systems/telegraph-projection';
import { createEnemy } from '../systems/entities/entity-factory';
import { BASE_TILES } from '../systems/tiles/tile-registry';
import { recomputeVisibility } from '../systems/visibility';
import { computeStandardVisionRange } from '../skills/standard_vision';
import { computeEnemyButcherFactor } from '../skills/enemy_awareness';
import { isFreeMoveMode, resolveFreeMoveInterruption } from '../systems/free-move';

const withTrinity = (state: any, actorId: string, trinity: { body: number; mind: number; instinct: number }) => {
    const actor = actorId === state.player.id
        ? state.player
        : state.enemies.find((enemy: any) => enemy.id === actorId);
    if (!actor) return state;

    const existingEntries: Array<[string, any]> = actor.components instanceof Map
        ? Array.from(actor.components.entries())
        : [];
    const nextActor = {
        ...actor,
        components: new Map<string, any>([
            ...existingEntries.filter(([key]) => key !== 'trinity'),
            ['trinity', { type: 'trinity', ...trinity }]
        ])
    };

    if (actorId === state.player.id) {
        state.player = nextActor;
    } else {
        state.enemies = state.enemies.map((enemy: any) => enemy.id === actorId ? nextActor : enemy);
    }
    return state;
};

describe('visibility system', () => {
    it('scales standard vision by tier + weighted stat pool', () => {
        const state = generateInitialState(1, 'visibility-standard-vision-tier');
        state.player.activeSkills = [createActiveSkill('STANDARD_VISION') as any];
        withTrinity(state, state.player.id, { body: 0, mind: 0, instinct: 0 });
        expect(computeStandardVisionRange(state.player)).toBe(5);

        state.player.activeSkills = state.player.activeSkills.map((skill: any) => ({
            ...skill,
            activeUpgrades: ['VISION_TIER_2', 'VISION_TIER_3']
        }));
        withTrinity(state, state.player.id, { body: 10, mind: 10, instinct: 10 });
        expect(computeStandardVisionRange(state.player)).toBe(9);
    });

    it('does not lock vision to mind-only builds', () => {
        const state = generateInitialState(1, 'visibility-not-mind-locked');
        state.player.activeSkills = [createActiveSkill('STANDARD_VISION') as any];

        withTrinity(state, state.player.id, { body: 20, mind: 0, instinct: 0 });
        const bodyRange = computeStandardVisionRange(state.player);

        withTrinity(state, state.player.id, { body: 0, mind: 20, instinct: 0 });
        const mindRange = computeStandardVisionRange(state.player);

        withTrinity(state, state.player.id, { body: 0, mind: 0, instinct: 20 });
        const instinctRange = computeStandardVisionRange(state.player);

        expect(bodyRange).toBe(mindRange);
        expect(mindRange).toBe(instinctRange);
    });

    it('weights butcher factor toward instinct in enemy awareness', () => {
        const bodyEnemy = createEnemy({
            id: 'enemy-body',
            subtype: 'footman',
            position: createHex(2, 2),
            speed: 1,
            skills: ['BASIC_MOVE']
        });
        bodyEnemy.components = new Map([
            ['trinity', { type: 'trinity', body: 12, mind: 0, instinct: 0 }]
        ]);

        const instinctEnemy = createEnemy({
            id: 'enemy-instinct',
            subtype: 'footman',
            position: createHex(3, 3),
            speed: 1,
            skills: ['BASIC_MOVE']
        });
        instinctEnemy.components = new Map([
            ['trinity', { type: 'trinity', body: 0, mind: 0, instinct: 12 }]
        ]);

        expect(computeEnemyButcherFactor(instinctEnemy)).toBeGreaterThan(computeEnemyButcherFactor(bodyEnemy));
    });

    it('tracks unseen -> visible -> explored tiles deterministically', () => {
        let state = generateInitialState(1, 'visibility-fow-transition');
        state = recomputeVisibility(state);
        const originKey = pointToKey(state.player.position);
        expect(state.visibility?.playerFog.visibleTileKeys).toContain(originKey);
        expect(state.visibility?.playerFog.exploredTileKeys).toContain(originKey);

        const farthestWalkable = Array.from(state.tiles.values())
            .map(tile => tile.position)
            .sort((a, b) => hexDistance(state.player.position, b) - hexDistance(state.player.position, a))[0];
        state.player = {
            ...state.player,
            previousPosition: state.player.position,
            position: farthestWalkable
        };
        state = recomputeVisibility(state);
        expect(state.visibility?.playerFog.exploredTileKeys).toContain(originKey);
    });

    it('keeps non-visual detection out of terrain reveal', () => {
        let state = generateInitialState(1, 'visibility-non-visual-detection');
        const origin = createHex(3, 8);
        const target = createHex(3, 4);
        state.player = {
            ...state.player,
            position: origin,
            activeSkills: [createActiveSkill('STANDARD_VISION') as any, createActiveSkill('VIBRATION_SENSE') as any],
            components: new Map([
                ['trinity', { type: 'trinity', body: 0, mind: 0, instinct: 40 }]
            ])
        };
        const enemy = createEnemy({
            id: 'sense-detected',
            subtype: 'footman',
            position: target,
            hp: 3,
            maxHp: 3,
            speed: 1,
            skills: ['BASIC_MOVE']
        });
        enemy.previousPosition = createHex(3, 5);
        state.enemies = [enemy];

        const wallKey = pointToKey(createHex(3, 6));
        const wallBase = BASE_TILES.WALL;
        state.tiles.set(wallKey, {
            baseId: 'WALL',
            position: createHex(3, 6),
            traits: new Set(wallBase.defaultTraits),
            effects: []
        });

        state = recomputeVisibility(state);
        const fog = state.visibility!.playerFog;
        expect(fog.detectedActorIds).toContain(enemy.id);
        expect(fog.visibleActorIds).not.toContain(enemy.id);
        expect(fog.visibleTileKeys).not.toContain(pointToKey(enemy.position));
    });

    it('hides hostile telegraphs when enemy is not visually seen', () => {
        let state = generateInitialState(1, 'visibility-hidden-intent');
        const enemy = createEnemy({
            id: 'telegraph-hidden',
            subtype: 'footman',
            position: createHex(state.player.position.q + 1, state.player.position.r),
            hp: 3,
            maxHp: 3,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK']
        });
        state.player = {
            ...state.player,
            activeSkills: [createActiveSkill('STANDARD_VISION') as any],
            statusEffects: [{
                id: 'BLINDED',
                type: 'blinded',
                duration: 1,
                tickWindow: 'END_OF_TURN'
            }]
        };
        state.enemies = [enemy];
        state = recomputeVisibility(state);
        const preview = buildIntentPreview(state);
        expect(preview.projections.some(entry => entry.actorId === enemy.id)).toBe(false);
    });

    it('decays enemy awareness memory after butcher-window expires', () => {
        let state = generateInitialState(1, 'visibility-enemy-memory-decay');
        const enemy = createEnemy({
            id: 'memory-enemy',
            subtype: 'footman',
            position: createHex(state.player.position.q + 1, state.player.position.r),
            hp: 3,
            maxHp: 3,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK']
        });
        state.enemies = [enemy];
        state = recomputeVisibility(state);
        const first = state.visibility?.enemyAwarenessById?.[enemy.id];
        expect((first?.memoryTurnsRemaining || 0)).toBeGreaterThan(0);
        expect(first?.lastKnownPlayerPosition).toBeTruthy();

        state.player = {
            ...state.player,
            position: createHex(state.player.position.q + 30, state.player.position.r + 30)
        };
        state.turnNumber += 12;
        state = recomputeVisibility(state);
        const decayed = state.visibility?.enemyAwarenessById?.[enemy.id];
        expect(decayed?.memoryTurnsRemaining).toBe(0);
        expect(decayed?.lastKnownPlayerPosition).toBeNull();
    });

    it('guarantees player core vision and enemy awareness in active runs', () => {
        const hub = generateHubState();
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'VANGUARD',
                seed: 'visibility-core-vision'
            }
        });
        expect(run.player.activeSkills.some(skill => skill.id === 'STANDARD_VISION')).toBe(true);
        expect(run.enemies.every(enemy => enemy.activeSkills.some(skill => skill.id === 'ENEMY_AWARENESS'))).toBe(true);
    });

    it('normalizes legacy loaded snapshots for visibility + awareness integrity', () => {
        const baseline = generateInitialState(1, 'visibility-hydrate-legacy');
        const legacySnapshot = {
            ...baseline,
            visibility: undefined,
            player: {
                ...baseline.player,
                activeSkills: baseline.player.activeSkills.filter(skill => skill.id !== 'STANDARD_VISION')
            },
            enemies: baseline.enemies.map(enemy => ({
                ...enemy,
                activeSkills: enemy.activeSkills.filter(skill => skill.id !== 'ENEMY_AWARENESS')
            }))
        };

        const loaded = gameReducer(generateHubState(), {
            type: 'LOAD_STATE',
            payload: legacySnapshot as any
        });

        expect(loaded.visibility).toBeTruthy();
        expect(loaded.player.activeSkills.some(skill => skill.id === 'STANDARD_VISION')).toBe(true);
        expect(loaded.enemies.every(enemy => enemy.activeSkills.some(skill => skill.id === 'ENEMY_AWARENESS'))).toBe(true);
    });

    it('keeps visibility snapshots deterministic for identical seed + inputs', () => {
        let runA = gameReducer(generateHubState(), {
            type: 'START_RUN',
            payload: {
                loadoutId: 'VANGUARD',
                seed: 'visibility-determinism'
            }
        });
        let runB = gameReducer(generateHubState(), {
            type: 'START_RUN',
            payload: {
                loadoutId: 'VANGUARD',
                seed: 'visibility-determinism'
            }
        });

        for (let i = 0; i < 4; i++) {
            runA = gameReducer(runA, { type: 'WAIT' });
            runB = gameReducer(runB, { type: 'WAIT' });
        }

        expect(runA.visibility).toEqual(runB.visibility);
        expect(runA.intentPreview).toEqual(runB.intentPreview);
        expect(runA.rngCounter).toBe(runB.rngCounter);
    });

    it('enables free move while hostiles are alive but still unaware', () => {
        let state = generateInitialState(1, 'free-move-unaware-hostiles');
        const farTile = Array.from(state.tiles.values())
            .map(tile => tile.position)
            .sort((a, b) => hexDistance(state.player.position, b) - hexDistance(state.player.position, a))[0];
        const enemy = createEnemy({
            id: 'free-move-unaware-enemy',
            subtype: 'footman',
            position: farTile,
            hp: 3,
            maxHp: 3,
            speed: 1,
            skills: ['BASIC_MOVE']
        });
        enemy.previousPosition = farTile;
        enemy.components = new Map([
            ['trinity', { type: 'trinity', body: 0, mind: 0, instinct: 0 }]
        ]);
        state.enemies = [enemy];
        state = recomputeVisibility(state);

        expect(state.visibility?.enemyAwarenessById?.[enemy.id]?.memoryTurnsRemaining).toBe(0);
        expect(isFreeMoveMode(state)).toBe(true);
    });

    it('disables free move once a hostile has noticed the player', () => {
        let state = generateInitialState(1, 'free-move-aware-hostiles');
        const adjacent = getNeighbors(state.player.position).find(pos => state.tiles.has(pointToKey(pos))) || state.player.position;
        const enemy = createEnemy({
            id: 'free-move-aware-enemy',
            subtype: 'footman',
            position: adjacent,
            hp: 3,
            maxHp: 3,
            speed: 1,
            skills: ['BASIC_MOVE']
        });
        enemy.previousPosition = adjacent;
        enemy.components = new Map([
            ['trinity', { type: 'trinity', body: 0, mind: 0, instinct: 0 }]
        ]);
        state.enemies = [enemy];
        state = recomputeVisibility(state);

        expect((state.visibility?.enemyAwarenessById?.[enemy.id]?.memoryTurnsRemaining || 0)).toBeGreaterThan(0);
        expect(isFreeMoveMode(state)).toBe(false);
    });

    it('interrupts long free move traversal when the player gets spotted mid-path', () => {
        let base = generateInitialState(1, 'free-move-interrupt-spotted');
        base = recomputeVisibility({
            ...base,
            enemies: []
        });
        const moveDef = SkillRegistry.get('BASIC_MOVE');
        expect(moveDef).toBeTruthy();

        const candidateTargets = moveDef!.getValidTargets?.(base, base.player.position) || [];
        const target = candidateTargets
            .sort((a, b) => hexDistance(base.player.position, b) - hexDistance(base.player.position, a))[0];
        expect(target).toBeTruthy();

        const freeMoveExecution = moveDef!.execute(base, base.player, target);
        const freeMoveDisplacement = freeMoveExecution.effects.find(effect => effect.type === 'Displacement');
        expect(freeMoveDisplacement?.type).toBe('Displacement');
        const plannedPath = (freeMoveDisplacement as any)?.path || [];
        expect(plannedPath.length).toBeGreaterThan(2);

        let spottingEnemyPosition: any = null;
        for (let i = 2; i < plannedPath.length; i++) {
            const step = plannedPath[i];
            spottingEnemyPosition = getNeighbors(step).find(pos =>
                base.tiles.has(pointToKey(pos))
                && !plannedPath.some((pathHex: any) => hexEquals(pathHex, pos))
                && hexDistance(base.player.position, pos) > 4
            );
            if (spottingEnemyPosition) break;
        }
        expect(spottingEnemyPosition).toBeTruthy();

        const enemy = createEnemy({
            id: 'spotter',
            subtype: 'footman',
            position: spottingEnemyPosition,
            hp: 3,
            maxHp: 3,
            speed: 1,
            skills: ['BASIC_MOVE']
        });
        enemy.previousPosition = spottingEnemyPosition;
        enemy.components = new Map([
            ['trinity', { type: 'trinity', body: 0, mind: 0, instinct: 0 }]
        ]);

        const withEnemy = recomputeVisibility({
            ...base,
            enemies: [enemy]
        });
        expect(isFreeMoveMode(withEnemy)).toBe(true);

        const interruption = resolveFreeMoveInterruption(withEnemy, plannedPath);
        expect(interruption.interrupted).toBe(true);
        expect(hexEquals(interruption.destination, plannedPath[plannedPath.length - 1])).toBe(false);

        const interruptedMoveExecution = moveDef!.execute(withEnemy, withEnemy.player, target);
        const interruptedDisplacement = interruptedMoveExecution.effects.find(effect => effect.type === 'Displacement') as any;
        expect(interruptedDisplacement).toBeTruthy();
        expect(hexEquals(interruptedDisplacement.destination, interruption.destination)).toBe(true);
    });
});
