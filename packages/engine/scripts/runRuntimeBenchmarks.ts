#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { gameReducer, generateInitialState } from '../src/logic';
import { tickTileEffects } from '../src/systems/tiles/tile-tick';
import { applyEffects } from '../src/systems/effect-engine';
import type { AtomicEffect } from '../src/types';

type BenchResult = {
  iterations: number;
  totalMs: number;
  avgMs: number;
  opsPerSecond: number;
};

type BenchmarkReport = {
  generatedAt: string;
  benches: Record<string, BenchResult>;
};

const ensureDir = (filePath: string) => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
};

const round = (value: number): number => Number(value.toFixed(4));

const measure = (iterations: number, fn: () => void): BenchResult => {
  const sampleCount = 5;
  const sampleAverages: number[] = [];
  let totalMs = 0;

  for (let i = 0; i < 3; i++) fn();
  for (let sample = 0; sample < sampleCount; sample++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn();
    const end = performance.now();
    const sampleTotalMs = end - start;
    totalMs += sampleTotalMs;
    sampleAverages.push(sampleTotalMs / iterations);
  }

  const sorted = [...sampleAverages].sort((a, b) => a - b);
  const avgMs = sorted[Math.floor(sorted.length / 2)];
  return {
    iterations: iterations * sampleCount,
    totalMs: round(totalMs),
    avgMs: round(avgMs),
    opsPerSecond: round(1000 / avgMs)
  };
};

const buildDamageBatch = (): AtomicEffect[] => {
  const effects: AtomicEffect[] = [];
  for (let i = 0; i < 40; i++) {
    effects.push({ type: 'Damage', target: 'player', amount: 1, reason: 'bench' });
    effects.push({ type: 'Heal', target: 'player', amount: 1 });
  }
  return effects;
};

const runBenchmarks = (): BenchmarkReport => {
  const benches: Record<string, BenchResult> = {};

  benches.reducer_turn_loop = measure(12, () => {
    let state = generateInitialState(1, 'bench-reducer-seed');
    for (let i = 0; i < 36; i++) {
      state = gameReducer(state, { type: 'WAIT' });
    }
  });

  benches.tile_tick = measure(40, () => {
    let state = generateInitialState(1, 'bench-tile-seed');
    for (let i = 0; i < 12; i++) {
      const result = tickTileEffects(state);
      state = result.state;
    }
  });

  const damageBatch = buildDamageBatch();
  benches.apply_effects_batch = measure(24, () => {
    let state = generateInitialState(1, 'bench-effects-seed');
    for (let i = 0; i < 20; i++) {
      state = applyEffects(state, damageBatch, { sourceId: 'player' });
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    benches
  };
};

const compareReports = (
  baseline: BenchmarkReport,
  candidate: BenchmarkReport,
  maxRegressionPct: number
): { pass: boolean; regressions: Array<{ bench: string; regressionPct: number }> } => {
  const regressions: Array<{ bench: string; regressionPct: number }> = [];

  for (const [bench, current] of Object.entries(candidate.benches)) {
    const prev = baseline.benches[bench];
    if (!prev || prev.avgMs <= 0) continue;
    const regressionPct = ((current.avgMs - prev.avgMs) / prev.avgMs) * 100;
    if (regressionPct > maxRegressionPct) {
      regressions.push({ bench, regressionPct: round(regressionPct) });
    }
  }

  return {
    pass: regressions.length === 0,
    regressions
  };
};

const outputPath = process.argv[2] || 'artifacts/bench/runtime.baseline.json';
const baselinePath = process.argv[3];
const maxRegressionPct = Number(process.argv[4] || '5');

const report = runBenchmarks();
ensureDir(outputPath);
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
console.log(`Wrote benchmark report: ${path.resolve(outputPath)}`);

if (baselinePath) {
  const baselineRaw = fs.readFileSync(path.resolve(baselinePath), 'utf8');
  const baseline = JSON.parse(baselineRaw) as BenchmarkReport;
  const comparison = compareReports(baseline, report, maxRegressionPct);
  if (!comparison.pass) {
    console.error('Benchmark regression gate failed:', comparison.regressions);
    process.exit(2);
  }
  console.log(`Benchmark regression gate passed (max ${maxRegressionPct}% regression).`);
}
