import { readFileSync } from 'node:fs';
import { validateStateMirrorSnapshot, type StateMirrorSnapshot } from '../src/systems/state-mirror';

const [enginePath, uiPath] = process.argv.slice(2);

if (!enginePath || !uiPath) {
    console.error('Usage: npx tsx packages/engine/scripts/validateStateMirror.ts <engineSnapshot.json> <uiSnapshot.json>');
    process.exit(1);
}

const readSnapshot = (path: string): StateMirrorSnapshot => JSON.parse(readFileSync(path, 'utf8')) as StateMirrorSnapshot;

const engineSnapshot = readSnapshot(enginePath);
const uiSnapshot = readSnapshot(uiPath);
const result = validateStateMirrorSnapshot(engineSnapshot, uiSnapshot);

if (!result.ok) {
    console.error('State mirror validation failed.');
    result.mismatches.forEach(m => {
        console.error(`[${m.reason}] ${m.actorId} expected=${JSON.stringify(m.expected)} actual=${JSON.stringify(m.actual)}`);
    });
    process.exit(2);
}

console.log(`State mirror validation passed. actors=${engineSnapshot.actors.length} turn=${engineSnapshot.turn} stackTick=${engineSnapshot.stackTick}`);

