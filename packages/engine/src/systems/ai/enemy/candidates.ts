import { hexAdd, hexDirection, hexDistance, hexEquals, pointToKey } from '../../../hex';
import type { Entity, GameState, Point } from '../../../types';
import { SkillRegistry } from '../../../skillRegistry';
import { SpatialSystem } from '../../spatial-system';
import { UnifiedTileService } from '../../tiles/unified-tile-service';
import { consumeRandom } from '../../rng';
import { isStunned } from '../../status';
import type { AiCandidate, AiDecisionAction } from '../core/types';
import { findBestMove, getDirectionTo, planEnemyActionByPolicy } from './policies';
import type { EnemyAiPlannedCandidate } from './types';

export interface EnemyCandidateBuildContext {
    enemy: Entity;
    playerPos: Point;
    state: GameState & { occupiedCurrentTurn?: Point[] };
}

export interface EnemyCandidateBuildOptions {
    includePolicyExact?: boolean;
}

/**
 * Transitional candidate scaffold for AI convergence.
 * Runtime selection is score-authoritative over this candidate set, while oracle policy planning
 * remains available for parity diff tooling.
 */
export const buildEnemyCandidatesScaffold = (ctx: EnemyCandidateBuildContext): AiCandidate[] => {
    const candidates: AiCandidate[] = [];
    const add = (action: AiDecisionAction, reasoningCode: string, preScore?: number) =>
        candidates.push({ action, reasoningCode, preScore });

    add({ type: 'WAIT', skillId: 'WAIT_SKILL' }, 'WAIT');

    // Conservative scaffold: declare obvious direct attacks/skills as candidates for debug visibility.
    const dist = Math.abs((ctx.enemy.position.q - ctx.playerPos.q)) + Math.abs((ctx.enemy.position.r - ctx.playerPos.r));
    if (dist <= 2) {
        add({ type: 'ATTACK', skillId: 'BASIC_ATTACK', targetHex: ctx.playerPos }, 'BASIC_ATTACK', 1);
    }
    for (const skill of (ctx.enemy.activeSkills || [])) {
        if (skill.id === 'BASIC_MOVE' || skill.id === 'AUTO_ATTACK') continue;
        add({ type: 'USE_SKILL', skillId: String(skill.id), targetHex: ctx.playerPos }, `SKILL_${String(skill.id)}`, 0);
    }

    return candidates;
};

const candidateKey = (candidate: EnemyAiPlannedCandidate): string => {
    const e = candidate.planned.entity;
    return [
        candidate.source,
        String(e.intent || 'Waiting'),
        pointToKey(e.position),
        e.intentPosition ? pointToKey(e.intentPosition) : 'none',
        String(e.actionCooldown ?? 'none'),
        String(e.facing ?? 'none'),
        String(e.isVisible ?? 'none'),
        String(candidate.planned.nextState.rngCounter || 0),
        String(candidate.planned.message || '')
    ].join('::');
};

const isInLine = (from: Point, to: Point): boolean =>
    (from.q === to.q) || (from.r === to.r) || (from.s === to.s);

const hasActiveSkill = (enemy: Entity, skillId: string): boolean =>
    !!enemy.activeSkills?.some(s => s.id === skillId);

const DEDICATED_POLICY_SUBTYPES = new Set<string>([
    'sprinter',
    'shieldBearer',
    'warlock',
    'assassin',
    'golem',
    'sentinel',
    'raider',
    'pouncer',
    'archer',
    'bomber'
]);

