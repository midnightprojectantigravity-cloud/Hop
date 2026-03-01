import fs from 'fs';
import { describe, expect, it } from 'vitest';

const skillFiles = [
    'basic_attack.ts',
    'fireball.ts',
    'corpse_explosion.ts'
];

const skillsDir = new URL('../skills/', import.meta.url);

describe('combat-calculator adoption guard', () => {
    it('routes migrated skill damage through calculateCombat', () => {
        for (const file of skillFiles) {
            const fullPath = new URL(file, skillsDir);
            const source = fs.readFileSync(fullPath, 'utf8');

            expect(source).toContain('calculateCombat(');

            // Guard: migrated skills should not hardcode Damage literal amounts in emitted effects.
            const hardcodedDamageAmount = /type:\s*'Damage'[\s\S]*?amount:\s*\d+/m;
            expect(hardcodedDamageAmount.test(source)).toBe(false);
        }
    });
});
