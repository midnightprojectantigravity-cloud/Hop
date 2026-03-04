# UI/UX Comprehensive Guide (Legacy Combined Snapshot)

Status: Superseded by split canon docs.

Canonical docs:
1. Current build law: `docs/UI_SPEC_CURRENT.md`
2. Aspirational north star: `docs/UI_SPEC_ASPIRATIONAL.md`

Use this file as historical context only. Do not treat it as the active law document.

Last updated: March 4, 2026
Scope: `apps/web` only, based on the currently shipped code paths.

## 1. Purpose

Legacy archive of the pre-split combined UI guide.

Active source-of-truth docs are:
1. `docs/UI_SPEC_CURRENT.md` for shipped-law behavior.
2. `docs/UI_SPEC_ASPIRATIONAL.md` for north-star targets.

## 2. Product UX Direction (As Implemented)

1. Default look: medieval parchment, light-first.
2. Secondary look: dark medieval-apocalypse palette.
3. Device priority: mostly mobile, portrait-first interaction.
4. Interaction priority order:
   - Hub start flow.
   - In-run combat HUD.
   - Replay and defeat loop.
5. Core posture: expert-first speed, optional assistance via Synapse/tutorial overlays.

Primary references:
1. `apps/web/src/index.css`
2. `apps/web/src/App.tsx`
3. `apps/web/src/app/HubScreen.tsx`
4. `apps/web/src/app/GameScreen.tsx`
5. `apps/web/src/app/AppOverlays.tsx`

## 2.1 Player Experience Targets (Product North Star)

This section reframes the technical contracts as player-feel outcomes:
1. Flow velocity:
   - Return the player to meaningful action in seconds, not menus.
2. Tactical trust:
   - Actions should feel predictable, legible, and fair before commit.
3. One-hand momentum:
   - Most frequent actions should live inside the natural thumb reach zone.
4. Sensory confirmation:
   - Important state changes should feel physical (visual + audio + haptic).
5. Story-form feedback:
   - Runs should end with memorable "what happened" language, not raw stats only.

## 3. Visual Style Guide

## 3.1 Typography

1. Heading/display font:
   - `--font-heading: 'Cinzel', 'Palatino Linotype', 'Times New Roman', serif`
2. Body/system font:
   - `--font-body: 'Source Sans 3', 'Segoe UI', sans-serif`
3. Usage pattern:
   - Headings and key titles use heavy uppercase and tighter tracking.
   - Secondary info uses smaller uppercase labels with high letter-spacing.

## 3.2 Theme Tokens

Tokens are centralized in `apps/web/src/index.css` and controlled via root data attributes.

### Light Theme (`:root`)

1. Surfaces:
   - `--surface-app: #f4ecd8`
   - `--surface-board: #efe4cd`
   - `--surface-panel: #f9f2e3`
   - `--surface-panel-muted: #f2e8d5`
   - `--surface-panel-hover: #ebddc5`
2. Text:
   - `--text-primary: #2f261b`
   - `--text-secondary: #4a3b2b`
   - `--text-muted: #806e5a`
   - `--text-inverse: #fef9ef`
3. Accent and semantic:
   - `--accent-brass: #b48d50`
   - `--accent-royal: #275292`
   - `--accent-danger: #c84f35`
   - Soft/border variants are tokenized.
4. Synapse:
   - `--synapse-surface: #153141`
   - `--synapse-border: rgba(70, 132, 170, 0.45)`
   - `--synapse-text: #e2f8ff`

### Dark Theme (`:root[data-theme='dark']`)

1. Dark surfaces:
   - `--surface-app: #18120e`
   - `--surface-board: #150f0c`
   - `--surface-panel: #1f1712`
2. Dark accents:
   - Brass stays warm (`--accent-brass: #d6a55e`)
   - Royal shifts to blood-red family (`--accent-royal: #8f3b3f`)
   - Danger remains warm high-contrast (`--accent-danger: #e2674f`)
3. Synapse dark palette:
   - `--synapse-surface: #2a1812`
   - `--synapse-border: rgba(193, 119, 89, 0.45)`

## 3.3 Motion Tokens and Rules

1. Motion tokens:
   - `--motion-fast: 140ms`
   - `--motion-medium: 180ms`
2. Reduced mode:
   - `:root[data-motion='reduced']` forces transition/animation durations to `1ms`.
3. Animation style:
   - Fast, snappy transitions favored over long cinematic fades.
4. Existing caveat:
   - Some legacy animations still use hardcoded timings (`0.3s`, `0.6s`, etc.) rather than motion tokens.

## 3.4 Component Styling Conventions

1. Primary CTAs:
   - High-contrast fills (`accent-brass`, `accent-royal`) with uppercase heavy text.
2. Secondary actions:
   - Muted panel backgrounds with subtle border emphasis.
3. Touch targets:
   - Frequent mobile controls use `min-h-11` or `min-h-12` sizing.
4. Card language:
   - Rounded corners (`rounded-xl` to `rounded-3xl`), low blur, soft border hierarchy.
5. Information density:
   - Compact uppercase labels + stronger numeric emphasis for tactical stats.

## 3.5 Sensory Tokens (Audio + Haptics)

