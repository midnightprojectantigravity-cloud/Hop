# UI Spec Aspirational (North Star)

Last updated: March 4, 2026  
Scope: Future-state `apps/web` UX vision and promotion roadmap.  
Canonical current-build law: `docs/UI_SPEC_CURRENT.md`.

## 1. Purpose

This document defines the world-class target state for Hop UI/UX:
1. What the player should feel.
2. What advanced systems should exist.
3. How future modules should be promoted into current law.

This doc is intentionally forward-looking and may include non-shipped features.

## 2. World-Class Experience Pillars

1. One-hand momentum:
   - mobile interactions should feel effortless under thumb reach constraints.
2. Tactical trust:
   - predicted outcomes should be legible before commitment.
3. Atmospheric materiality:
   - surfaces should feel forged, burned, and physical.
4. Sensory confirmation:
   - major actions should have consistent audio and haptic signatures.
5. Narrative aftermath:
   - outcome surfaces should tell a story, not only display score values.

## 2.1 Implementation Snapshot (March 4, 2026)

Current implementation posture:
1. Execution scaffolding for phases A-G is implemented in `apps/web`.
2. All aspirational modules remain behind feature flags and default off.
3. Build/test baseline is passing for current web scope.

Implemented-behind-flag modules:
1. Splash v2 gate and delayed-ready pulse.
2. Mobile dock v2 and guarded destructive actions.
3. Defeat-loop telemetry hook (`run_lost_overlay_to_action_ms`) and replay marker plumbing.
4. Sensory dispatcher contract with reduced-motion clamp and priority preemption.
5. Dedicated route skeleton screens for Settings, Leaderboard, and Tutorials.
6. Placeholder material textures and asset pipeline hooks.

Still required for promotion:
1. Device SLO evidence and thresholds from section 9.
2. Visual regression and contrast audit artifacts.
3. Final art swap and asset-rights metadata.
4. Full forced-step tutorial replay flow (beyond scaffold).

## 3. Vision by Screen

## 3.1 Boot and Splash ("First 60 Seconds")

Target:
1. Start from cinematic tension, then transition to tactical control.
2. Act as the mobile Arcade archetype entry screen (daily-run path).

Planned features:
1. Splash starts at `110%` scale and slowly zooms to `100%`.
2. 4s ignition loop (`brightness` / `hue-rotate`) for fire flicker.
3. Tap transition preserves warrior silhouette while background fades into War Room material.
4. Sensory trigger on tap:
   - `haptic-outcome-impact`
   - `ui-danger-drum`
5. Arcade archetype interaction contract:
   - tap archetype card -> show details.
   - allow switching cards repeatedly before commit.
   - explicit `Start` confirms daily run launch.
6. Secondary route from splash:
   - `Hub` action routes to Hub screen.
7. Engine readiness gate:
   - loading-mask lifecycle is tied to `engine.isReady` in `main.tsx`/boot orchestration.
   - if `engine.isReady` is not reached by `1500ms`, silhouette enters subtle pulse state to indicate background progress.
   - pulse state exits immediately when `engine.isReady` becomes true.

Spatial blueprint (frame-by-frame contract):
1. Layer 0 (background):
   - `splash4.jpg` centered with `object-position: 50% 20%`.
   - framing rule keeps warrior silhouette and castle spire visible in mobile portrait.
2. Layer 1 (flicker):
   - full-screen `mix-blend-mode: overlay` plane.
   - 4s pulse between `#ff4500` and `#000000`.
3. Layer 2 (interface):
   - top region intentionally empty.
   - bottom `20%` holds one high-contrast `Tap to Enter` prompt in heading font.
4. Transition on tap:
   - background desaturates and blurs into `parchment.jpg` material.
   - warrior silhouette persists as temporary load mask into Hub.
5. Delayed-ready feedback:
   - if boot exceeds `1500ms`, loading mask applies low-amplitude pulse until ready.
   - behavior goal is anti-freeze reassurance, not dramatic animation.

