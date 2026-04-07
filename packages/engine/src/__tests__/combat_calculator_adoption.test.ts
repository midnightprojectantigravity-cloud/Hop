import fs from 'fs';
import { describe, expect, it } from 'vitest';

const skillsDir = new URL('../skills/', import.meta.url);
const skillFiles = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.ts'))
    .map(entry => entry.name);

describe('combat-calculator adoption guard', () => {
    it('routes skill damage through the shared combat helper', () => {
        for (const file of skillFiles) {
            const fullPath = new URL(file, skillsDir);
            const source = fs.readFileSync(fullPath, 'utf8');

            expect(source).not.toContain('calculateCombat(');

            // Guard: combat-oriented skills should not hardcode Damage literal amounts in emitted effects.
            const hardcodedDamageAmount = /type:\s*'Damage'[\s\S]*?amount:\s*\d+/m;
            expect(hardcodedDamageAmount.test(source)).toBe(false);
        }
    });
});