Status:
1. Audio token system: `Future feature request`.
2. Haptic token system: `Future feature request`.

Even though runtime implementation is not present yet, this is now the required product contract.

### Haptic Token Draft

1. `haptic-nav-light`:
   - Use: non-destructive navigation taps (tab/screen toggles, minor tray toggles).
2. `haptic-action-medium`:
   - Use: successful action commit (`MOVE`, `WAIT`, `USE_SKILL`).
3. `haptic-threat-heavy`:
   - Use: high-risk signals (`z >= 2`, lethal preview, critical damage intake).
4. `haptic-outcome-impact`:
   - Use: defeat/victory overlays and major run-state transitions.

### Audio Category Draft

1. `ui-parchment-slide`:
   - Use: panel/tray transitions.
2. `ui-brass-clink`:
   - Use: positive confirm actions (start run, successful selection).
3. `ui-danger-drum`:
   - Use: warnings (critical HP, imminent threat spikes).
4. `ui-synapse-chime`:
   - Use: entering/exiting Synapse mode, high-value intel reveals.

Implementation note:
1. When added, sensory tokens should be wired as semantic events, not direct component-local audio/haptic calls.
2. Reduced-motion mode should pair with reduced sensory intensity mode in a follow-up accessibility pass.

## 4. Preferences, Persistence, and Runtime Theme Application

Source: `apps/web/src/app/ui-preferences.ts`, `apps/web/src/main.tsx`

## 4.1 `UiPreferencesV1`

```
{
  colorMode: 'light' | 'dark',
  motionMode: 'snappy' | 'reduced',
  hudDensity: 'compact' | 'comfortable',
  mobileLayout: 'portrait_primary'
}
```

## 4.2 Storage Keys

1. `hop_ui_prefs_v1`
2. `hop_ui_theme_v1`
3. `hop_last_run_context_v1`

## 4.3 Boot-Time Theme Application

`main.tsx` applies persisted preferences before rendering:
1. `readUiPreferences()`
2. `applyUiPreferencesToRoot(...)`

This avoids initial theme mismatch flashes.

## 5. Layout System: Mobile vs Desktop

## 5.1 Runtime Layout Modes

Source: `resolveLayoutMode` in `apps/web/src/app/GameScreen.tsx`

1. `desktop_command_center` when width `>= 1200`.
2. `tablet` when width `>= 768`.
3. Otherwise:
   - `mobile_portrait` when `height > width`
   - `tablet` when landscape.

`data-layout-mode` is set on the root game shell for diagnostics/testing.

## 5.2 In-Run Game Shell Contract

Source: `apps/web/src/app/GameScreen.tsx`

### Mobile Portrait (`< lg` visual structure)

1. Top strip:
   - Floor, HP, Intel mode toggle, Synapse toggle.
2. Center:
   - Board region with effects and overlays.
3. Bottom action dock:
   - Height contract: `h-[25svh]`, `min-h-[176px]`, `max-h-[280px]`.
   - Contains `Wait`, `Synapse`, `Hub`, `Reset` and Skill/Synapse tray.

### Mobile Portrait Thumb-Zone Contract (Interaction Density)

Status:
1. Dock height and primary-action clustering: `Implemented`.
2. Explicit safe-zone vs stretch-zone placement matrix: `Partially implemented`.
3. Guarded destructive long-press confirmation interaction: `Future feature request`.

Target interaction map (required for future refinements):
1. Safe zone (bottom-right / center-right, easiest reach):
   - High-frequency actions: primary skill taps, `Wait`, Synapse inspect/clear loops.
2. Neutral zone (center-left):
   - Medium-frequency actions: mode toggles and context-dependent secondary actions.
3. Stretch or guarded zone (upper-left of dock or farther edge):
   - Dangerous/irreversible actions: `Reset`, `Hub Exit`.
4. Guard pattern:
   - destructive actions in the guarded zone should require long-press wax-seal confirmation in future state.

Current behavior note:
1. The current dock already keeps high-frequency controls in the bottom band.
2. A stricter positional contract for destructive actions should be enforced in a follow-up UI pass.
3. Current action row ordering does not yet enforce safe-zone priority via explicit layout transforms (for example `flex-row-reverse`).

### Desktop (`lg` and above visual structure)

1. Left panel (`w-80`):
   - Full tactical UI/status controls (`UI` component).
2. Center:
   - Board focus region.
3. Right panel (`w-80`):
   - Tactical skills and related controls.
4. Always-visible tactical panes are preserved.
5. Synapse + skills simultaneous visibility:
   - current behavior allows right-side skills to remain visible while synapse intel appears in-board when Synapse mode is active (`Partially implemented` relative to fully dedicated dual-pane future).

## 5.3 Hub Shell Contract

Sources:
1. `apps/web/src/app/HubScreen.tsx`
2. `apps/web/src/components/Hub.tsx`

### Mobile

1. Theme toggle remains accessible at top-left.
2. Advanced options are behind `details` disclosures.
3. Start CTA appears as fixed bottom bar after loadout selection:
   - `Start Run`
   - `Daily`

### Desktop

1. Preferences controls visible on top-left (theme, motion, HUD density).
2. Hub header shows capability runtime toggles.
3. Right-side panels for replay and training are always visible.