Primary implementation surfaces:
1. `apps/web/src/main.tsx`
2. `apps/web/src/App.tsx`
3. `apps/web/src/index.css`
4. `apps/web/src/components/ArcadeHub.tsx` (current base; requires 2-step select-then-start refactor)

## 3.2 Hub ("War Room")

Target:
1. Hub feels like a persistent command table with history and consequence.
2. Hub is the training-first space; daily launch is routed back to Splash/Arcade.

Planned features:
1. Expanded war-room summaries:
   - daily streak
   - command currency/meta indicators
2. Archetype cards include deeper tactical previews:
   - trinity propensities
   - expected playstyle deltas
3. Archive panel evolves from replay list to tactical record book.
4. Hub action routing contract:
   - `Daily` in header routes to Splash/Arcade screen.
   - `Start` from archetype selection launches training run only (`normal` mode).
   - `Settings` opens dedicated settings screen.
   - `Leaderboard` opens leaderboard screen with replay actions.
   - `Tutorials` opens forced-replay tutorial screen.

Spatial blueprint (layout contract):
1. Header band (`10svh`):
   - persistent daily streak and command-currency indicators.
2. Central stage (`60svh`):
   - mobile: vertical archetype carousel.
   - swiping updates tactical preview panel (Body, Mind, Instinct).
   - desktop: three columns.
3. Desktop columns:
   - left: tactical record book/history.
   - center: archetype selection stage.
   - right: training and replay quick access.
4. Action footer (`30svh`):
   - `Start Run` wax-seal CTA stays disabled until archetype selection.
   - two-tap contract remains hard requirement: select card -> press seal.
   - training-only launch from Hub footer.

Primary implementation surfaces:
1. `apps/web/src/app/HubScreen.tsx`
2. `apps/web/src/components/Hub.tsx`
3. `apps/web/src/components/ArchetypeSelector.tsx`
4. `apps/web/src/components/ReplayManager.tsx`

## 3.3 In-Run Gameplay ("Living Grid")

Target:
1. Board remains visually central while high-frequency actions remain thumb-safe.

Planned features:
1. Safe-zone-first control ordering in mobile dock.
2. Guarded destructive actions:
   - long-press wax-seal confirmation for `Reset`/`Hub Exit`.
3. HP projection visuals in top strip during candidate actions.
4. Predictive ghosting layer for skill/move outcomes.

Spatial blueprint (mobile portrait zoning):
1. Top strip (tactical intel):
   - HP bar, floor, wait indicator, Synapse (`I`) toggle, sigma (`z`) summary.
   - projected HP delta rendered during hover/long-press previews.
2. Center board:
   - centered flat-top hex grid.
   - grim filter applies soot-vignette response when threat reaches `z >= 2`.
3. Bottom dock (`25svh`):
   - dual-tray slot with identical footprint (`SkillTray` or `SynapseTray`).
   - Synapse OFF:
     - compact top-left control cluster (`Wait`, `Reset`, `Hub`).
     - full-width skill tray as primary action surface.
   - Synapse ON:
     - replace skill tray with Synapse settings and tile/entity detail surface.
4. Guarded destructive controls:
   - `Reset` and `Hub` moved to top-left dock stretch zone.
   - destructive actions require long-press seal confirmation.
5. Synapse tray transition:
   - parchment-slide animation swaps tray layers without moving board center.

Primary implementation surfaces:
1. `apps/web/src/app/GameScreen.tsx`
2. `apps/web/src/components/SkillTray.tsx`
3. `apps/web/src/components/GameBoard.tsx`
4. `apps/web/src/components/juice/*`

## 3.4 Replay ("Chronicler")

Target:
1. Replay is a tactical analysis tool, not just playback.

Planned features:
1. Desktop replay timeline with event pips and jump-to-tick navigation.
2. Rich chronicle markers:
   - lethal turns
   - key skill commits
   - threat spikes
3. Quick restart parity in replay context where appropriate.
4. Defeat loop contract:
   - on run loss, show two primary actions: `Quick Restart` and `View Replay`.
   - `Quick Restart` returns directly to gameplay initialization (bypass Hub).
   - `View Replay` enters replay state anchored to the just-finished run.
   - both actions must be reachable in one tap from loss overlay on mobile.

