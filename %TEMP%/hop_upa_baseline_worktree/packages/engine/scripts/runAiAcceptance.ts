import { spawnSync } from 'node:child_process';

const strict = process.argv.includes('--strict');
const vitestArgs = [
    'vitest',
    'run',
    'src/__tests__/enemy_ai_parity_corpus.test.ts',
    'src/__tests__/enemy_ai_shadow_fallback_rate.test.ts',
    'src/__tests__/enemy_ai_synthetic_edge_parity.test.ts',
    'src/__tests__/wild_strategy_intent_parity.test.ts',
    'src/__tests__/agency_swap.test.ts',
    'src/__tests__/scenarios_runner.test.ts',
    'src/__tests__/balance_harness.test.ts',
    'src/__tests__/pvp_harness.test.ts',
    'src/__tests__/golden-runs/golden_run.test.ts',
    'src/__tests__/harness_ai_convergence_regression.test.ts',
    'src/__tests__/ai_scoring_core.test.ts',
    'src/__tests__/ai_tiebreak_determinism.test.ts',
    'src/__tests__/player_selector_parity_sample.test.ts',
];

const commandLine = `npx ${vitestArgs.join(' ')}`;
const result = spawnSync(commandLine, {
    stdio: 'inherit',
    shell: true,
    env: {
        ...process.env,
        ...(strict ? { HOP_GOLDEN_STRICT: '1' } : {})
    }
});

if (result.error) {
    console.error(result.error);
    process.exit(1);
}

process.exit(result.status ?? 1);
