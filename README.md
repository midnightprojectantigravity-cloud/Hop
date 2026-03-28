# Hop Monorepo

Deterministic tactical roguelike split across a headless engine, a React web client, and a validation server.

## Workspace Layout

- `packages/engine`: deterministic referee/runtime
- `apps/web`: rendering, input UX, and orchestration
- `apps/server`: replay validation and leaderboard service

## Quick Start

```powershell
npm install
npm run dev
```

## Core Commands

```powershell
npm run build
npm test
npm run validator
```

## Current Runtime Reference

Start with [docs/STATUS.md](./docs/STATUS.md). It is the canonical current-law snapshot for:

- live runtime behavior
- AI architecture status
- validation commands
- current risk posture

Additional architecture references:

- [Master Tech Stack](./docs/MASTER_TECH_STACK.md)
- [Gold Standard Manifesto](./docs/GOLD_STANDARD_MANIFESTO.md)
- [Next Level Tracker](./docs/NEXT_LEVEL.md)
- [Turn Stack Contract](./docs/TURN_STACK_CONTRACT.md)

## Practical Validation

```powershell
npm run build
npm --workspace @hop/engine run test:full
npm --workspace @hop/web run test:run
npm run engine:fast
npm run upa:quick:ai
```