Primary implementation surfaces:
1. `apps/web/src/app/AppOverlays.tsx`
2. `apps/web/src/app/use-replay-controller.ts`
3. `apps/web/src/components/ReplayManager.tsx`
4. `apps/web/src/app/run-resume-context.ts`

## 3.5 Tutorials ("Vellum Instruction")

Target:
1. Tutorials become guided tactical overlays with optional fast expert dismissal.

Planned features:
1. Forced-click progression for specific skills/tiles.
2. Spotlight masks over required interaction areas.
3. Synapse-native educational overlays for UPS/sigma threat interpretation.

Primary implementation surfaces:
1. `apps/web/src/components/TutorialManager.tsx`
2. `apps/web/src/app/AppOverlays.tsx`

## 3.6 Overlay System ("The Chronicler Surfaces")

Target:
1. Overlays should unfold over the board state, not abruptly replace it.

Planned features:
1. Run won/lost overlays:
   - full-screen vellum layer with torn-edge treatment.
   - narrative line sourced from telemetry, not only static defeat/victory text.
   - defeat state must prioritize `Quick Restart` and `View Replay` as the top actions.
2. Settings ledger:
   - right-side vertical slide panel.
   - brass sliders for volume and haptic intensity.
   - wax-seal toggles for reduced motion and synapse density.
3. Transition rule:
   - overlay entry/exit uses snap timing while preserving board context visibility.

Primary implementation surfaces:
1. `apps/web/src/app/AppOverlays.tsx`
2. `apps/web/src/components/PreviewOverlay.tsx`
3. `apps/web/src/components/UpgradeOverlay.tsx`
4. `apps/web/src/components/Hub.tsx` (current preferences entrypoint; dedicated settings-ledger module is future scope)

## 3.7 Mobile Screen Flow Contract (Authoritative)

This section is the canonical mobile UX navigation graph for the aspirational build.

1. Splash screen (Arcade archetype selector):
   - select archetype and inspect details.
   - change selection without side effects.
   - `Start` -> Gameplay screen (`daily` mode only).
   - `Hub` -> Hub screen.
2. Hub screen:
   - header includes persistent info and `Daily` route back to Splash.
   - center archetype selection and details.
   - `Start` -> Gameplay screen (`training`/`normal` only).
   - `Settings` -> Settings screen.
   - `Leaderboard` -> Leaderboard screen.
   - `Tutorials` -> Tutorial screen (forced replay guidance path).
3. Gameplay screen:
   - top HUD: HP bar, floor, wait indicator, Synapse toggle, sigma.
   - center board.
   - bottom dock contract:
     - Synapse OFF: compact top-left control cluster + full-width skill tray.
     - Synapse ON: Synapse settings/detail tray in same footprint.
4. Defeat loop:
   - `Run Lost` overlay -> `Quick Restart` or `View Replay`.
   - `Quick Restart` bypasses Hub and initializes a new run immediately.
   - `View Replay` opens replay viewer for the just-ended run.

Implementation requirement for missing screens:
1. If a screen above is missing in current code paths, treat it as required scope for build-out.
2. New screen modules should be added as explicit routes/components, not hidden inside crowded Hub sub-panels.
3. Each new screen must include:
   - file anchor in this doc.
   - navigation entry and back-path contract.
   - at least one integration test covering route + primary action.

Planned screen modules not yet present as dedicated screens:
1. `SettingsScreen`:
   - proposed anchor: `apps/web/src/app/SettingsScreen.tsx`.
2. `LeaderboardScreen`:
   - proposed anchor: `apps/web/src/app/LeaderboardScreen.tsx`.
3. `TutorialReplayScreen`:
   - proposed anchor: `apps/web/src/app/TutorialReplayScreen.tsx`.

## 4. Sensory System (Planned)

## 4.1 Haptic Tokens

1. `haptic-nav-light`
2. `haptic-action-medium`
3. `haptic-threat-heavy`
4. `haptic-outcome-impact`

## 4.2 Audio Categories

