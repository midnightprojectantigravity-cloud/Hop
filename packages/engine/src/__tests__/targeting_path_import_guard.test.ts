import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = existsSync(join(process.cwd(), 'src'))
    ? join(process.cwd(), 'src')
    : join(process.cwd(), 'packages', 'engine', 'src');
const BANNED_IMPORT_PATTERNS = [
    /from\s+['"][^'"]*skills\/targeting['"]/,
    /from\s+['"][^'"]*systems\/movement\/movement['"]/,
    /from\s+['"][^'"]*systems\/theme['"]/
];

const RETIRED_MODULES = [
    join(ROOT, 'skills', 'targeting.ts'),
    join(ROOT, 'systems', 'movement', 'movement.ts'),
    join(ROOT, 'systems', 'theme.ts')
];

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

describe('targeting/path import guard', () => {
    it('prevents runtime imports of deprecated targeting/path modules', () => {
        const offenders: string[] = [];
        for (const file of walk(ROOT)) {
            const normalized = file.replace(/\\/g, '/');
            if (normalized.includes('/__tests__/')) continue;
            const content = readFileSync(file, 'utf8');
            if (BANNED_IMPORT_PATTERNS.some(pattern => pattern.test(content))) {
                offenders.push(normalized);
            }
        }

        expect(offenders).toEqual([]);
    });

    it('keeps retired targeting/path modules deleted', () => {
        const survivors = RETIRED_MODULES.filter(existsSync).map(file => file.replace(/\\/g, '/'));
        expect(survivors).toEqual([]);
    });
});
