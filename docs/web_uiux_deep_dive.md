# Web UI/UX Refactor and Productization Roadmap

**Date:** March 23, 2026

**Scope:** `apps/web`

This document replaces the earlier deep-dive assessment with an implementation roadmap grounded in current repo truth. The web app already has strong board rendering, theme/token infrastructure, route scaffolding, haptic dispatch plumbing, replay support, and mobile layout work. The main gaps are ownership, productization, onboarding, installability, and a few missing mobile ergonomics.

## Repo Truth Snapshot

### Current strengths
- `apps/web/src/App.tsx` is now a thin composition root, with orchestration moved behind `apps/web/src/app/AppShell.tsx`.
- `apps/web/src/app/GameScreen.tsx` already owns a large amount of layout and gameplay presentation logic.
- `apps/web/src/app/use-app-routing.ts` provides the current dedicated route model without an external router.
- `apps/web/src/app/sensory-dispatcher.ts` exists and already handles haptics plus telemetry dispatch.
- `apps/web/src/components/TutorialManager.tsx` and `apps/web/src/app/TutorialReplayScreen.tsx` provide tutorial scaffolding, but not a guided onboarding flow.
- The app already has strong camera, board rendering, replay, and UI preference coverage in `apps/web/src/__tests__`.

### Current gaps
- `apps/web/src/app/AppShell.tsx` has now been decomposed behind boot, tutorial, worldgen, and run controllers plus dedicated route shells, but the package still has optional cleanup opportunities around further controller trimming and shell polish.
- Bundle/performance hardening is now implemented as a baseline:
  - `apps/web/package.json` includes `build:analyze`
  - `vite.config.ts` emits `dist/bundle-stats.json` in analyze mode
  - coarse engine chunking now isolates `engine-data`, `engine-generation`, and `engine-generated`
  - the main `engine` chunk is now below the warning threshold
- Post-productization perf closeout is also now in place:
  - app boot no longer waits on worldgen readiness
  - `worldgen-worker` is now a bootstrap chunk that lazy-loads the heavy compile runtime on first use
  - worldgen warm-up is explicit in arcade/start-run/pending-floor flows instead of being hidden inside boot
- The main remaining engineering work is optional follow-up on the lazy worldgen runtime payload and longer-term shell polish, not a blocking productization gap.
- The roadmap/status docs need to stay aligned with the implemented state so they do not drift back to pre-refactor assumptions.

## Current Status

### Implemented baselines
1. Phase 0 is complete: this document is now a repo-truth roadmap rather than an aspirational gap list.
2. Phase 1 is complete: `App.tsx` is a thin composition root and app/session ownership is split across `use-app-session`, `use-hub-session`, `use-run-session`, `use-replay-session`, and route shells.
3. Phase 2 is complete: `GameScreen.tsx` is driven by a screen model/context boundary instead of the prior mega-prop surface.
4. Phase 3 is complete: sensory dispatch includes audio+haptics preferences, audio runtime wiring, and live event integration.
5. Phase 4 is complete: guided tutorial progression, onboarding prompt, spotlight mask, and tutorial launcher/history surfaces are live.
6. Phase 5 is complete: mobile vitals glance mode, gesture discoverability, and motion-aware transitions are live.
7. Phase 6 is complete: CSS ownership is split into tokens, themes, surfaces, animations, and utilities.
8. Phase 7 is complete: the app has a manifest, service worker registration, and offline shell support.
9. Phase 8 is complete: boot now uses an explicit boot-state model, milestone telemetry, and a dedicated launch overlay.
10. Post-productization performance closeout is complete: the worldgen worker is split into a tiny bootstrap plus lazy runtime, and worldgen readiness is no longer part of general app boot.

### Remaining work
1. Structural consolidation follow-up: keep `AppShell` and the extracted controllers tidy as future work lands.
2. Optional performance follow-up: revisit the lazy `worldgen-worker-runtime` payload and any future splash-art replacement if startup assets grow again.
3. Optional offline-first enhancement: a brand-new offline run after only a shell load is no longer guaranteed until the lazy worldgen runtime has been fetched; local offline resume remains supported.
4. Documentation closeout: keep `docs/STATUS.md` and this roadmap aligned with the live package state.