## 5.4 Breakpoint Notes

1. Visual panel switching uses Tailwind breakpoints (`lg`, `sm`).
2. `data-layout-mode` thresholds (desktop at `1200`) are not identical to Tailwind `lg` (`1024` default).
3. Keep this difference in mind when adding mode-dependent behavior.

## 6. UX Flows and Behavioral Contracts

## 6.1 Hub Start Flow

1. Loadout selection is mandatory before start buttons appear.
2. Two explicit run modes:
   - Normal
   - Daily
3. Intent:
   - Two deliberate taps: select archetype, start run.

Validated by:
1. `apps/web/src/__tests__/hub_start_journey.test.ts`

## 6.2 In-Run Combat HUD

1. Frequent actions stay in bottom zone on mobile.
2. Skill tray states:
   - Ready
   - Selected
   - Cooldown
   - Disabled (input lock, missing spear)
3. Synapse mode swaps into same interaction footprint as skills tray.
4. Player controls are disabled/guarded during input lock and turn resolution.

## 6.2.1 Predictive Feedback Contract ("Ghosting")

Status:
1. Deterministic intent preview and Synapse deltas: `Partially implemented`.
2. Unified hover/long-press ghost projection UX: `Future feature request`.

Desired contract:
1. On hover/long-press of a candidate tile/target, show ghosted post-action outcome before commit.
2. HP projection:
   - Target HP bar should preview projected delta without committing the action.
3. Threat projection:
   - `UPS` and sigma (`z`) changes should be visualized as signed deltas.
4. Commit clarity:
   - Predicted state and committed state should use related but visually distinct treatments.

Current implementation details:
1. Synapse already surfaces per-entity `UPS`/state delta badges.
2. Full "single interaction ghost preview" policy across all targeting contexts is not yet standardized.

## 6.3 Replay and Defeat Loop

Sources:
1. `apps/web/src/app/AppOverlays.tsx`
2. `apps/web/src/app/use-replay-controller.ts`
3. `apps/web/src/components/ReplayManager.tsx`

1. Defeat overlay primary actions:
   - `Quick Restart`
   - `View Replay`
2. Replay controls placement:
   - Top on mobile (`top-3`)
   - Bottom on larger screens (`sm:bottom-12`)
3. Manual replay import:
   - Strict `ReplayEnvelopeV3` validation.
   - Clear parse/schema errors shown to user.

Validated by:
1. `run_lost_overlay_actions.test.ts`
2. `replay_controls_overlay_layout.test.ts`

## 6.4 Quick Restart Routing

Source: `apps/web/src/app/run-resume-context.ts`

1. Normal mode quick restart:
   - same loadout
   - fresh seed
2. Daily mode quick restart:
   - same loadout
   - deterministic daily date context
3. Fallback:
   - if restart payload cannot be derived, UI exits to Hub.

Validated by:
1. `run_resume_context.test.ts`

## 6.5 Synapse Interaction Model

1. Toggle:
   - UI button on mobile/desktop
   - keyboard shortcut `I`
2. Selection modes:
   - empty
   - tile
   - entity
3. Auto-clear behavior:
   - clears stale selections when actor/tile no longer valid.
4. Global visual mode:
   - desaturation + edge-burn effect via `.synapse-vision-active`.

## 6.5.1 Intel Reveal Logic (Information Gap Policy)

Status: `Implemented with explicit policy`.

Policy contract:
1. Always visible (bypass intel gating):
   - `UPS`
   - Sigma / `z` score
   - signed risk deltas
2. Capability-gated:
   - actor name
   - intent badge
   - detailed stat fields depending on reveal mode/rules

Why this matters:
1. The player always receives strategic threat magnitude.
2. Identity/intent uncertainty is preserved for tactical tension and scouting value.

Implementation anchors:
1. `SynapseBottomTray` always renders UPS/z-score blocks from preview scores.
2. Name/intent rendering paths route through `getUiActorInformation(...)` reveal gating.

## 6.6 Visual Memory Contract ("Echo System")

Status:
1. Full previous-position ghost trail system: `Future feature request`.
2. Partial memory aids via current overlays/deltas: `Implemented`.

Future contract:
1. Show short-lived ghost markers for prior unit positions after movement resolution.
2. Echo lifetimes should be brief and deterministic (for readability and replay parity).
3. Synapse mode should optionally intensify echoes to reduce tactical memory load.

Rationale:
1. Players should not have to mentally reconstruct every move path under pressure.
2. Echoes turn turn-history into immediate tactical context.

## 7. Telemetry and UX Metrics

Source: `apps/web/src/app/ui-telemetry.ts`, emit sites in `App.tsx`

Emitted metric events (`window` custom event: `hop-ui-metric`):
1. `hub_select_to_start_ms`
2. `defeat_to_restart_ms`
3. `first_action_ms`

Envelope shape:
1. `metric`
2. `value` (rounded ms)
3. `at` (ISO timestamp)
4. optional `details`

## 7.1 Narrative UX Metrics (Legend Layer)

Status: `Future feature request`.

Current telemetry focuses on latency/flow timing. To improve emotional retention, add narrative metrics:
1. `peak_ups_seen`:
   - highest observed threat magnitude in run.