1. `ui-parchment-slide`
2. `ui-brass-clink`
3. `ui-danger-drum`
4. `ui-synapse-chime`

## 4.3 Runtime Principles

1. Sensory events should be semantic and centralized.
2. Reduced-motion mode should have reduced-sensory companion behavior.
3. Events should be deterministic with clear trigger points.

## 4.4 Sensory Event Contract

```ts
export type SensoryPayload = {
  id: SensoryToken; // e.g., 'ui-brass-clink'
  intensity: 0.0 | 1.0;
  priority: 'low' | 'high';
  context: 'run' | 'hub';
};
```

Global rule:
1. `data-motion='reduced'` must cap `SensoryPayload.intensity` to `0.0`.
2. Sensory preemption policy:
   - `priority: 'high'` events must interrupt active `priority: 'low'` haptic/audio events.
   - overlapping low-priority pulses should be dropped or coalesced, never stacked.
   - high-priority interruption behavior must be deterministic for replay-adjacent UI flows.

## 5. Canonical Layout and Breakpoint Contract (Planned)

## 5.1 Unified Breakpoint Constants

| Mode | Threshold | Primary Intent |
| --- | --- | --- |
| `desktop_command_center` | `W >= 1200px` | Full tactical spread (left/center/right rails). |
| `tablet` | `W >= 768px` | Balanced board focus. |
| `mobile_portrait` | `H > W` | Thumb-zone priority with 25svh bottom dock. |

## 5.2 Arbitration Hierarchy

1. `resolveLayoutMode(...)` and `data-layout-mode` are the behavioral source of truth.
2. Tailwind breakpoints are styling helpers only.
3. If Tailwind breakpoint behavior diverges from `data-layout-mode`, `data-layout-mode` wins.
4. Changes to thresholds must update both specs in the same PR.

## 5.3 Mobile Ergonomic Zoning Contract

1. Safe zone:
   - center-right of the bottom dock for high-frequency actions (`skills`, `Wait`).
2. Neutral zone:
   - center-left of the dock for medium-frequency controls.
3. Guarded stretch zone:
   - upper-left or far-edge placement for destructive actions (`Reset`, `Hub Exit`) with confirmation contract.

## 6. Material System (Planned)

## 6.1 Light Theme Material

1. Use `parchment.jpg` as base material for app/board surfaces.
2. Apply low-opacity multiply blend overlays for texture depth.
3. Optional torn-edge shell masks for non-flat map-table presentation.

## 6.2 Dark Theme Material

1. Charred-vellum variant derived from parchment texture.
2. Strong radial vignette for tactical center focus.
3. Soot/ash texture layering for apocalypse identity.

## 6.3 Control Materiality

1. Toggles as wax-seal motif.
2. Sliders as brass-rod with weighted handle.
3. Buttons and core controls follow forged/leather/parchment visual language.

## 7. Predictive and Memory Layers (Planned)

## 7.1 Predictive Ghosting

1. Candidate action previews:
   - HP projection
   - UPS/sigma delta projection
2. Commit vs preview state should remain visually distinguishable.

## 7.2 Visual Echoes

1. Short-lived ghost trails after movement.
2. Parchment-grain masking for memory trails.
3. Deterministic lifetimes and replay parity.

## 7.3 Grim Filter

1. Threat-proximal atmosphere response when hostile threat reaches `z >= 2`.
2. Deterministic activation policy linked to explicit selection/radius rules.

## 8. Aspirational Telemetry Expansion

Planned narrative metrics:
1. `peak_ups_seen`
2. `turns_survived_above_sigma_2`
3. `deadliest_encounter_signature`

Planned UI usage:
1. Defeat summary narrative.
2. Victory summary narrative.

## 9. Experience SLOs (Feel Gates)

1. Flow velocity:
   - `defeat_to_restart_ms` p95 `< 800ms`.
2. Tactical trust:
   - predictive ghosting parity vs commit resolution `100%`.
3. Expert speed:
   - `first_action_ms` p95 `< 500ms` after floor transition.
4. Boot responsiveness:
   - splash boot-to-hub p95 `< 1500ms` on target mobile profile.
