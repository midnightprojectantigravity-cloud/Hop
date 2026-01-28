# 🛠️ Hex Engine Technical Debt & Refactoring Roadmap

## Executive Summary: The "Split-Brain" State

The engine is currently in a transition period between a legacy `Position Array` system and a modern `Tile Map` system. This has created a "Split-Brain" state where the UI and the Engine Logic often disagree on the world state, leading to "ghost" collisions and missed environmental triggers.

## Core Infrastructure (Phase I: Foundation)

*Goal: Standardize how the engine "speaks" about the world to prevent coordinate drift.*

### 📍 Unified Coordinate Factory (P0)

* **Problem:** Manual string templates like ``${q},${r}`` allow for formatting inconsistencies (e.g., `"6,6"` vs `"6, 6"`).
* **Remediation:** Implement a `HexCoord` utility. This is the **single source of truth** for coordinate-to-key conversion.
* **Risk:** Map Mismatch (Engine logic vs. UI rendering).

### 🎲 Determinism & RNG Debt (P1)

* **Problem:** Using `Math.random()` prevents replay parity between the browser and the headless testing engine.
* **Remediation:** Implement a **Seeded PRNG**. Ensure all random events pull from a deterministic `state.seed`.
* **Why:** Required for the **Automated Testing Framework** to perform skill power assessments reliably.

### 💾 Serialization & Save-State Integrity (P2)

* **Problem:** Native JS Maps do not serialize to JSON, breaking save/load functionality.
* **Remediation:** Create `toSaveState()` and `fromSaveState()` transformers.
* **Impact:** Allows "Snapshot Debugging"—pasting a browser state into the headless engine for instant bug reproduction.

## Gameplay Systems (Phase II: Consolidation)

*Goal: Remove "Copy-Paste Engineering" and unify mechanic resolution.*

### 🏃 Movement Kernel & Post-Movement Hook (P1)

* **Problem:** Skills like `Vault`, `Dash`, and `Jump` share 80% logic similarity but implement their own collision and lava checks.
* **Remediation:** * Centralize logic into a `MovementKernel`.
* Create a `resolveEnvironment(actor)` hook that triggers automatically after any displacement (Walk, Grapple, Push).

* **Impact:** Fixes the "Lava Sink" bug globally.

### 🗺️ Spatial System Consolidation (P1)

* **Problem:** `targeting.ts` and `navigation.ts` contain duplicated hex-math.
* **Remediation:** Merge both into a single `SpatialSystem.ts` (the engine's "Internal GPS").

### 🏷️ Type-Safe Registry (P2)

* **Problem:** Hardcoded strings like `'lava'` lead to silent failures.
* **Remediation:** Replace all magic strings with a TypeScript `enum` or strict `const` object for Tile and Skill IDs.

## File System & Build Health (Phase III: Sanitation)

*Goal: Purge "Refactoring Ghosts" and restore tool integrity.*

### 👻 The "Ghost" Purge (P0)

* **Audit Finding:** Identical files exist in `src/` and `src/systems/` (e.g., `vitals.ts`, `rng.ts`).
* **Remediation:** * Force-delete root-level files that have been migrated to `systems/`.
* Delete `legacy-*.ts` files once their functionality is verified in the new Map system.
* Remove unused files found by Knip: `fuzzTest.ts` (if unused), `checkRngParity.ts`, `validateReplay.ts`.

### 🛡️ Build Artifact Leakage (P1)

* **Problem:** Audit tools are scanning `dist/` folders, creating false duplicates.
* **Remediation:** Update `.gitignore` and `.jscpd.json` to ignore `dist/`, `build/`, and `node_modules/`.

### 🚨 Linting Restoration (P1)

* **Audit Finding:** Unused ESLint plugins and globals suggest the linter is effectively disabled.
* **Remediation:** Re-initialize ESLint config to enforce `no-explicit-any`.

## Definition of Done (DoD)

A refactoring task is considered complete only when:

1. **Strict Typing:** No `any` types remain in the affected module.
2. **No Duplication:** 0% clones for the refactored logic.
3. **Parity:** The Headless Engine test passes AND the UI matches the state visually.
4. **No Artifacts:** `TODO` and `FIXME` comments for that task are converted to tracked issues or resolved.