2. `turns_survived_above_sigma_2`:
   - count of turns survived under high pressure (`z >= 2`).
3. `deadliest_encounter_signature`:
   - compact descriptor (enemy archetype + floor + threat tier).

Display targets:
1. Defeat overlay:
   - "You survived +X sigma pressure for Y turns."
2. Victory overlay:
   - "Deadliest encounter overcome: <signature>."

Design intent:
1. Make outcomes feel like stories, not only score tables.

## 8. Performance Architecture (UI Side)

Sources:
1. `apps/web/src/app/lazy-screens.ts`
2. `apps/web/src/App.tsx` (idle prefetch effect)
3. `apps/web/vite.config.ts` (manualChunks)

Current setup:
1. Route-level lazy modules:
   - `HubScreen`
   - `GameScreen`
   - `BiomeSandbox`
2. Cached dynamic imports for both lazy render and explicit prefetch.
3. Idle-time prefetch based on current route/game status.
4. Manual chunk groups:
   - vendor (`react`, `react-dom`, misc)
   - engine (`core`, `systems`, `skills`, `scenarios`)
   - UI feature chunks (`ui-game-board`, `ui-juice`, `ui-synapse`, `ui-biome-sandbox`)

## 9. Accessibility and Ergonomics Baseline

1. Mobile touch target baseline is generally >= 44px (`min-h-11`/`min-h-12`) on high-frequency controls.
2. Reduced motion is globally supported via root motion mode dataset.
3. Contrast is controlled by tokenized light/dark palettes, but full WCAG audit is still a manual gate.
4. Keyboard affordances currently exist for Synapse toggling, but full keyboard parity is not yet universal.

## 10. QA and Validation Checklist

## 10.1 Automated

1. `game_layout_mode.test.ts`:
   - width matrix behavior and layout mode thresholds.
2. `hub_start_journey.test.ts`:
   - start CTA visibility and mode routing.
3. `run_lost_overlay_actions.test.ts`:
   - quick restart and replay button wiring.
4. `replay_controls_overlay_layout.test.ts`:
   - mobile-top/desktop-bottom replay controls positioning.
5. `ui_preferences.test.ts`:
   - preference defaults, persistence, and root dataset application.
6. `run_resume_context.test.ts`:
   - restart payload derivation and persistence.

## 10.2 Manual Matrix (Recommended)

Target widths:
1. `360`
2. `390`
3. `430`
4. `768`
5. `1280`
6. `1440`

Key flows:
1. Hub select -> start run.
2. In-run actioning (skill, wait, synapse, reset, exit).
3. Defeat -> quick restart and defeat -> replay.
4. Replay start/step/close.

## 11. Implementation Rules for Future UI Changes

1. Use existing CSS tokens; avoid introducing hardcoded colors in feature components.
2. Keep mobile one-hand action frequency in the bottom zone.
3. Preserve defeat overlay primary actions and quick restart bypass behavior.
4. Preserve strict replay v3 import and playback validation behavior.
5. Add or update tests whenever changing:
   - layout breakpoints
   - start/restart routing
   - replay controls placement
   - preference persistence contract
6. Enforce material consistency:
   - core controls should read as forged (brass), pressed (wax), or cut (leather/parchment), not generic web controls.
7. Enforce grim threat coupling:
   - when a hostile unit at `z >= 2` is selected in Synapse, the global atmospheric filter should darken/desaturate deterministically.
8. Enforce visual memory materiality:
   - ghost/echo movement trails should inherit parchment-grain masking so memory cues feel integrated with the world surface.

## 12. Known Gaps and Follow-Up

1. `mobileLayout` preference currently has one implemented value (`portrait_primary`).
2. Some animation timings still bypass motion tokens and should be normalized.
3. Full accessibility audit (contrast + keyboard-only workflows) should be completed as a dedicated pass.
4. Replay-guided mandatory tutorial flow remains future scope; current tutorial path is scenario-based.
5. Sensory token layer (audio/haptics) is defined in spec but not implemented.
6. Unified predictive ghosting interactions are partial and need a dedicated implementation pass.
7. Visual memory echo system is not yet implemented.
8. Narrative UX metrics are not yet emitted or surfaced in overlays.

## 13. Sensory and Predictive Polish (North Star)

This section is the productization bridge between current implementation and world-class arcade feel.

## 13.1 Pillars

1. Sensory confirmation:
   - every key state transition should feel tactile and audible.
2. Predictive fairness:
   - players should preview probable outcomes before commitment.
3. Ergonomic rhythm:
   - one-handed play should minimize stretch and accidental destructive taps.
4. Tactical memory support:
   - the UI should remember recent board history for the player.
5. Narrative aftermath:
   - run-end screens should tell a story, not just report a score.

## 13.2 Implementation Status Matrix

1. Parchment + dark-apocalypse visual identity:
   - `Implemented`.
2. Mobile-first shell + bottom action dock:
   - `Implemented`.
3. Synapse intel deltas and partial predictive scaffolding:
   - `Partially implemented`.
4. Audio + haptic semantic tokens:
   - `Future feature request`.
5. Universal ghosting previews across all targeting:
   - `Future feature request`.
6. Echo memory layer:
   - `Future feature request`.
7. Narrative legend metrics in overlays:
   - `Future feature request`.

