# Turn Stack Contract (World-Class)

## Purpose
Define one deterministic runtime contract that keeps engine correctness and player-facing visual clarity aligned.

This contract formalizes:
- turn ownership,
- action resolution order,
- intercept hooks (stairs/shrine/win/loss),
- UI lock/unlock behavior,
- replay parity expectations.

## Core Principle
The engine may resolve quickly, but the UI must present outcomes in a strict sequential order that matches initiative and causality.

## State Machine
1. `INPUT_OPEN`
- Player can act.
- Required: `isPlayerTurn && !pendingStatus && !hasBlockingFrames && !replayMode`.

2. `INPUT_COMMITTED`
- Player selected a valid action.
- Input is locked immediately.

3. `ENGINE_RESOLVING`
- Engine computes effects/timeline deterministically.
- No UI interaction allowed.

4. `PLAYBACK_DRAINING`
- UI plays events in order, one actor step at a time.
- Initiative visually advances only after current actor step finishes.

5. `INTERCEPT_PENDING`
- Blocking post-action hooks are resolved (stairs, shrine, win/loss).
- Initiative cannot advance while intercept queue is non-empty.

6. `TURN_HANDOFF`
- If next actor is non-player, continue playback queue.
- If queue is complete and player is active, return to `INPUT_OPEN`.

## Ordered Resolution Frames
Within a single actor step, events must preserve this order:
1. `INTENT_START`
2. `MOVE_START`
3. `MOVE_END`
4. `ON_PASS`
5. `ON_ENTER`
6. `HAZARD_CHECK`
7. `STATUS_APPLY`
8. `DAMAGE_APPLY`
9. `DEATH_RESOLVE`
10. `INTENT_END`

No later phase may render before all earlier blocking phases complete.

## Intercept Hook Contract
Intercepts are stack frames inserted after action resolution and before queue handoff.

Blocking intercept examples:
- `STAIRS_TRANSITION`
- `SHRINE_CHOICE`
- `RUN_WON`
- `RUN_LOST`

Rules:
- Intercepts are deterministic and ordered.
- `ADVANCE_TURN` is forbidden while a blocking intercept exists.
- UI unlock is forbidden while a blocking intercept exists.

## Hard Invariants
1. Single owner of turn input:
- exactly one source of truth for `canPlayerInput`.

2. No queue advance under pending:
- if `pendingStatus != undefined`, queue cannot advance until `RESOLVE_PENDING`.

3. No actor overlap in playback:
- actor `N+1` playback cannot start before actor `N` playback completion.

4. No silent replay mutation:
- replay actions must not be silently dropped.

5. Replay parity:
- same seed + same action sequence => same state fingerprint.

## Headless vs Web Responsibilities
Engine (`headless`):
- deterministic intent->effects->timeline generation,
- strict pending/queue gates,
- deterministic IDs/grouping for actor-step events.

Web (`presentation`):
- consume timeline sequentially,
- lock input based on contract only,
- never bypass intercept/pending gates,
- reflect initiative progression with event completion.

## Observability Requirements
Every actor step should be traceable with:
- `turnNumber`,
- `actorId`,
- `stepId/groupId`,
- `phase`,
- `blocking`,
- `pendingStatus`,
- queue index.

Message tags should stay engine-native (`[LEVEL|CHANNEL]`) and never be the only source of runtime truth.

## Non-Goals
- No player response windows (this is not a reactive stack game loop).
- No speculative UI actions while turn is locked.