## Goals
1. Reduce top-level orchestration complexity so future features stop accumulating in one app shell.
2. Improve perceived mobile game quality through sound, haptics, transitions, gestures, and onboarding.
3. Preserve the parchment-first visual identity and the current rules/runtime behavior.
4. Keep web behavior deterministic and replay-safe.
5. Add installability and offline shell support without destabilizing current local run flow.

## Non-Goals
1. No gameplay rule changes in `packages/engine` unless a web integration issue forces a contract fix.
2. No visual rebrand away from the current parchment-medieval product direction.
3. No external router migration.
4. No repo-wide lint cleanup as part of this roadmap.
5. No board/camera rewrite.

## Delivery Order
Implement in this order:

1. Phase 0: document correction
2. Phase 1: app/session split
3. Phase 2: game screen context reduction
4. Phase 3: sensory productization
5. Phase 4: guided tutorial flow
6. Phase 5: mobile gestures and transitions
7. Phase 6: CSS ownership split
8. Phase 7: PWA and offline shell
9. Phase 8: boot and first-impression polish

## Phase 0: Make This Document the Source of Truth

### Objective
Replace stale assessment language with an execution document that matches the current repo.

### Work
- Keep this document aligned with live repo state.
- Track which phases are complete, in progress, or pending.
- Treat existing scaffolds as assets to build on, not missing systems.

### Acceptance
- The document no longer claims sensory, tutorial, or route decomposition are entirely absent.
- The document remains the canonical roadmap for the web UI/UX initiative.

## Phase 1: Split App-Level Orchestration Into Session Controllers

### Objective
Keep the root app thin and isolate app, hub, run, and replay concerns behind session hooks.

### Current status
- `apps/web/src/App.tsx` is reduced to the composition root.
- `apps/web/src/app/use-app-session.ts` exists for app-level routing, preferences, and feature flags.
- `apps/web/src/app/use-hub-session.ts`, `apps/web/src/app/use-run-session.ts`, and `apps/web/src/app/use-replay-session.ts` now exist as initial ownership boundaries.
- `apps/web/src/app/AppShell.tsx` still contains too much orchestration and should be reduced further.

### Delivered follow-up
- Boot, tutorial, worldgen, and run interaction orchestration now live behind dedicated controller hooks and route shells.
- Route rendering is split across `HubRouteShell.tsx`, `RunRouteShell.tsx`, and `UtilityRouteShell.tsx`.
- `AppShell.tsx` is now primarily a composition layer.

### Acceptance
- `App.tsx` stays thin.
- Session ownership is explicit.
- Existing route behavior, replay, quick restart, and exit-to-hub flow remain unchanged.

## Phase 2: Reduce GameScreen Prop Surface and Introduce Screen Context

### Objective
Stop using `GameScreen.tsx` as a mega-prop coordinator.

### Work
- Add `apps/web/src/app/game-screen-context.tsx`.
- Add `apps/web/src/app/use-game-screen-model.ts`.
- Introduce internal contexts for:
  - run state
  - UI/layout state
  - screen actions
- Move mobile and desktop HUD sections into dedicated rail/dock components.
- Keep replay overlays screen-local but context-fed.

### Acceptance
- `GameScreen.tsx` accepts one screen model object or a narrow screen contract.
- Prop threading into nested components drops materially.

## Phase 3: Productize Sensory Feedback

### Objective
Extend the existing sensory dispatcher into a real audio+haptics runtime.

### Current truth
- `apps/web/src/app/sensory-dispatcher.ts` now handles audio and haptics with preference-aware dispatch.
- `apps/web/src/app/sensory-audio-runtime.ts` and `apps/web/public/audio/manifest.json` are live.

### Work
- Add audio-backed sensory tokens.
- Extend UI preferences with `audioEnabled` and `hapticsEnabled`.
- Add `apps/web/src/app/sensory-audio-runtime.ts`.
- Add `apps/web/public/audio/manifest.json`.
- Wire sensory output to skill select, confirm/cancel, combat hits, damage taken, kills, floor intro, victory, defeat, and replay stepping.

### Acceptance
- At least 10 canonical events emit real audio when enabled.
- Haptics remain best-effort and optional.
- Sensory output never affects gameplay or replay behavior.

## Phase 4: Deliver a Real Guided Tutorial Flow

### Objective
Turn the current tutorial scaffolding into a first-play onboarding path.

### Current truth
- Guided tutorial state, onboarding prompt, overlay, and replayable launcher surfaces are live.

