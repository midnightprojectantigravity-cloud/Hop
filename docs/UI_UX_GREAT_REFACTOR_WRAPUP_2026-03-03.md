# UI/UX Great Refactor Wrap-Up (March 3, 2026)

## Scope Closed
Mobile-first UI/UX productization pass completed across web app shells and flows in this order:
1. Hub experience
2. In-run combat HUD
3. Replay/defeat loop

## Productization Outcomes
1. Theme/token system:
   - default medieval parchment light theme
   - secondary medieval-apocalypse dark theme
   - CSS variable runtime theming via `:root[data-theme=...]`
2. UI preferences and persistence:
   - `UiPreferencesV1` added (`colorMode`, `motionMode`, `hudDensity`, `mobileLayout`)
   - storage keys:
     - `hop_ui_prefs_v1`
     - `hop_ui_theme_v1`
3. Run resume + quick restart context:
   - `RunResumeContext` added (`lastLoadoutId`, `lastRunMode`, `lastDailyDate?`)
   - storage key:
     - `hop_last_run_context_v1`
   - defeat overlay actions now include:
     - `Quick Restart`
     - `View Replay`
   - quick restart supports both:
     - normal mode (new seed)
     - daily mode (deterministic daily date/seed behavior)
4. Mobile-first shell and ergonomics:
   - portrait-first structure: top status strip, center board, bottom action zone
   - one-handed controls concentrated in bottom dock
   - touch targets standardized to mobile-safe sizing on primary actions
5. Desktop command center posture:
   - left/center/right tactical structure retained
   - no collapsible-only critical panes
6. Synapse integration:
   - mobile bottom tray shares the same interaction footprint as skills tray
   - synapse vision styling applied without reducing center board readability
7. Replay/defeat flow hardening:
   - replay controls avoid mobile bottom thumb zone conflicts
   - replay v3-only behavior remains preserved
8. UX telemetry hooks:
   - `hub_select_to_start_ms`
   - `defeat_to_restart_ms`
   - `first_action_ms`
9. Loading/perf shell optimization:
   - route-level lazy loading centralized
   - idle-time prefetch for likely next screens
   - manual chunking configured for smaller runtime bundles

## Validation Snapshot
1. `npx vitest run apps/web/src/__tests__ --silent` -> pass (`33 files / 75 tests`)
2. `npx tsc -p apps/web/tsconfig.app.json --noEmit` -> pass
3. `npm --prefix apps/web run build` -> pass
4. Bundle split result:
   - prior monolithic app chunk removed
   - largest runtime chunks now around `~180-185KB` (`vendor-react-dom`, `engine-systems`)

## Guardrails Kept
1. No gameplay logic semantics changed in engine runtime paths.
2. Replay validation remains strict v3.
3. Deterministic behavior constraints remain unchanged.

## Follow-Up (Deferred)
1. Full manual QA matrix pass across target widths/orientations and physical devices.
2. Replay-guided mandatory tutorial flow remains a separate future tranche.