5. Sensory responsiveness:
   - dispatcher-to-device event latency p95 `< 16ms`.
6. Frame stability:
   - p95 frame time `<= 16.7ms` during in-run HUD interaction and overlay transitions on target mobile profile.
7. Ergonomic precision:
   - mobile primary-action tap-miss rate `< 5%`.
8. Defeat loop responsiveness:
   - `run_lost_overlay_to_action_ms` p95 `< 400ms` for first actionable button render.

## 10. Execution Matrix (Promotion-Gated)

| Module | Priority | Phase | Blocking Experience Gate | Verification Mode | File Anchors |
| --- | --- | --- | --- | --- | --- |
| Material Texture Pass | 1 | A | Contrast ratio `>= 4.5:1` for key interactive text and controls | visual regression plus contrast audit in QA matrix | `apps/web/src/index.css`, `parchment.jpg` (asset path finalized in implementation PR) |
| Splash Boot Flow | 2 | B | boot-to-hub p95 `< 1500ms`; input-to-transition-start `< 120ms`; delayed-ready pulse shown when boot exceeds threshold | telemetry sampling plus boot-flow integration test and delayed-ready UI-state assertion | `apps/web/src/main.tsx`, `apps/web/src/App.tsx` |
| Mobile Dock Ergonomics | 1 | C | tap-miss rate `< 5%`; zero accidental destructive activation in scripted run | mobile interaction test plus manual thumb-zone audit | `apps/web/src/app/GameScreen.tsx`, `apps/web/src/components/SkillTray.tsx` |
| Overlay System | 2 | C | overlay transition frame-time p95 `<= 16.7ms`; board context preserved | overlay interaction benchmark and visual snapshots | `apps/web/src/app/AppOverlays.tsx`, `apps/web/src/components/PreviewOverlay.tsx` |
| Defeat Restart and Replay Loop | 1 | C | one-tap `Quick Restart` and one-tap `View Replay`; restart bypasses hub in all loss states | run-lost integration tests plus mobile overlay QA | `apps/web/src/app/AppOverlays.tsx`, `apps/web/src/app/run-resume-context.ts`, `apps/web/src/App.tsx` |
| Sensory Dispatcher | 3 | D | event latency p95 `< 16ms`; reduced-motion sensory intensity clamp = `0.0`; `high` priority interrupts `low` priority sensory output | unit contract tests plus event-timing probe and preemption-behavior assertions | `apps/web/src/app/ui-telemetry.ts`, `apps/web/src/App.tsx` |
| Predictive Ghosting | 2 | E | deterministic preview parity `100%` vs committed engine outcomes | deterministic corpus replay tests | `apps/web/src/components/GameBoard.tsx`, `apps/web/src/components/juice/*` |
| Replay Chronicle | 3 | F | replay jump accuracy = exact tick match; quick-restart path remains <= two taps | replay integration tests plus regression corpus | `apps/web/src/app/use-replay-controller.ts`, `apps/web/src/components/ReplayManager.tsx` |
| Dedicated Settings Screen | 2 | G | settings open in <= one tap from Hub and persist on return | route integration test plus persistence tests | `apps/web/src/app/SettingsScreen.tsx` (new), `apps/web/src/app/HubScreen.tsx` |
| Dedicated Leaderboard Screen | 2 | G | leaderboard open in <= one tap from Hub; replay launch works from list | route integration test plus replay-launch tests | `apps/web/src/app/LeaderboardScreen.tsx` (new), `apps/web/src/components/ReplayManager.tsx` |
| Tutorial Replay Screen | 2 | G | forced replay steps enforce expected click path with explicit skip affordance | tutorial integration tests plus deterministic replay checks | `apps/web/src/app/TutorialReplayScreen.tsx` (new), `apps/web/src/components/TutorialManager.tsx` |

## 10.1 PR Blocking Rule

1. A module cannot be promoted if any blocking gate fails.
2. Gate failure in an implementation PR is merge-blocking for the affected phase.
3. Each gate must have:
   - one automated measurement path.
   - one reproducible manual QA check in the device matrix.
