import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = existsSync(join(process.cwd(), 'src'))
    ? join(process.cwd(), 'src')
    : join(process.cwd(), 'packages', 'engine', 'src');

const ALLOWED_RUNTIME_BRIDGE_HELPER_CONSUMERS = new Set([
    join(ROOT, 'skillRegistry.ts').replace(/\\/g, '/'),
    join(ROOT, 'systems', 'skill-runtime', 'bridge.ts').replace(/\\/g, '/')
]);

const GUARDED_HELPERS = ['getRuntimeSkillDefinition', 'getRuntimeSkillDefinitionRegistry'];

const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stats = statSync(full);
        if (stats.isDirectory()) {
            if (entry === 'node_modules' || entry === 'dist') continue;
            out.push(...walk(full));
            continue;
        }
        if (!full.endsWith('.ts') && !full.endsWith('.tsx')) continue;
        out.push(full);
    }
    return out;
};

describe('skill runtime bridge boundary', () => {
    it('keeps runtime skill-registry helpers scoped to the shared registry boundary', () => {
        const offenders: string[] = [];

        for (const file of walk(ROOT)) {
            const normalized = file.replace(/\\/g, '/');
            if (normalized.includes('/__tests__/')) continue;

            const content = readFileSync(file, 'utf8');
            const referencesGuardedHelper = GUARDED_HELPERS.some(helper => content.includes(helper));
            if (!referencesGuardedHelper) continue;

            if (!ALLOWED_RUNTIME_BRIDGE_HELPER_CONSUMERS.has(normalized)) {
                offenders.push(normalized);
            }
        }

        expect(offenders).toEqual([]);
    });
});