## 13.3 Next Tranche Acceptance Criteria (Recommended)

1. Add semantic audio+haptic dispatch layer with at least four token categories.
2. Add ghost preview behavior for at least one core skill family and basic movement.
3. Enforce thumb-zone placement policy for destructive vs high-frequency controls.
4. Ship a minimal deterministic echo marker pass for enemy/player prior positions.
5. Add at least one narrative metric line to defeat and victory overlays.

## 14. Screen Manifestation Blueprint (War Room to Chronicler)

This section translates implementation contracts into the intended sensory "tabletop command" experience.

## 14.1 Strategic Hub: "The War Room"

Target feeling:
1. The Hub should feel like a physical command table, not a neutral app menu.
2. Archetype selection should feel tactile and immediate.

Current alignment:
1. Parchment grain, brass accents, and medieval typography:
   - `Implemented`.
2. Mobile-centered vertical flow with pinned bottom start CTA after archetype selection:
   - `Implemented`.
3. Desktop split with persistent replay/training archive panel:
   - `Implemented`.
4. Daily streak + premium command-currency war-room header:
   - `Future feature request`.
5. Trinity propensity summary surfaced directly on selection:
   - `Future feature request`.

Implementation anchors:
1. `apps/web/src/components/Hub.tsx`
2. `apps/web/src/components/ArchetypeSelector.tsx`
3. `apps/web/src/app/HubScreen.tsx`

## 14.2 Main Gameplay: "The Living Grid"

Target feeling:
1. The board is the center of attention; HUD supports without obstruction.
2. One-hand action loops stay fast and predictable.

Current alignment:
1. Mobile portrait structure (top strip + center board + bottom dock):
   - `Implemented`.
2. Bottom dock at fixed proportional height (`25svh`, min/max clamps):
   - `Implemented`.
3. Synapse tray occupying the same footprint as skill tray:
   - `Implemented`.
4. Synapse edge-burn/desaturation shift:
   - `Implemented`.
5. UPS/sigma chips and deltas in Synapse tray:
   - `Implemented`.
6. Dedicated `Undo` control in the high-frequency row:
   - `Future feature request` (current row is `Wait`, `Synapse`, `Hub`, `Reset`).
7. Segment-based HP bar with projected-damage flicker in top strip:
   - `Future feature request` (current top strip is numeric HP + max HP).

Implementation anchors:
1. `apps/web/src/app/GameScreen.tsx`
2. `apps/web/src/components/SkillTray.tsx`
3. `apps/web/src/components/synapse/SynapseBottomTray.tsx`

## 14.3 Replay Experience: "The Chronicler"

Target feeling:
1. Replay should feel like tactical post-mortem, not passive playback.
2. Exit-to-action path should remain immediate.

Current alignment:
1. Replay controls move to top on mobile for board visibility:
   - `Implemented`.
2. Replay controls remain bottom-positioned on larger screens:
   - `Implemented`.
3. Chronicle-styled replay identity in overlay:
   - `Partially implemented`.
4. Desktop timeline with event pips and jump-to-tick:
   - `Future feature request`.
5. Replay overlay includes always-visible `Quick Restart`:
   - `Future feature request` (quick restart is currently in defeat overlay, not replay controls).

Implementation anchors:
1. `apps/web/src/app/AppOverlays.tsx`
2. `apps/web/src/app/use-replay-controller.ts`
3. `apps/web/src/components/ReplayManager.tsx`

## 14.4 Tutorials and Scenarios: "Vellum Instruction"

Target feeling:
1. Tutorials should read like tactical intelligence overlays.
2. Experts should skip instantly; beginners should get precise guided interaction.

Current alignment:
1. Scenario tutorials and dismissible instruction overlay:
   - `Implemented`.
2. Forced-click guided path (specific hex/skill lockouts):
   - `Future feature request`.
3. Board darkening with spotlighted required interaction cells:
   - `Future feature request`.
4. Synapse-native tutorial narrative for UPS/sigma interpretation:
   - `Future feature request`.

Implementation anchors:
1. `apps/web/src/app/AppOverlays.tsx`
2. `apps/web/src/components/TutorialManager.tsx`

## 14.5 Layout Contract Summary (Visualization-to-Code)

| Screen | Mobile Pivot | Desktop Expansion | Current Status |
| --- | --- | --- | --- |
| Hub | Pinned bottom start CTA after loadout select | Persistent replay/training side archive + preferences | Implemented |
| Combat | Bottom 25% action dock + top status strip | Left status panel, center board, right skills panel | Implemented |
| Synapse | Thread/context flows into dock footprint | Persistent high-density intel alongside board | Partially implemented |
| Replay | Controls pinned to top for sightline clarity | Bottom-positioned control rail | Implemented |
| Replay Timeline | Minimal play/pause/step controls | Event-pip timeline with jump-to-tick | Future feature request |

## 14.6 Alignment Verdict: Does This Visualization Fit Current Code?

Short answer:
1. Yes, the visualization strongly aligns with the current architecture and is feasible without structural rewrites.

Why:
1. `data-layout-mode` in `GameScreen.tsx` already supports mode-specific behavior contracts.
2. The mobile/desktop shell split and bottom-dock pattern are already in place.
3. Synapse has the right state model for a richer predictive layer.
4. Replay/defeat flows already support rapid "review then retry" loops.