4. If automation does not yet exist for a gate, promotion is blocked until measurement is added.
5. Implementation PRs affecting mobile UX must declare:
   - target validation devices from Section 15.1.
   - telemetry events touched from Section 15.2.
   - route and back-stack behavior from Section 15.3.

## 11. Proposed Phase Order

1. Phase A:
   - Material texture pass (light/dark) with contrast verification.
2. Phase B:
   - Splash boot and transition with boot SLO instrumentation.
3. Phase C:
   - Mobile dock ergonomics and guarded destructive actions.
4. Phase D:
   - Sensory runtime integration.
5. Phase E:
   - Predictive ghosting + visual echoes.
6. Phase F:
   - Replay chronicle timeline and narrative overlays.
7. Phase G:
   - Dedicated Settings, Leaderboard, and Tutorial Replay screens.

## 12. Promotion Criteria (Aspirational -> Current)

Any item is promoted to `UI_SPEC_CURRENT.md` only after:
1. Feature is shipped in production path.
2. Behavior is deterministic under replay where relevant.
3. Automated coverage exists for key contract.
4. Performance, accessibility, and mapped experience SLO gates pass.
5. Current-law document is updated with exact behavior + file anchors.
6. Route/back-stack and telemetry schema deltas are documented against Section 15 appendices.

## 13. Screen/Module Crosswalk (Now vs Future)

| Screen or Module | Current Law Anchor | Aspirational Target | Promotion Trigger |
| --- | --- | --- | --- |
| Boot/Splash | Not in current law (`UI_SPEC_CURRENT.md` section 11 deferred) | Section 3.1, Section 10 Phase B | Boot SLO + deterministic transition checks. |
| Hub | `UI_SPEC_CURRENT.md` section 5.4 and section 6.1 | Section 3.2 | Two-tap path preserved while war-room data layers are added. |
| In-run HUD | `UI_SPEC_CURRENT.md` section 5.3 and section 6.2 | Section 3.3 and section 5.3 | Tap-miss and thumb-zone contract tests pass. |
| Replay/Defeat | `UI_SPEC_CURRENT.md` section 6.3 and section 6.4 | Section 3.4 and Phase F | Replay timeline and quick-restart parity tests pass. |
| Tutorials | Scenario overlays in current app; deferred richer guidance | Section 3.5 | Guided interactions remain skippable and deterministic. |
| Overlay system and settings ledger | Deferred in current law section 11 | Section 3.6 | Overlay frame-stability and narrative line gates pass. |
| Mobile navigation graph (Splash -> Hub -> Gameplay + Defeat loop) | Partial flow exists; dedicated routes not complete | Section 3.7 | Route integration tests and one-tap action gates pass. |
| Sensory Runtime | Deferred in current law section 11 | Section 4 | Sensory event contract and reduced-mode cap are enforced. |
| Predictive and Echo Layers | Deferred in current law section 11 | Section 7 | Preview parity and replay parity gates pass. |

## 14. Anti-Patterns to Avoid

1. Adding future concepts to current-law spec before shipping.
2. Implementing visuals with one-off hardcoded values that bypass token strategy.
3. Shipping atmospheric effects that reduce tactical readability.
4. Shipping sensory features without reduced-sensory fallback.
5. Adding non-deterministic preview logic that diverges from run/replay semantics.

## 15. Implementation Readiness Appendices

This section converts aspirational direction into execution-ready request data.

## 15.1 Target Validation Device Profiles

Primary mobile validation pool:
1. `iPhone 12/13` class:
   - `390x844` CSS portrait baseline.
   - Safari iOS current stable.
2. `Pixel 6/7` class:
   - `412x915` CSS portrait baseline.
   - Chrome Android current stable.
3. Mid-tier Android fallback:
   - `360x800` CSS portrait baseline.
   - Chrome Android current stable.

Secondary validation pool:
1. Tablet:
   - `768x1024` portrait baseline.
2. Desktop command center:
   - `1280x800` and `1440x900`.

Performance capture rule:
1. SLO validation must report device profile used, browser version, and build hash.

