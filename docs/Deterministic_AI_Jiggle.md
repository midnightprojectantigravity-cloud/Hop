# Implementation Plan: Deterministic AI "Jiggle" (Boltzmann Selection)

**Goal:** Implement the 5th step of the State Transition Proposal ("Jiggle" Selection) — bringing a Boltzmann weighted random distribution to action selection so AI is not perfectly predictable, while strictly preserving Hop's 100% deterministic engine replays.

## User Review Required
No major architectural shifts. This plan leverages the existing `simSeed` on the AI context, meaning we don't have to worry about the UI vs Reducer mutation problem with `rngCounter`.

## Proposed Changes

We will introduce a generic weighted random selection that sits *after* the [compareCandidateOrder](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/ai/generic-unit-ai.ts#948-955) sort. 

### 1. Behavior Profile Addition
We add a new behavioral parameter to control how "jiggly" an actor is.

#### [MODIFY] [packages/engine/src/types.ts](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/types.ts)
- Add `openness?: number` to [AiBehaviorOverlay](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/types.ts#639-644) and `openness: number` to [ResolvedAiBehaviorProfile](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/types.ts#651-656). (Higher openness = more likely to pick a sub-optimal but high-scoring move).

#### [MODIFY] [packages/engine/src/systems/ai/behavior-profile.ts](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/ai/behavior-profile.ts)
- Default `openness: 0` in `BASE_PROFILE`.
- Ensure it overlays/adds just like `offenseBias`.

---

### 2. The Deterministic Boltzmann Logic
We use the pure PRNG system so we don't accidentally mutate the global `rngCounter` when the UI previews an enemy's intent.

#### [MODIFY] [packages/engine/src/systems/ai/generic-unit-ai.ts](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/ai/generic-unit-ai.ts)
- Inside `resolveGenericAiDecision(...)` (or the equivalent candidate selection function):
  - Currently it evaluates candidates, filters out `-1000` penalties, and does:
    ```typescript
    const sorted = [...candidates].sort(compareCandidateOrder);
    return sorted[0];
    ```
  - **The Change:**
    - If `behaviorProfile.openness <= 0`, return `sorted[0]` (strictly optimal, same as current).
    - If `openness > 0`, take all candidates with a score within [(MaxScore - X)](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/rng.ts#35-44) (e.g., within 10 points of the best move).
    - Convert their relative scores into probability weights ($W = e^{\text{Score} / \text{Temperature}}$).
    - Generate a pseudo-random value between 0 and 1 using the completely pure [randomFromSeed](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/rng.ts#68-76) function:
      ```typescript
      import { randomFromSeed } from '../rng';
      
      const rand = randomFromSeed(context.simSeed, context.decisionCounter);
      // Use `rand` to select from the weighted probability pool.
      ```
  - This ensures that if you replay the exact same turn with the same seed, [randomFromSeed(seed, decisionCounter)](file:///c:/Users/philippe.cave/Documents/Antigravity/Hop/packages/engine/src/systems/rng.ts#68-76) produces the exact same float, and the AI picks the exact same "suboptimal" move. Zero side-effects, 100% deterministic jiggle.

## Verification Plan

### Automated Tests
- Run the existing test suite: `npx vitest run enemy_ai_parity_corpus`. These tests already enforce that AI decisions don't accidentally mutate during dry runs.
- Create a new focused test `ai_boltzmann_jiggle.test.ts` to assert that:
   1. A unit with `openness: 0` always perfectly picks `candidate[0]`.
   2. A unit with `openness: 1.0` and multiple near-tied options will pick `candidate[1]` or `candidate[2]` depending on the `simSeed` provided, but *always* pick the exact same candidate if the *same* `simSeed` is provided.