What still needs dedicated implementation:
1. Sensory tokens (audio/haptics).
2. Universal ghosting outcome previews.
3. Explicit thumb-zone position policy enforcement.
4. Replay timeline pips and jump controls.
5. Replay-screen quick restart CTA parity.

## 15. Now vs Future State (Per Screen and Module)

This section is the explicit implementation tracker for UI description clarity.

Reading guide:
1. `Now` = behavior present in current code.
2. `Future` = planned/refactor target not fully shipped yet.

## 15.1 App Shell and Global UI Systems

| Module | Now | Future | File Anchors |
| --- | --- | --- | --- |
| App Shell and Routing | Route-driven shell with lazy-loaded Hub/Game/Biome screens; replay-aware state transitions. | Add cross-screen UX state bus for sensory events and predictive overlays. | `apps/web/src/App.tsx`, `apps/web/src/app/lazy-screens.ts` |
| Theme and Preferences | `UiPreferencesV1` persisted (`light/dark`, `snappy/reduced`, `compact/comfortable`, `portrait_primary`) and applied at boot. | Add additional mobile layout modes and expanded preference controls. | `apps/web/src/app/ui-preferences.ts`, `apps/web/src/main.tsx` |
| Global Style Tokens | Medieval parchment token system with light default and dark secondary mode. | Normalize remaining hardcoded animation durations into tokenized motion system. | `apps/web/src/index.css` |
| UX Telemetry | Emits flow metrics: `hub_select_to_start_ms`, `defeat_to_restart_ms`, `first_action_ms`. | Add narrative/legend metrics (`peak_ups_seen`, deadliest encounter descriptors). | `apps/web/src/app/ui-telemetry.ts`, `apps/web/src/App.tsx` |

## 15.2 Hub Screen Family

| Module | Now | Future | File Anchors |
| --- | --- | --- | --- |
| `HubScreen` | Theme/motion/density controls, route toggles, replay error/tutorial overlays, arcade entry. | Richer top-level war-room summaries (streak, currency, progression highlights). | `apps/web/src/app/HubScreen.tsx` |
| `Hub` | Two-tap start loop, capability toggles, mobile pinned start CTA, desktop replay/tutorial side surfaces. | Explicit thumb-zone micro-layout rules and richer archive filtering/sorting controls. | `apps/web/src/components/Hub.tsx` |
| `ArchetypeSelector` | Card-based archetype selection with class art/icon and starter skill chips. | Add trinity propensity summaries and deeper tactical preview details per archetype. | `apps/web/src/components/ArchetypeSelector.tsx` |
| `ArcadeHub` | Daily draft pair selection and immediate launch path. | Add richer daily metadata and narrative run context cards. | `apps/web/src/components/ArcadeHub.tsx` |

## 15.3 In-Run Gameplay Screen Family

| Module | Now | Future | File Anchors |
| --- | --- | --- | --- |
| `GameScreen` Shell | Mobile portrait top/center/bottom structure and desktop 3-region tactical shell with `data-layout-mode`. | Stronger ergonomic zoning, safe-zone-biased dock ordering, and long-press guarded destructive actions. | `apps/web/src/app/GameScreen.tsx` |
| `UI` Side Panel | Always-visible desktop tactical status and controls in left rail. | Expand expert-density controls without collapsing core readability. | `apps/web/src/components/UI.tsx` |
| `SkillTray` | Ready/selected/cooldown/disabled states; compact mode for mobile dock. | Predictive outcome overlays, clearer per-skill impact deltas before commit, and safe-zone-first ordering on mobile dock. | `apps/web/src/components/SkillTray.tsx` |
| `SynapseBottomTray` | Tile/entity intel, UPS and sigma data, signed deltas, clear action, docked swap with skills tray. | Unified ghosting previews, echo memory overlays, and richer thread event storytelling. | `apps/web/src/components/synapse/SynapseBottomTray.tsx` |
| Board and Juice Layers | Deterministic board rendering with existing visual effects and simulation feedback hooks. | Add standardized predictive ghost layer and optional memory echoes with deterministic lifetimes. | `apps/web/src/components/GameBoard.tsx`, `apps/web/src/components/juice/*` |

## 15.4 Overlay and Outcome Modules

| Module | Now | Future | File Anchors |
| --- | --- | --- | --- |
| `RunLostOverlay` | Primary actions `Quick Restart` and `View Replay`; run loop speed preserved. | Add legend-style summary lines (e.g., high-threat survival highlights). | `apps/web/src/app/AppOverlays.tsx` |
| `RunWonOverlay` | Victory summary with score and hub return action. | Add narrative "deadliest encounter" and pressure-survival achievements. | `apps/web/src/app/AppOverlays.tsx` |
| `ReplayControlsOverlay` | Mobile top placement and desktop bottom rail; play/pause/step/close controls. | Add desktop timeline with event pips and jump-to-tick controls; add replay-context quick restart parity. | `apps/web/src/app/AppOverlays.tsx` |
| Tutorial Instruction Overlay | Dismissible tutorial objective surface. | Spotlighted forced-interaction tutorial mode and Synapse-native teaching overlays. | `apps/web/src/app/AppOverlays.tsx`, `apps/web/src/components/TutorialManager.tsx` |
| Feedback Overlays | Resolving, floor intro, replay error, and mobile toasts are wired and state-sensitive. | Add sensory token integrations (audio/haptics) on key feedback events. | `apps/web/src/app/AppOverlays.tsx` |

