import fs from 'fs';
import path from 'path';
import { gameReducer } from '../game/logic';
import { injectScenario, resolveScenarioAction } from '../game/scenarios';
import { hexEquals } from '../game/hex';

import { fileURLToPath } from 'url';

async function runTests() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const scenariosDir = path.join(__dirname, '../scenarios');
    const files = fs.readdirSync(scenariosDir).filter(f => f.endsWith('.json'));

    let passed = 0;
    let failed = 0;

    console.log(`Running ${files.length} scenarios...\n`);

    for (const file of files) {
        const filePath = path.join(scenariosDir, file);
        const scenario = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        console.log(`Scenario: ${scenario.metadata.title} (${file})`);

        try {
            // 1. Initialize
            let state = injectScenario(scenario);

            // 2. Dispatch Action
            const action = resolveScenarioAction(scenario.assertions.onAction);
            state = gameReducer(state, action);

            // 3. Assertions
            const { expect } = scenario.assertions;
            const errors: string[] = [];

            // Check Enemies
            if (expect.enemies) {
                const remainingIds = state.enemies.map(e => e.id);
                for (const id of expect.enemies) {
                    if (!remainingIds.includes(id)) {
                        errors.push(`Expected enemy ${id} to be alive, but it's gone.`);
                    }
                }
                if (remainingIds.length !== expect.enemies.length) {
                    errors.push(`Expected ${expect.enemies.length} enemies, found ${remainingIds.length}.`);
                }
            } else if (expect.enemies === undefined && scenario.assertions.expect.enemies === undefined) {
                // If expect.enemies is intentionally empty list
                if (Array.isArray(scenario.assertions.expect.enemies) && state.enemies.length > 0) {
                    errors.push(`Expected 0 enemies, found ${state.enemies.length}.`);
                }
            }

            // Special check for empty array in expect
            if (Array.isArray(expect.enemies) && expect.enemies.length === 0 && state.enemies.length > 0) {
                errors.push(`Expected 0 enemies, found ${state.enemies.length}.`);
            }

            // Check Player Position
            if (expect.playerPos && !hexEquals(state.player.position, expect.playerPos)) {
                errors.push(`Player position mismatch. Expected (${expect.playerPos.q},${expect.playerPos.r}), got (${state.player.position.q},${state.player.position.r})`);
            }

            // Check Messages
            if (expect.messages) {
                for (const msg of expect.messages) {
                    if (!state.message.some(m => m.includes(msg))) {
                        errors.push(`Expected message [${msg}] not found in log.`);
                    }
                }
            }

            if (errors.length === 0) {
                console.log('  ✅ PASSED');
                passed++;
            } else {
                console.error('  ❌ FAILED');
                errors.forEach(err => console.error(`     - ${err}`));
                console.log('  Actual Log:', state.message);
                failed++;
            }
        } catch (e: any) {
            console.error(`  ❌ CRASHED: ${e.message}`);
            failed++;
        }
        console.log('');
    }

    console.log(`Summary: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