## 15.2 Telemetry Schema Appendix (Required for Feature Requests)

Canonical envelope:

```ts
type UiMetricEnvelope = {
  metric: string;
  value: number;
  at: string; // ISO timestamp
  details?: Record<string, unknown>;
};
```

Required events for current aspirational phases:
1. `boot_ready_ms`:
   - emitted when `engine.isReady` is reached.
2. `splash_delayed_ready_pulse_shown`:
   - `value: 1` when delayed-ready pulse threshold (`1500ms`) is crossed.
3. `run_lost_overlay_to_action_ms`:
   - time from loss overlay mount to first actionable button render.
4. `defeat_to_restart_ms`:
   - time from defeat to quick-restart run init dispatch.
5. `sensory_preemption_count`:
   - increments when high-priority sensory interrupts low-priority output.
6. `sensory_low_priority_dropped_count`:
   - increments when low-priority events are coalesced/dropped.

Required `details` keys where relevant:
1. `route`
2. `layoutMode`
3. `deviceProfile`
4. `featureFlags`

## 15.3 Route and Back-Stack Contract (Mobile-First)

Canonical aspirational routes:
1. `/Arcade`:
   - splash plus daily archetype selection.
2. `/`:
   - Hub (training-first).
3. `/Settings`:
   - dedicated settings ledger screen.
4. `/Leaderboard`:
   - leaderboard plus replay launch list.
5. `/Tutorials`:
   - forced-replay tutorial flow.

Back-stack behavior rules:
1. `Arcade -> Hub`:
   - back returns to prior route without resetting selected archetype preview unless run starts.
2. `Hub -> Settings/Leaderboard/Tutorials -> Hub`:
   - return must preserve Hub selected loadout and scroll context.
3. `Gameplay -> Run Lost -> Quick Restart`:
   - bypass Hub and start run directly.
4. `Gameplay -> Run Lost -> View Replay -> Close Replay`:
   - return to post-run context with restart affordance preserved.

Route resilience:
1. Unknown route falls back to Hub with non-blocking toast.
2. Deep links to missing modules must degrade gracefully to Hub until module ships.

## 15.4 Sensory and Accessibility Fallback Rules

1. Unsupported haptics:
   - dispatch becomes no-op and emits fallback telemetry.
2. Audio autoplay blocked:
   - queue low-priority audio until user gesture; do not block gameplay.
3. Reduced motion mode:
   - sensory intensity clamps to `0.0`.
   - non-essential animation flourishes disabled.
4. High-priority sensory fallback:
   - if haptic unavailable, show deterministic visual emphasis cue in same event path.

## 15.5 Asset Constraints and Delivery

Asset ownership and compliance:
1. Splash and texture assets must include license and source attribution metadata in the asset PR.
2. Assets without clear rights metadata cannot ship.

File and format expectations:
1. `splash4`:
   - provide `avif` or `webp` primary, jpg fallback.
   - target transfer budget: `<= 450KB` compressed.
2. `parchment` texture:
   - provide tiling-safe compressed texture.
   - target transfer budget: `<= 250KB` compressed.

Loading strategy:
1. Preload splash hero asset at boot route.
2. Defer non-critical texture variants until idle.
3. Keep low-res placeholder path for slow-network startup.

## 15.6 Rollout and Promotion Plan

Feature flags (recommended):
1. `ui_arcade_splash_v2`
2. `ui_mobile_dock_v2`
3. `ui_defeat_loop_v2`
4. `ui_sensory_dispatcher_v1`
5. `ui_dedicated_hub_routes_v1`

Rollout stages:
1. Stage 0:
   - local and CI validation.
2. Stage 1:
   - internal QA and scripted device matrix runs.
3. Stage 2:
   - limited cohort release.
4. Stage 3:
   - full rollout after SLO pass confirmation.

Promotion handshake to current law:
1. Update `UI_SPEC_CURRENT.md` with shipped behavior and anchors.
2. Link merged tests and SLO report artifacts in PR description.
3. Remove or relabel aspirational item status once promoted.
