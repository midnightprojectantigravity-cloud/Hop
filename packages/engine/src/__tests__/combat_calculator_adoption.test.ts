import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const skillFiles = [
    'packages/engine/src/skills/basic_attack.ts',
    'packages/engine/src/skills/fireball.ts',
    'packages/engine/src/skills/corpse_explosion.ts'
];

describe('combat-calculator adoption guard', () => {
    it('routes migrated skill damage through calculateCombat', () => {
        for (const file of skillFiles) {
            const fullPath = path.resolve(process.cwd(), file);
            const source = fs.readFileSync(fullPath, 'utf8');

            expect(source).toContain('calculateCombat(');

            // Guard: migrated skills should not hardcode Damage literal amounts in emitted effects.
            const hardcodedDamageAmount = /type:\s*'Damage'[\s\S]*?amount:\s*\d+/m;
            expect(hardcodedDamageAmount.test(source)).toBe(false);
        }
    });
});