## 15.5 Replay and Tutorial Tooling Modules

| Module | Now | Future | File Anchors |
| --- | --- | --- | --- |
| `ReplayManager` | Replay V3-only import and diagnostics; leaderboard and recent run access. | Chronicle-mode analysis views with jump points and richer tactical annotations. | `apps/web/src/components/ReplayManager.tsx` |
| Replay Controller | Strict V3 validation, deterministic init-state bootstrapping, step/autoplay controls. | Event-indexed navigation API for timeline pips and labeled replay checkpoints. | `apps/web/src/app/use-replay-controller.ts` |
| Run Recording | Stores replay and leaderboard records in V3 format with diagnostics metadata. | Record richer narrative metadata to support end-of-run storytelling. | `apps/web/src/app/use-run-recording.ts` |
| Tutorial Manager | Scenario-based training entry points with instruction text overlays. | Full guided tutorial track with forced-click progression and spotlight masks. | `apps/web/src/components/TutorialManager.tsx` |

## 15.6 Cross-Cutting UX Gaps (Immediate Priorities)

1. Sensory layer contract (audio + haptics) is specified but not implemented.
2. Predictive ghosting is partial and not uniformly applied across action contexts.
3. Replay desktop timeline and event pips are not yet implemented.
4. Visual memory echo system is not yet implemented.
5. Narrative metrics are not yet surfaced in outcome overlays.

## 16. Atmospheric Identity (Dark Medieval-Apocalypse)

This section captures the "material and mood" layer from the splash-art direction and binds it to implementation checkpoints.

## 16.1 Boot and Splash Flow: "First 60 Seconds"

Target experience:
1. The opening should feel like ignition: atmosphere first, strategy second.
2. Transition should preserve continuity from splash stakes to Hub readiness.

Now vs Future:

| Module | Now | Future | File Anchors |
| --- | --- | --- | --- |
| Boot Sequence | App loads directly into routed shell with functional fallback screens. | Splash sequence with `110%` -> `100%` slow zoom (Ken Burns), with deterministic tap-to-start transition timing. | `apps/web/src/main.tsx`, `apps/web/src/App.tsx` |
| Ignition Loop | No splash-specific atmospheric pulse loop. | 4-second fire pulse loop using subtle `brightness`/`hue-rotate` animation to simulate ignition flicker without UI distraction. | `apps/web/src/index.css` (future splash classes), `apps/web/src/App.tsx` |
| Splash -> Hub Transition | Standard route/screen transition behavior only. | Warrior silhouette retained as transition mask while burning background fades into parchment hub material ("World" -> "War Room"). | `apps/web/src/App.tsx`, `apps/web/src/app/HubScreen.tsx`, `apps/web/src/index.css` |
| Splash Sensory Cue | No audio/haptic ignition cue currently. | On tap: fire `haptic-outcome-impact` and `ui-danger-drum` semantic category at moderated mix level. | `apps/web/src/app/ui-telemetry.ts` (future event bus extension), future sensory dispatcher |

## 16.2 Settings Surface: "Commander's Ledger"

Target experience:
1. Settings should read as tactical artifacts, not generic web controls.
2. High-frequency comfort controls should remain thumb-safe on mobile.

Now vs Future:

| Module | Now | Future | File Anchors |
| --- | --- | --- | --- |
| Settings Location | Theme/motion/density controls are available in Hub shell and are functional. | Dedicated "Ledger" visual treatment with stronger material affordance and persistent settings identity. | `apps/web/src/app/HubScreen.tsx` |
| Toggle Controls | Standard bordered button controls for on/off states. | Wax-seal toggles (pressed seal vs faded indentation) with semantic danger/comfort color modes. | `apps/web/src/app/HubScreen.tsx`, `apps/web/src/components/Hub.tsx`, `apps/web/src/index.css` |
| Slider Controls | No dedicated material slider pattern yet. | Brass-rod slider system for volume/sensitivity with weighted handle visual. | `apps/web/src/index.css` (new component styles) |
| Mobile Settings Ergonomics | Basic mobile placement currently; no explicit three-zone settings map. | Tactical zone mapping: comfort controls bottom safe zone, synapse detail middle, destructive data reset in stretch zone. | `apps/web/src/app/HubScreen.tsx` |

## 16.3 Material System: Texture over Flatness

Target experience:
1. Surfaces should feel physical (parchment, soot, embers), not flat color blocks.
2. Center of tactical attention should be reinforced by material falloff and vignette.

Now vs Future:

