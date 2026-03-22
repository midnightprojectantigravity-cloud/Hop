import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SKILLS_DIR = path.resolve(__dirname, '..', 'skills');

describe('combat skill metadata audit', () => {
    it('requires direct calculateCombat skill callsites to declare v2 attack metadata', () => {
        const files = readdirSync(SKILLS_DIR).filter(file => file.endsWith('.ts'));
        const missing: string[] = [];

        for (const file of files) {
            const content = readFileSync(path.join(SKILLS_DIR, file), 'utf8');
            const blocks = content.match(/calculateCombat\(\{[\s\S]*?\}\)/g) || [];
            blocks.forEach((block, index) => {
                if (!block.includes('attackProfile:') || !block.includes('trackingSignature:')) {
                    missing.push(`${file}#${index + 1}`);
                }
            });
        }

        expect(missing).toEqual([]);
    });
});
