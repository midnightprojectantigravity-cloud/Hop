import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { migrateCombatTuningLedgerPayload } from '../src/data/fixed-point-migration';

const isDirectExecution = (): boolean => {
    const current = fileURLToPath(import.meta.url);
    const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
    return invoked === current;
};

const main = (): void => {
    const inputPath = process.argv[2];
    const outputPath = process.argv[3];
    if (!inputPath || !outputPath) {
        console.error('Usage: hopMigrateData <input.json> <output.json>');
        process.exit(1);
    }

    const payload = JSON.parse(readFileSync(inputPath, 'utf8'));
    const result = migrateCombatTuningLedgerPayload(payload);
    writeFileSync(outputPath, JSON.stringify(result.value, null, 2), 'utf8');

    const precisionLosses = result.warnings.filter(warning => warning.precisionLoss);
    console.log(JSON.stringify({
        wrote: outputPath,
        converted: result.warnings.length,
        precisionLosses: precisionLosses.length
    }, null, 2));

    if (precisionLosses.length > 0) {
        console.warn('Precision loss detected at:', precisionLosses.map(warning => `${warning.path}=${warning.original} -> ${warning.scaled}`).join(' | '));
    }
}

if (isDirectExecution()) {
    main();
}