export const buildEnemyPlannedCandidates = (
    ctx: EnemyCandidateBuildContext,
    options: EnemyCandidateBuildOptions = {}
): EnemyAiPlannedCandidate[] => {
    const out: EnemyAiPlannedCandidate[] = [];
    const includePolicyExact = options.includePolicyExact === true;

    const add = (candidate: EnemyAiPlannedCandidate): void => {
        const key = candidateKey(candidate);
        if (out.some(existing => candidateKey(existing) === key)) return;
        out.push(candidate);
    };

    // Policy-exact candidates are now diagnostics-only.
    // Runtime selection is synthetic-only, while oracle diff tooling can opt into policy candidates.
    if (includePolicyExact) {
        const policyPlanned = planEnemyActionByPolicy({
            enemy: ctx.enemy,
            playerPos: ctx.playerPos,
            state: ctx.state
        });
        add({
            id: 'policy-exact',
            source: 'policy_exact',
            reasoningCode: 'POLICY_EXACT',
            preScore: 0,
            planned: policyPlanned
        });
    }

    if (ctx.enemy.factionId === 'player') {
        const minionPlanned = planEnemyActionByPolicy({
            enemy: ctx.enemy,
            playerPos: ctx.playerPos,
            state: ctx.state
        });
        add({
            id: 'minion-policy-shape',
            source: 'synthetic',
            reasoningCode: 'SYN_MINION_POLICY_SHAPE',
            preScore: 10,
            planned: minionPlanned
        });
        return out;
    }

    add({
        id: 'wait',
        source: 'synthetic',
        reasoningCode: 'SYN_WAIT',
        preScore: -10,
        planned: {
            entity: { ...ctx.enemy, intent: 'Waiting', intentPosition: undefined },
            nextState: ctx.state
        }
    });

    const dist = hexDistance(ctx.enemy.position, ctx.playerPos);
    const subtype = ctx.enemy.subtype || 'default';
    const usesDefaultPolicyBranch = !DEDICATED_POLICY_SUBTYPES.has(subtype);
    const canBasicAttack = !!ctx.enemy.activeSkills?.some(s => s.id === 'BASIC_ATTACK');
    const canLegacyBasicAttack = canBasicAttack || usesDefaultPolicyBranch;
    if (dist === 1 && canLegacyBasicAttack) {
        add({
            id: 'basic-attack',
            source: 'synthetic',
            reasoningCode: 'SYN_BASIC_ATTACK',
            preScore: 5,
            planned: {
                entity: { ...ctx.enemy, intent: 'BASIC_ATTACK', intentPosition: { ...ctx.playerPos } },
                nextState: ctx.state
            }
        });
    }

    if (usesDefaultPolicyBranch && dist > 1) {
        const { position, state: nextState } = findBestMove(
            ctx.enemy,
            ctx.playerPos,
            ctx.state,
            ctx.state.occupiedCurrentTurn
        );
        const moved = !hexEquals(position, ctx.enemy.position);
        const nextDist = hexDistance(position, ctx.playerPos);
        add({
            id: 'default-move',
            source: 'synthetic',
            reasoningCode: 'SYN_DEFAULT_MOVE',
            preScore: 0,
            planned: {
                entity: {
                    ...ctx.enemy,
                    position,
                    intent: moved ? 'Moving' : (nextDist === 1 ? 'BASIC_ATTACK' : 'Waiting'),
                    intentPosition: (moved || nextDist > 1) ? undefined : { ...ctx.playerPos }
                },
                nextState,
                message: moved ? `${ctx.enemy.subtype} moves to (${position.q}, ${position.r})` : undefined
            }
        });
    }

    if (subtype === 'sprinter' && dist > 1) {
        let curPos = ctx.enemy.position;
        let curState = ctx.state;
        for (let move = 0; move < 2; move++) {
            if (hexDistance(curPos, ctx.playerPos) <= 1) break;
            const tempEnemy = { ...ctx.enemy, position: curPos };
            const { position, state: newState } = findBestMove(tempEnemy, ctx.playerPos, curState, ctx.state.occupiedCurrentTurn);
            curPos = position;
            curState = newState;
        }
        const moved = !hexEquals(curPos, ctx.enemy.position);
        add({
            id: 'sprinter-move',
            source: 'synthetic',
            reasoningCode: 'SYN_SPRINTER_MOVE',
            preScore: 0,
            planned: {
                entity: {
                    ...ctx.enemy,
                    position: curPos,
                    intent: moved ? 'Moving' : 'BASIC_ATTACK',
                    intentPosition: moved ? undefined : { ...ctx.playerPos }
                },
                nextState: curState,
                message: moved ? `${ctx.enemy.subtype} moves to (${curPos.q}, ${curPos.r})` : undefined
            }
        });
    }

    if (subtype === 'shieldBearer') {
        const facingDir = getDirectionTo(ctx.enemy.position, ctx.playerPos);
        if (dist === 1) {
            add({
                id: 'shieldbearer-attack-facing',
                source: 'synthetic',
                reasoningCode: 'SYN_SHIELDBEARER_ATTACK',
                preScore: 0,
                planned: {
                    entity: {
                        ...ctx.enemy,
                        facing: facingDir,
                        intent: 'BASIC_ATTACK',
                        intentPosition: { ...ctx.playerPos }
                    },
                    nextState: ctx.state
                }
            });
        } else {
            const { position, state: nextState } = findBestMove(
                ctx.enemy,
                ctx.playerPos,
                ctx.state,
                ctx.state.occupiedCurrentTurn
            );
            const moved = !hexEquals(position, ctx.enemy.position);
            add({
                id: 'shieldbearer-advance',
                source: 'synthetic',
                reasoningCode: 'SYN_SHIELDBEARER_ADVANCE',
                preScore: 0,
                planned: {
                    entity: {
                        ...ctx.enemy,
                        position,
                        facing: moved ? getDirectionTo(ctx.enemy.position, position) : facingDir,
                        intent: moved ? 'Advancing' : 'BASIC_ATTACK',
                        intentPosition: moved ? undefined : { ...ctx.playerPos }
                    },
                    nextState,
                    message: moved ? `${ctx.enemy.subtype} advances to (${position.q}, ${position.r})` : undefined
                }
            });
        }
    }

    if (subtype === 'assassin') {
        if (dist === 1) {
            add({
                id: 'assassin-attack',
                source: 'synthetic',
                reasoningCode: 'SYN_ASSASSIN_ATTACK',
                preScore: 0,
                planned: {
                    entity: {
                        ...ctx.enemy,
                        isVisible: true,
                        intent: 'BASIC_ATTACK',
                        intentPosition: { ...ctx.playerPos }
                    },
                    nextState: ctx.state
                }
            });
        } else {
            const { position, state: nextState } = findBestMove(
                ctx.enemy,
                ctx.playerPos,
                ctx.state,
                ctx.state.occupiedCurrentTurn
            );
            const moved = !hexEquals(position, ctx.enemy.position);
            add({
                id: 'assassin-move',
                source: 'synthetic',
                reasoningCode: 'SYN_ASSASSIN_MOVE',
                preScore: 0,
                planned: {
                    entity: {
                        ...ctx.enemy,
                        position,
                        isVisible: moved ? false : (dist <= 1),
                        intent: moved ? 'Moving' : 'BASIC_ATTACK',
                        intentPosition: moved ? undefined : { ...ctx.playerPos }
                    },
                    nextState,
                    message: moved ? 'You hear footsteps nearby...' : undefined
                }
            });
        }
    }

    if (subtype === 'golem') {
        const cooldown = ctx.enemy.actionCooldown ?? 0;
        if (cooldown > 0) {
            add({
                id: 'golem-charging',
                source: 'synthetic',
                reasoningCode: 'SYN_GOLEM_CHARGING',
                preScore: 0,
                planned: {
                    entity: { ...ctx.enemy, actionCooldown: cooldown - 1, intent: 'Charging Power' },
                    nextState: ctx.state
                }
            });
        } else if (dist >= 1 && dist <= 3) {
            add({
                id: 'golem-attack',
                source: 'synthetic',
                reasoningCode: 'SYN_GOLEM_ATTACK',
                preScore: 0,
                planned: {
                    entity: { ...ctx.enemy, actionCooldown: 2, intent: 'BASIC_ATTACK', intentPosition: { ...ctx.playerPos } },
                    nextState: ctx.state
                }
            });
        } else {
            const { position, state: nextState } = findBestMove(
                ctx.enemy,
                ctx.playerPos,
                ctx.state,
                ctx.state.occupiedCurrentTurn
            );
            const moved = !hexEquals(position, ctx.enemy.position);
            add({
                id: 'golem-lumbering',
                source: 'synthetic',
                reasoningCode: 'SYN_GOLEM_LUMBERING',
                preScore: 0,
                planned: {
                    entity: { ...ctx.enemy, position, intent: moved ? 'Lumbering' : 'Waiting', actionCooldown: 0 },
                    nextState,
                    message: moved ? `${ctx.enemy.subtype} lumbers to (${position.q}, ${position.r})` : undefined
                }
            });
        }
    }

    if (subtype === 'sentinel') {
        const inRange = dist <= 3;
        const telegraphTurn = (ctx.state.turnNumber % 2) === 0;
        const executeTurn = !telegraphTurn;

        if (inRange && executeTurn && isStunned(ctx.enemy)) {
            add({
                id: 'sentinel-preparing-stunned',
                source: 'synthetic',
                reasoningCode: 'SYN_SENTINEL_STUNNED_PREPARING',
                preScore: 0,
                planned: {
                    entity: { ...ctx.enemy, intent: 'Preparing', intentPosition: undefined },
                    nextState: ctx.state,
                    message: `${ctx.enemy.subtype} loses focus!`
                }
            });
        } else if (inRange && telegraphTurn) {
            add({
                id: 'sentinel-telegraph',
                source: 'synthetic',
                reasoningCode: 'SYN_SENTINEL_TELEGRAPH',
                preScore: 0,
                planned: {
                    entity: { ...ctx.enemy, intent: 'SENTINEL_TELEGRAPH', intentPosition: { ...ctx.playerPos } },
                    nextState: ctx.state,
                    message: 'The Sentinel marks the blast zone...'
                }
            });
        } else if (inRange && executeTurn) {
            add({
                id: 'sentinel-blast',
                source: 'synthetic',
                reasoningCode: 'SYN_SENTINEL_BLAST',
                preScore: 0,
                planned: {
                    entity: { ...ctx.enemy, intent: 'SENTINEL_BLAST', intentPosition: { ...ctx.playerPos } },
                    nextState: ctx.state
                }
            });
        } else {
            const { position, state: nextState } = findBestMove(
                ctx.enemy,
                ctx.playerPos,
                ctx.state,
                ctx.state.occupiedCurrentTurn
            );
            add({
                id: 'sentinel-move',
                source: 'synthetic',
                reasoningCode: 'SYN_SENTINEL_MOVE',
                preScore: 0,
                planned: {
                    entity: { ...ctx.enemy, position, intent: 'Moving', intentPosition: undefined },
                    nextState
                }
            });
        }
    }

    if (subtype === 'warlock') {
        let curState = ctx.state;
        const { value: teleportChance, nextState: state1 } = consumeRandom(curState);
        curState = state1;

        let newPos = ctx.enemy.position;
        if (dist <= 2 || teleportChance < 0.3) {
            const { value: dirVal, nextState: state2 } = consumeRandom(curState);
            curState = state2;
            const { value: distVal, nextState: state3 } = consumeRandom(curState);
            curState = state3;

            const teleportDir = Math.floor(dirVal * 6);
            const teleportDist = 3 + Math.floor(distVal * 3);
            let candidate = ctx.enemy.position;
            for (let i = 0; i < teleportDist; i++) {
                candidate = hexAdd(candidate, hexDirection(teleportDir));
            }

            const blocked = !SpatialSystem.isWithinBounds(ctx.state, candidate)
                || !UnifiedTileService.isWalkable(ctx.state, candidate)
                || ctx.state.occupiedCurrentTurn?.some((p: Point) => hexEquals(p, candidate))
                || ctx.state.enemies.some((e: Entity) => e.id !== ctx.enemy.id && hexEquals(e.position, candidate))
                || hexEquals(candidate, ctx.playerPos);

            if (!blocked) newPos = candidate;
        }

        const moved = !hexEquals(newPos, ctx.enemy.position);
        const newDist = hexDistance(newPos, ctx.playerPos);
        const canCast = !moved && newDist >= 2 && newDist <= 4;
        add({
            id: 'warlock-policy-like',
            source: 'synthetic',
            reasoningCode: 'SYN_WARLOCK_POLICY',
            preScore: 0,
            planned: {
                entity: {
                    ...ctx.enemy,
                    position: newPos,
                    intent: moved ? 'Repositioning' : (canCast ? 'Casting' : 'Preparing'),
                    intentPosition: canCast ? { ...ctx.playerPos } : undefined
                },
                nextState: curState,
                message: moved ? `${ctx.enemy.subtype} teleports to (${newPos.q}, ${newPos.r})` : undefined
            }
        });
    }

    // Raider / Pouncer line-skills: explicit alternatives let scoring explain these windows.
    const raiderDashWindow = subtype === 'raider' && hasActiveSkill(ctx.enemy, 'DASH') && isInLine(ctx.enemy.position, ctx.playerPos) && dist >= 2 && dist <= 4;
    if (raiderDashWindow) {
        add({
            id: 'raider-dash',
            source: 'synthetic',
            reasoningCode: 'SYN_RAIDER_DASH_WINDOW',
            preScore: 0,
            planned: {
                entity: { ...ctx.enemy, intent: 'DASH', intentPosition: { ...ctx.playerPos } },
                nextState: ctx.state
            }
        });
    }
    if (subtype === 'raider' && !raiderDashWindow) {
        const { position, state: nextState } = findBestMove(
            ctx.enemy,
            ctx.playerPos,
            ctx.state,
            ctx.state.occupiedCurrentTurn
        );
        const moved = !hexEquals(position, ctx.enemy.position);
        const nextDist = hexDistance(position, ctx.playerPos);
        add({
            id: 'raider-move',
            source: 'synthetic',
            reasoningCode: 'SYN_RAIDER_MOVE',
            preScore: 0,
            planned: {
                entity: {
                    ...ctx.enemy,
                    position,
                    intent: moved ? 'Moving' : (nextDist === 1 ? 'BASIC_ATTACK' : 'Waiting'),
                    intentPosition: (moved || nextDist > 1) ? undefined : { ...ctx.playerPos }
                },
                nextState,
                message: moved ? `${ctx.enemy.subtype} moves to (${position.q}, ${position.r})` : undefined
            }
        });
    }

    const pouncerHookWindow = subtype === 'pouncer' && hasActiveSkill(ctx.enemy, 'GRAPPLE_HOOK') && isInLine(ctx.enemy.position, ctx.playerPos) && dist >= 2 && dist <= 4;
    if (pouncerHookWindow) {
        add({
            id: 'pouncer-grapple',
            source: 'synthetic',
            reasoningCode: 'SYN_POUNCER_HOOK_WINDOW',
            preScore: 0,
            planned: {
                entity: { ...ctx.enemy, intent: 'GRAPPLE_HOOK', intentPosition: { ...ctx.playerPos } },
                nextState: ctx.state
            }
        });
    }
    if (subtype === 'pouncer' && !pouncerHookWindow) {
        const { position, state: nextState } = findBestMove(
            ctx.enemy,
            ctx.playerPos,
            ctx.state,
            ctx.state.occupiedCurrentTurn
        );
        const moved = !hexEquals(position, ctx.enemy.position);
        add({
            id: 'pouncer-move',
            source: 'synthetic',
            reasoningCode: 'SYN_POUNCER_MOVE',
            preScore: 0,
            planned: {
                entity: {
                    ...ctx.enemy,
                    position,
                    intent: moved ? 'Moving' : 'Waiting',
                    intentPosition: undefined
                },
                nextState,
                message: moved ? `${ctx.enemy.subtype} moves to (${position.q}, ${position.r})` : undefined
            }
        });
    }

    // Archer ranged/melee windows.
    if (subtype === 'archer') {
        const rangedIntentSkill = hasActiveSkill(ctx.enemy, 'ARCHER_SHOT') ? 'ARCHER_SHOT' : (hasActiveSkill(ctx.enemy, 'SPEAR_THROW') ? 'SPEAR_THROW' : undefined);
        let canShootPlayer = false;
        if (rangedIntentSkill) {
            const def = SkillRegistry.get(rangedIntentSkill);
            canShootPlayer = dist > 1 && !!def?.getValidTargets && def.getValidTargets(ctx.state, ctx.enemy.position).some(t => hexEquals(t, ctx.playerPos));
            if (canShootPlayer) {
                add({
                    id: `archer-ranged-${rangedIntentSkill}`,
                    source: 'synthetic',
                    reasoningCode: 'SYN_ARCHER_RANGED_WINDOW',
                    preScore: 0,
                    planned: {
                        entity: { ...ctx.enemy, intent: rangedIntentSkill, intentPosition: { ...ctx.playerPos } },
                        nextState: ctx.state
                    }
                });
            }
        }
        const meleeFallback = dist === 1 && hasActiveSkill(ctx.enemy, 'BASIC_ATTACK');
        if (dist === 1 && hasActiveSkill(ctx.enemy, 'BASIC_ATTACK')) {
            add({
                id: 'archer-melee-fallback',
                source: 'synthetic',
                reasoningCode: 'SYN_ARCHER_MELEE_FALLBACK',
                preScore: 0,
                planned: {
                    entity: { ...ctx.enemy, intent: 'BASIC_ATTACK', intentPosition: { ...ctx.playerPos } },
                    nextState: ctx.state
                }
            });
        }

        if (!canShootPlayer && !meleeFallback) {
            const { position, state: nextState } = findBestMove(
                ctx.enemy,
                ctx.playerPos,
                ctx.state,
                ctx.state.occupiedCurrentTurn
            );
            const moved = !hexEquals(position, ctx.enemy.position);
            add({
                id: 'archer-move',
                source: 'synthetic',
                reasoningCode: 'SYN_ARCHER_MOVE',
                preScore: 0,
                planned: {
                    entity: {
                        ...ctx.enemy,
                        position,
                        intent: moved ? 'Moving' : 'Idle',
                        intentPosition: undefined
                    },
                    nextState,
                    message: moved ? `${ctx.enemy.subtype} moves to (${position.q}, ${position.r})` : undefined
                }
            });
        }
    }

    // Bomber toss window + reposition branch.
    if (subtype === 'bomber' && hasActiveSkill(ctx.enemy, 'BOMB_TOSS')) {
        const cooldown = ctx.enemy.actionCooldown ?? 0;
        const inBombRange = dist >= 2 && dist <= 3;
        if (cooldown === 0 && inBombRange) {
            const validBombTargets = SpatialSystem.getNeighbors(ctx.playerPos)
                .filter(n => {
                    const isBlocking = !UnifiedTileService.isWalkable(ctx.state, n);
                    const isOccupiedByEnemy = ctx.state.enemies.some((e: Entity) => hexEquals(e.position, n));
                    return SpatialSystem.isWithinBounds(ctx.state, n) && !isBlocking && !isOccupiedByEnemy && !hexEquals(n, ctx.playerPos);
                });

            if (validBombTargets.length > 0) {
                const { value, nextState } = consumeRandom(ctx.state);
                const targetIdx = Math.floor(value * validBombTargets.length) % validBombTargets.length;
                const bombTarget = validBombTargets[targetIdx];
                add({
                    id: 'bomber-bomb-window',
                    source: 'synthetic',
                    reasoningCode: 'SYN_BOMBER_BOMB_WINDOW',
                    preScore: 0,
                    planned: {
                        entity: { ...ctx.enemy, intent: 'Bombing', intentPosition: bombTarget, actionCooldown: 2 },
                        nextState
                    }
                });
            }
        }

        const { position, state: nextState } = findBestMove(
            ctx.enemy,
            ctx.playerPos,
            ctx.state,
            ctx.state.occupiedCurrentTurn,
            2.5
        );
        const moved = !hexEquals(position, ctx.enemy.position);
        add({
            id: 'bomber-reposition',
            source: 'synthetic',
            reasoningCode: 'SYN_BOMBER_REPOSITION',
            preScore: 0,
            planned: {
                entity: {
                    ...ctx.enemy,
                    position,
                    intent: moved ? 'Moving' : 'Waiting',
                    intentPosition: undefined,
                    actionCooldown: Math.max(0, cooldown - 1)
                },
                nextState,
                message: moved ? `${ctx.enemy.subtype} repositioning to (${position.q}, ${position.r})` : undefined
            }
        });
    }

    const subtypeSkillWhitelist: Partial<Record<string, ReadonlySet<string>>> = {};
    const allowedSkills = ctx.enemy.subtype ? subtypeSkillWhitelist[ctx.enemy.subtype] : undefined;

    for (const skill of (ctx.enemy.activeSkills || [])) {
        if (skill.id === 'AUTO_ATTACK' || skill.id === 'BASIC_MOVE' || skill.id === 'BASIC_ATTACK') continue;
        if (!allowedSkills?.has(String(skill.id))) continue;
        const def = SkillRegistry.get(skill.id);
        if (!def) continue;
        if (def.getValidTargets && !def.getValidTargets(ctx.state, ctx.enemy.position).some(t => hexEquals(t, ctx.playerPos))) {
            continue;
        }
        add({
            id: `skill-${skill.id}`,
            source: 'synthetic',
            reasoningCode: `SYN_SKILL_${skill.id}`,
            preScore: 1,
            planned: {
                entity: { ...ctx.enemy, intent: String(skill.id), intentPosition: { ...ctx.playerPos } },
                nextState: ctx.state
            }
        });
    }

    return out;
};
