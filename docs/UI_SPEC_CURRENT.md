# UI Spec Current (Build Law)

**Owner:** [Your Name/Role]  
**Review Cadence:** Every Sprint/Major Milestone  
**Status Taxonomy:** `[SHIP]` = Shipped, `[DEV]` = In Development, `[SPEC]` = Finalized Specification  
**RFC Process:** Changes to this law require a corresponding PR update and an audit against Aspirational SLOs.

Last updated: March 4, 2026  
Authority: Canonical for shipped `apps/web` behavior.  
Companion vision doc: `docs/UI_SPEC_ASPIRATIONAL.md`.

## 1. Scope and Authority

This document is the law for current web UI behavior.

Rules:
1. Anything listed here is expected to be true in current builds.
2. Any PR that changes listed behavior must update this file in the same PR.
3. Future-state concepts belong in `UI_SPEC_ASPIRATIONAL.md` only until implemented.

## 1.1 Experimental Flags (Implemented, Default Off)

These modules exist in code but are not current-law shipped behavior until enabled and promoted.

Storage/loader anchor:
1. `apps/web/src/app/ui-feature-flags.ts`

Experimental flags:
1. `ui_arcade_splash_v2`:
   - splash gate, delayed-ready pulse, two-step arcade flow.
2. `ui_mobile_dock_v2`:
   - mobile dock v2 layout and guarded destructive controls.
3. `ui_defeat_loop_v2`:
   - replay chronicle marker plumbing and run-lost action-ready telemetry.
4. `ui_sensory_dispatcher_v1`:
   - semantic sensory dispatch, reduced-motion clamp, priority preemption.
5. `ui_dedicated_hub_routes_v1`:
   - dedicated `Settings`, `Leaderboard`, `Tutorials` route skeletons.

Law boundary:
1. These remain non-canonical until promoted through aspirational gates.
2. Default production posture keeps these flags disabled.

## 2. Product Posture (Current)

1. Visual identity:
   - Medieval parchment default theme (`light`).
   - Secondary medieval-apocalypse dark theme (`dark`).
2. Device posture:
   - Mobile-first, portrait-primary.
3. UX posture:
   - Expert-first, low-friction tactical loops.
4. Flow priority:
   - Hub start.
   - In-run combat HUD.
   - Replay/defeat loop.

## 3. Current Visual System

Primary implementation anchor: `apps/web/src/index.css`.

## 3.1 Typography

1. Heading font:
   - `--font-heading: 'Cinzel', 'Palatino Linotype', 'Times New Roman', serif`
2. Body font:
   - `--font-body: 'Source Sans 3', 'Segoe UI', sans-serif`

## 3.2 Theme Tokens

1. Runtime theming uses root dataset attributes:
   - `data-theme='light' | 'dark'`
   - `data-motion='snappy' | 'reduced'`
   - `data-hud-density='compact' | 'comfortable'`
   - `data-mobile-layout='portrait_primary'`
2. Current token groups in use:
   - surface, text, border, accent, synapse, overlay, motion.

## 3.3 Motion

1. Canonical token timings:
   - `--motion-fast: 140ms`
   - `--motion-medium: 180ms`
2. Reduced motion mode sets transitions/animations effectively off (`1ms`).

## 3.4 Material Baseline (Current)

1. Parchment/atmosphere is currently expressed via gradients + subtle noise overlays.
2. Dedicated texture assets, torn-edge masks, and splash cinematic material transitions are not current-law behavior.

## 4. Preferences and Persistence (Current)

Implementation anchors:
1. `apps/web/src/app/ui-preferences.ts`
2. `apps/web/src/app/run-resume-context.ts`
3. `apps/web/src/main.tsx`

## 4.1 Preferences Contract

`UiPreferencesV1`:
1. `colorMode: 'light' | 'dark'`
2. `motionMode: 'snappy' | 'reduced'`
3. `hudDensity: 'compact' | 'comfortable'`
4. `mobileLayout: 'portrait_primary'`

