import { spawnSync } from 'node:child_process';

const runCommand = (commandLine: string, extraEnv?: Record<string, string>): void => {
    const result = spawnSync(commandLine, {
        stdio: 'inherit',
        shell: true,
        env: {
            ...process.env,
            ...extraEnv
        }
    });
    if (result.error) {
        console.error(result.error);
        process.exit(1);
    }
    if ((result.status ?? 1) !== 0) {
        process.exit(result.status ?? 1);
    }
};

const strict = process.argv.includes('--strict');
const env = strict ? { HOP_ACAE_ENABLED: '1' } : {};

runCommand('npx vitest run src/__tests__/acae_formula_application.test.ts src/__tests__/acae_annihilation_priority_dag.test.ts src/__tests__/acae_hardening_growth.test.ts src/__tests__/acae_tile_injection.test.ts src/__tests__/acae_effect_handler_integration.test.ts src/__tests__/acae_scenarios_runner.test.ts', env);
runCommand('npx tsx ./scripts/runAcaeLethalitySimulation.ts --check', env);
runCommand('npx tsx ./scripts/runAcaeHardeningAudit.ts --check', env);
runCommand('npx tsx ./scripts/runAcaeCleansePathAudit.ts --check', env);
runCommand('npx tsx ./scripts/runAcaeAnnihilationStability.ts --check', env);
