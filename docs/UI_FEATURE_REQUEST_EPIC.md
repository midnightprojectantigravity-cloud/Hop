# UI Feature Request Epic - Mobile-First Parchment Productization

Last updated: March 4, 2026  
Source of truth:
1. `docs/UI_SPEC_ASPIRATIONAL.md`
2. `docs/UI_SPEC_CURRENT.md`

## 1. Epic Summary

Deliver the mobile-first UI productization program defined in `UI_SPEC_ASPIRATIONAL.md`, with strict SLO gates and promotion criteria into current law.

Epic outcome:
1. Daily-first arcade splash flow.
2. Training-first Hub with dedicated navigation screens.
3. Thumb-zone optimized gameplay dock and Synapse tray behavior.
4. Defeat loop with one-tap restart/replay.
5. Deterministic sensory dispatcher with priority preemption.

## 2. Epic-Level Acceptance Criteria

1. All blocking gates in `UI_SPEC_ASPIRATIONAL.md` Section 10 pass.
2. Required SLOs in Section 9 pass on devices from Section 15.1.
3. New route/back-stack contract from Section 15.3 is implemented and tested.
4. Telemetry schema from Section 15.2 is emitted for relevant flows.
5. Promoted behavior is documented in `UI_SPEC_CURRENT.md`.

## 3. Child Feature Requests

## FR-A: Material Texture Pass

Scope:
1. Implement parchment/charred material surfaces and token-driven texture layers.

Blocking gate:
1. Contrast ratio `>= 4.5:1` for key text/controls.

Primary anchors:
1. `apps/web/src/index.css`
2. texture assets (per Section 15.5)

## FR-B: Splash Boot Flow

Scope:
1. Implement arcade splash interaction model and transition contract.
2. Add `engine.isReady` delayed-ready pulse behavior.

Blocking gate:
1. Boot-to-hub p95 `< 1500ms`.
2. Input-to-transition-start `< 120ms`.

Primary anchors:
1. `apps/web/src/main.tsx`
2. `apps/web/src/App.tsx`
3. `apps/web/src/components/ArcadeHub.tsx`

## FR-C: Mobile Dock + Defeat Loop

Scope:
1. Thumb-zone dock re-layout and guarded destructive controls.
2. Defeat overlay one-tap `Quick Restart` and `View Replay` behavior.

Blocking gate:
1. Tap-miss `< 5%`.
2. Zero accidental destructive activation in scripted runs.
3. Restart bypasses Hub for all loss states.

Primary anchors:
1. `apps/web/src/app/GameScreen.tsx`
2. `apps/web/src/components/SkillTray.tsx`
3. `apps/web/src/app/AppOverlays.tsx`
4. `apps/web/src/app/run-resume-context.ts`

## FR-D: Sensory Dispatcher

Scope:
1. Add semantic sensory dispatch path with reduced-motion clamp.
2. Enforce high-priority preemption over low-priority output.

Blocking gate:
1. Event latency p95 `< 16ms`.
2. Reduced-motion sensory clamp equals `0.0`.
3. High-priority interruption assertions pass.

Primary anchors:
1. `apps/web/src/app/ui-telemetry.ts`
2. `apps/web/src/App.tsx`

## FR-E: Predictive Ghosting + Visual Echoes

Scope:
1. Standardized pre-commit HP/sigma previews.
2. Deterministic visual memory trails with replay parity.

Blocking gate:
1. Preview parity vs committed outcomes = `100%`.

Primary anchors:
1. `apps/web/src/components/GameBoard.tsx`
2. `apps/web/src/components/juice/*`

## FR-F: Replay Chronicle

Scope:
1. Add timeline pips and jump-to-tick behavior.
2. Improve chronicle markers and replay analysis affordances.

Blocking gate:
1. Jump accuracy = exact tick match.

Primary anchors:
1. `apps/web/src/app/use-replay-controller.ts`
2. `apps/web/src/components/ReplayManager.tsx`

## FR-G: Dedicated Hub Screens

Scope:
1. Build dedicated `SettingsScreen`, `LeaderboardScreen`, `TutorialReplayScreen`.
2. Implement route/back-stack contract from Section 15.3.

Blocking gate:
1. One-tap entry from Hub.
2. Return path preserves Hub selection/scroll context.
3. Tutorial forced path supports explicit skip affordance.

Primary anchors:
1. `apps/web/src/app/SettingsScreen.tsx` (new)
2. `apps/web/src/app/LeaderboardScreen.tsx` (new)
3. `apps/web/src/app/TutorialReplayScreen.tsx` (new)
4. `apps/web/src/app/use-app-routing.ts`

## 4. Execution Order

1. FR-A
2. FR-B
3. FR-C
4. FR-D
5. FR-E
6. FR-F
7. FR-G

## 5. Merge Policy

1. Each FR must include:
   - tests for the affected contracts.
   - SLO evidence on target devices.
   - spec update references.
2. Do not promote to current law until all FR acceptance checks pass.

## 6. Implementation Snapshot (March 4, 2026)

Status:
1. Epic scaffolding is implemented in `apps/web` behind feature flags.
2. All epic flags default to `false`.
3. Web build and current web test suite are passing.

Implemented modules (behind flags):
1. `ui_arcade_splash_v2`:
   - splash gate, delayed-ready pulse, two-step arcade selection support.
2. `ui_mobile_dock_v2`:
   - mobile dock re-layout and guarded destructive action hold behavior.
3. `ui_defeat_loop_v2`:
   - run-lost action-ready telemetry and replay chronicle marker wiring.
4. `ui_sensory_dispatcher_v1`:
   - deterministic dispatcher, reduced-motion clamp, preemption/drop telemetry.
5. `ui_dedicated_hub_routes_v1`:
   - dedicated skeleton routes for Settings, Leaderboard, Tutorials.

## 7. Remaining Promotion Gates

Not yet complete for promotion to current law:
1. Device SLO evidence collection and report attachment.
2. Visual regression and contrast audit artifacts for texture pass.
3. Final licensed art swap and production asset metadata.
4. Full forced-step tutorial replay flow (beyond skeleton route module).

Promotion rule reminder:
1. Keep flags default-off until all blocking gates pass and evidence is attached.