### Work
- Add `apps/web/src/app/tutorial/`.
- Implement deterministic tutorial scenarios and a UI-only tutorial state machine.
- Add spotlight masks, instructional overlays, skip support, and replayable tutorial launch.

### Acceptance
- New players can complete a guided three-encounter tutorial.
- Tutorial progress is skippable, resumable, and local-only.

## Phase 5: Improve Mobile Interaction and Transitions

### Objective
Close the mobile usability gap without destabilizing board/camera math.

### Work delivered
- Persisted vitals glance/full mode is live.
- Motion-aware transitions are live across route swaps and major overlays.
- Existing pinch-capable board interaction remains in place and mobile affordance messaging was added.

### Acceptance
- Mobile users can pinch zoom the board.
- Vitals are readable in a low-noise glance mode.
- Motion respects reduced-motion preferences.

## Phase 6: Split CSS Ownership

### Objective
Keep the current visual language while making styling maintainable.

### Work
- Split `apps/web/src/index.css` into:
  - `styles/tokens.css`
  - `styles/themes.css`
  - `styles/animations.css`
  - `styles/surfaces.css`
  - `styles/utilities.css`
- Keep theme and animation ownership centralized.
- Colocate only truly specialized component styles.

### Acceptance
- `index.css` becomes resets plus imports.
- No visual regressions in key surfaces, skill cards, vitals, or overlays.

## Phase 7: Add PWA and Offline Shell Support

### Objective
Make the app installable and resilient offline after first load.

### Work delivered
- `apps/web/public/manifest.webmanifest` is live.
- Service worker registration and offline shell caching are live.
- Local run resume remains compatible with the offline shell path.
- Fresh offline new-run start after only a shell load is now an accepted follow-up, because worldgen runtime fetch is lazy.

### Acceptance
- The app is installable on supported browsers.
- The shell loads offline after first install/load.
- Local run resume still works offline.

## Phase 8: Polish Boot and First Impression

### Objective
Replace placeholder-feeling boot behavior with a controlled launch sequence.

### Work delivered
- Boot uses explicit shell/assets milestones, while worldgen readiness is now warmed lazily at first use.
- App-ready telemetry and one-time ready sensory feedback are wired.
- Progressive boot overlay replaces the earlier placeholder-feeling startup path.

### Acceptance
- Boot flow feels intentional.
- Splash behavior no longer reads as temporary scaffolding.
- Boot telemetry remains intact.

## Required Validation

Run these for each substantive phase:
- `npm --workspace @hop/web run test:run`
- `npm --workspace @hop/web run build`
- `npm --workspace @hop/engine run build` when a phase touches engine-facing contracts

## Repo-Truth Appendix

### Current top-level screen modules
- `apps/web/src/app/AppShell.tsx`
- `apps/web/src/app/HubScreen.tsx`
- `apps/web/src/app/GameScreen.tsx`
- `apps/web/src/app/LeaderboardScreen.tsx`
- `apps/web/src/app/SettingsScreen.tsx`
- `apps/web/src/app/ThemeManagerScreen.tsx`
- `apps/web/src/app/TutorialReplayScreen.tsx`

### Current sensory stack
- `apps/web/src/app/sensory-dispatcher.ts`
- `apps/web/src/app/sensory-audio-runtime.ts`
- `apps/web/public/audio/manifest.json`
- Current behavior: preference-aware audio+haptics dispatch with telemetry

### Current tutorial stack
- `apps/web/src/components/TutorialManager.tsx`
- `apps/web/src/app/TutorialReplayScreen.tsx`
- `apps/web/src/app/tutorial/*`
- Current behavior: guided onboarding state machine, spotlight/gating, launcher/history surface

### Current boot/loading path
- Asset manifest boot path is present via `use-asset-manifest`
- Boot/session milestones are modeled explicitly in `use-boot-session.ts`
- Arcade splash gate remains present as the daily-run entrance
- Current behavior: dedicated boot overlay plus milestone telemetry, no eager lazy-route prefetch in the boot hook, `webp` splash delivery instead of the older large JPEG path, and lazy worldgen initialization outside the general boot gate

### Current mobile layout modes
- UI preferences define `mobileLayout: 'portrait_primary'`
- Current app supports mobile dock and mobile-specific layout logic
- Vitals glance/full mode is live