## 4.2 Storage Keys (Current)

1. `hop_ui_prefs_v1`
2. `hop_ui_theme_v1`
3. `hop_last_run_context_v1`

## 4.3 Boot Application Rule

Theme/preferences are applied before first React render:
1. `readUiPreferences()`
2. `applyUiPreferencesToRoot(...)`

## 5. Canonical Layout Behavior

Primary implementation anchor: `apps/web/src/app/GameScreen.tsx`.

## 5.1 Unified Runtime Breakpoint Constants

`resolveLayoutMode(width, height)`:
1. `desktop_command_center` when width `>= 1200`.
2. `tablet` when width `>= 768`.
3. Else:
   - `mobile_portrait` when height > width.
   - `tablet` for narrow landscape.

| Mode | Threshold | Primary Intent |
| --- | --- | --- |
| `desktop_command_center` | `W >= 1200px` | Always-visible tactical rails around board. |
| `tablet` | `W >= 768px` | Balanced board focus with reduced rail density. |
| `mobile_portrait` | `H > W` and `W < 768px` | Thumb-zone-first interaction with bottom action dock. |

## 5.2 Breakpoint Arbitration Rule

1. Behavioral decisions should use `data-layout-mode`.
2. Tailwind breakpoints handle styling only.
3. When behavior and styling differ, `data-layout-mode` is authoritative.
4. Any threshold change must update this section and associated tests in the same PR.

## 5.3 In-Run Shell (Current)

Mobile portrait:
1. Top strip: floor, HP, intel/synapse controls.
2. Center: board.
3. Bottom dock:
   - `h-[25svh]`, `min-h-[176px]`, `max-h-[280px]`.
   - action row with `Wait`, `Synapse`, `Hub`, `Reset`.
   - skill tray or synapse tray in the same footprint.

Desktop command center:
1. Left status/control rail.
2. Center board.
3. Right skills rail.
4. Always-visible critical tactical panes.

## 5.4 Hub Shell (Current)

Implementation anchors:
1. `apps/web/src/app/HubScreen.tsx`
2. `apps/web/src/components/Hub.tsx`

1. Mobile:
   - pinned bottom run CTA appears after loadout selection.
2. Desktop:
   - replay and training panels remain visible.
3. Two-tap run start is the expected path:
   - select archetype, start run.

## 5.5 Screen/Module Now vs Future Pointers

| Screen or Module | Current Law Status | Future Spec Pointer |
| --- | --- | --- |
| Boot/Splash cinematic flow | Deferred | `UI_SPEC_ASPIRATIONAL.md` section 3.1 |
| Hub war-room enrichment | Baseline implemented | `UI_SPEC_ASPIRATIONAL.md` section 3.2 |
| In-run mobile ergonomic zoning | Baseline implemented | `UI_SPEC_ASPIRATIONAL.md` section 5.3 |
| Replay chronicle timeline | Deferred | `UI_SPEC_ASPIRATIONAL.md` section 3.4 |
| Overlay unfold system and settings ledger | Deferred | `UI_SPEC_ASPIRATIONAL.md` section 3.6 |
| Sensory dispatcher | Deferred | `UI_SPEC_ASPIRATIONAL.md` section 4.4 |
| Predictive ghosting and echoes | Deferred | `UI_SPEC_ASPIRATIONAL.md` section 7 |

## 6. Canonical Interaction Contracts

## 6.1 Hub Start

1. Start controls do not appear before loadout selection.
2. CTA route mapping:
   - `Start Run` -> `normal`
   - `Daily` -> `daily`

Test anchors:
1. `apps/web/src/__tests__/hub_start_journey.test.ts`

## 6.2 Combat HUD

1. Skill tray states:
   - ready, selected, cooldown, disabled.
2. Input lock blocks commit actions.
3. Synapse mode swaps tray footprint in mobile.