| Module | Now | Future | File Anchors |
| --- | --- | --- | --- |
| Light Theme Material | Gradient + subtle global grain via `body::after`; parchment token palette in place. | Use uploaded `parchment.jpg` as base material for `--surface-app`/`--surface-board` via low-opacity `multiply` blend and optional torn-edge `mask-image` shell treatment. | `apps/web/src/index.css`, `apps/web/src/app/GameScreen.tsx` |
| Dark Theme Material | Dark token palette and existing atmospheric noise overlay. | Use darkened/high-contrast parchment variant for charred vellum feel plus strong radial vignette for tunnel-vision focus. | `apps/web/src/index.css` |
| Material Consistency | Mixed surfaces already tokenized but not all controls read as forged/leather artifacts. | Button/control material language pass (brass, leather, seal motifs) across all primary modules. | `apps/web/src/components/*`, `apps/web/src/index.css` |
| Texture Asset Pipeline | No dedicated named material asset contract in UI docs. | Standardize texture assets under a versioned UI-materials path (for example `apps/web/public/assets/ui/materials/`) with light/dark variants and fallback handling. | `apps/web/public/assets/ui/*`, `apps/web/src/index.css` |

## 16.4 Grim Pressure Filter (Threat-Proximal Atmospherics)

Target experience:
1. Nearby deadly threat should be felt, not only read.
2. Atmosphere should tighten as danger crosses tactical thresholds.

Now vs Future:

| Module | Now | Future | File Anchors |
| --- | --- | --- | --- |
| Threat-Coupled Global Filter | Synapse visual mode applies desaturation/edge-burn when toggled; not threat-tier driven. | Add automatic "grim" filter activation when a hostile unit at `z >= 2` is selected (and optionally when in nearby threat radius), with deterministic activation rules. | `apps/web/src/app/GameScreen.tsx`, `apps/web/src/components/synapse/SynapseBottomTray.tsx`, `apps/web/src/index.css` |
| Defeat Stakes Continuity | Defeat overlay exists with strong visual tone and quick restart/replay actions. | Reintroduce splash-warrior silhouette motif in defeat surface for narrative continuity. | `apps/web/src/app/AppOverlays.tsx` |
| Visual Echo Materialization | No dedicated parchment-masked ghost trail system yet. | Render ghost/echo movement traces as faint ink-like trails masked by parchment grain to preserve world cohesion. | `apps/web/src/components/GameBoard.tsx`, `apps/web/src/components/juice/*`, `apps/web/src/index.css` |

## 16.5 Implementation Priority (Atmospheric Tranche)

Priority order:
1. Parchment and soot texture material pass (`highest immediate value`).
2. Splash-to-Hub transition choreography.
3. Splash ignition loop + sensory trigger wiring (`haptic-outcome-impact`, `ui-danger-drum`).
4. Settings material controls (wax seal + brass slider components).
5. Grim pressure filter driven by tactical threat tier.
6. Splash silhouette persistence in defeat/victory storytelling surfaces.
7. Parchment-masked visual echo trails.

Acceptance criteria for tranche close:
1. Light and dark themes both show clear physical-material texture identity.
2. Boot sequence includes cinematic but short ignition transition into Hub.
3. Splash tap triggers both semantic sensory channels (audio + haptic) through a unified dispatcher.
4. Mobile settings preserve one-hand ergonomics while introducing artifact-style controls.
5. Threat-tier atmosphere response can be toggled and verified under deterministic replay.
6. Ghost/echo trails render with material-consistent parchment masking.

## 16.6 Advanced CSS Techniques (Material and Centering)

These techniques define how to move from flat screens to physically grounded presentation.

## 16.6.1 Splash Centering and Vignette Mask

Status:
1. Dedicated splash centering/mask module: `Future feature request`.

Reference pattern:

```css
.splash-container {
  display: grid;
  place-items: center;
  overflow: hidden;
}

.splash-image {
  width: 110vw;
  height: 110vh;
  object-fit: cover;
  object-position: center 20%;
  mask-image: radial-gradient(circle, black 50%, transparent 100%);
}
```

Implementation notes:
1. Use this in tandem with the boot zoom and ignition pulse rules from Section 16.1.
2. Keep fallback behavior for browsers with limited `mask-image` support.

## 16.6.2 Torn Parchment Edge Treatment

Status:
1. Organic torn-edge shell treatment: `Future feature request`.

Contract:
1. Prefer SVG-based mask assets for torn edges over standard `border-radius`.
2. Apply at game shell boundaries where map-on-table physicality is desired.
3. Keep tactical center readability by avoiding excessive mask intrusion into board-interaction zones.

## 16.7 Ergonomic and Atmospheric Rules Matrix

| Category | Technique | File Anchor | Status |
| --- | --- | --- | --- |
| Haptics | Semantic emit calls on commit/transition actions. | `apps/web/src/app/ui-telemetry.ts` (future sensory dispatcher) | Future |
| Zoning | Safe-zone-first dock ordering (for example `flex-row-reverse`) plus guarded destructive actions. | `apps/web/src/app/GameScreen.tsx` | Future |
| Guarded Actions | Long-press wax-seal confirmation for `Reset`/`Hub Exit` in stretch zone. | `apps/web/src/app/GameScreen.tsx`, `apps/web/src/index.css` | Future |
| Transitions | Snappy `140ms` tokenized transform cadence. | `apps/web/src/index.css` | Now |
| Centering | Overlay centering using grid/flex centering in tactical overlays and splash shell. | `apps/web/src/app/AppOverlays.tsx`, future splash module | Now (overlay), Future (splash) |
