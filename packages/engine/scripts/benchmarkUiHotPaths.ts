#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { gameReducer, generateInitialState } from '../src/logic';
import { previewActionOutcome } from '../src/systems/action-preview';
import { DEFAULT_LOADOUTS } from '../src/systems/loadout';
import { SkillRegistry } from '../src/skillRegistry';

type BenchResult = {
  iterations: number;
  avgMs: number;
  opsPerSecond: number;
};

type UiHotPathBenchmarkReport = {
  generatedAt: string;
  benches: Record<string, BenchResult>;
};

const round = (value: number): number => Number(value.toFixed(4));

const ensureDir = (filePath: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const measure = (iterations: number, fn: () => void): BenchResult => {
  for (let i = 0; i < 4; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const elapsedMs = performance.now() - start;
  const avgMs = elapsedMs / Math.max(1, iterations);
  return {
    iterations,
    avgMs: round(avgMs),
    opsPerSecond: round(1000 / Math.max(0.0001, avgMs)),
  };
};

const buildMoveState = () => generateInitialState(1, 'perf-ui-hotpaths-move', 'perf-ui-hotpaths-move');

const buildPreviewState = () => generateInitialState(
  1,
  'perf-ui-hotpaths-preview',
  'perf-ui-hotpaths-preview',
  undefined,
  DEFAULT_LOADOUTS.FIREMAGE,
);

const resolveFirstTarget = (state: ReturnType<typeof generateInitialState>, skillId: string) => {
  const def = SkillRegistry.get(skillId);
  const targets = def?.getValidTargets ? def.getValidTargets(state, state.player.position) : [];
  if (targets.length === 0) {
    throw new Error(`No valid targets available for ${skillId}`);
  }
  return targets[0]!;
};

const run = (): UiHotPathBenchmarkReport => {
  const moveState = buildMoveState();
  const moveTarget = resolveFirstTarget(moveState, 'BASIC_MOVE');

  const previewState = buildPreviewState();
  const previewTarget = resolveFirstTarget(previewState, 'FIREBALL');

  return {
    generatedAt: new Date().toISOString(),
    benches: {
      get_valid_targets: measure(400, () => {
        const def = SkillRegistry.get('BASIC_MOVE');
        def?.getValidTargets?.(moveState, moveState.player.position);
      }),
      action_preview: measure(220, () => {
        previewActionOutcome(previewState, {
          actorId: previewState.player.id,
          skillId: 'FIREBALL',
          target: previewTarget,
        });
      }),
      reducer_turn_execution: measure(80, () => {
        let state = moveState;
        state = gameReducer(state, { type: 'MOVE', payload: moveTarget });
        state = gameReducer(state, { type: 'WAIT' });
      }),
    },
  };
};

const outputPath = process.argv[2];
const report = run();

if (outputPath) {
  ensureDir(outputPath);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Wrote UI hot path benchmark report: ${path.resolve(outputPath)}`);
} else {
  console.log(JSON.stringify(report, null, 2));
}