## 6.3 Replay and Defeat

Implementation anchor: `apps/web/src/app/AppOverlays.tsx`.

1. Defeat overlay primary actions:
   - `Quick Restart`
   - `View Replay`
2. Replay controls placement:
   - mobile top.
   - larger screens bottom.
3. Replay import/playback contract is strict Replay V3.

Test anchors:
1. `apps/web/src/__tests__/run_lost_overlay_actions.test.ts`
2. `apps/web/src/__tests__/replay_controls_overlay_layout.test.ts`

## 6.4 Quick Restart Routing

Implementation anchor: `apps/web/src/app/run-resume-context.ts`.

1. Normal mode:
   - restart same loadout with new seed.
2. Daily mode:
   - restart same loadout with stored daily date context.
3. If payload cannot be derived:
   - fallback to Hub exit.

## 6.5 Synapse Intel Policy (Current Law)

Always visible:
1. `UPS`
2. sigma (`z`)
3. signed delta indicators

Capability-gated:
1. name
2. intent badge
3. detailed reveal-bound intel fields

## 7. Current Telemetry Contract

Implementation anchor: `apps/web/src/app/ui-telemetry.ts`.

Emitted metrics:
1. `hub_select_to_start_ms`
2. `defeat_to_restart_ms`
3. `first_action_ms`

Payload:
1. `metric`
2. `value` (rounded ms)
3. `at` (ISO string)
4. optional `details`

## 7.1 Experience SLO Baseline Policy (Current)

1. Current builds emit timing telemetry but do not enforce experience SLO pass/fail gates yet.
2. SLO thresholds are defined in `UI_SPEC_ASPIRATIONAL.md` section 9.
3. Once a module is promoted, its SLO becomes merge-gated current law.

## 8. Current Performance Contract

Implementation anchors:
1. `apps/web/src/app/lazy-screens.ts`
2. `apps/web/src/App.tsx`
3. `apps/web/vite.config.ts`

Current law:
1. Hub/Game/Biome screens are lazy loaded.
2. Idle-time prefetch is active.
3. Chunking strategy is explicit for vendor/engine/ui groups.

## 9. Current Accessibility Baseline

1. Mobile frequent controls target >= 44px touch height.
2. Reduced motion mode is implemented.
3. Keyboard shortcut exists for Synapse toggle (`I` / `Escape` behavior).
4. Full keyboard parity and WCAG audit remain outside current-law completeness.

## 10. Merge Gates (Current)

## 10.1 Required Automated Checks

1. `npx vitest run apps/web/src/__tests__ --silent`
2. `npx tsc -p apps/web/tsconfig.app.json --noEmit`
3. `npm --prefix apps/web run build`

## 10.2 Key Contract Tests

1. `game_layout_mode.test.ts`
2. `hub_start_journey.test.ts`
3. `run_lost_overlay_actions.test.ts`
4. `replay_controls_overlay_layout.test.ts`
5. `ui_preferences.test.ts`
6. `run_resume_context.test.ts`

## 11. Deferred (Not Current Law)

Deferred targets are tracked in `docs/UI_SPEC_ASPIRATIONAL.md`, including:
1. Sensory tokens (audio/haptics runtime implementation).
2. Predictive ghosting across all interaction contexts.
3. Replay timeline pips/jump controls.
4. Visual echo trails.
5. Atmospheric splash cinematic flow.
6. Material-control motifs (wax seals, brass sliders).

Note:
1. Some deferred items now have in-code scaffolding behind flags (section 1.1), but remain deferred for current-law purposes.

## 12. Promotion Protocol (Aspirational -> Current)

An item may be promoted into this document only when all conditions are met:
1. Implemented in shipped web code paths.
2. Covered by automated tests or deterministic validation checks.
3. Included in merge gate command execution for relevant scope.
4. Documented with file anchors and behavior-level rules.
