import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = existsSync(join(process.cwd(), 'docs'))
    ? process.cwd()
    : join(process.cwd(), '..', '..');

const CURRENT_LAW_DOCS = [
    'docs/STATUS.md',
    'docs/GOLD_STANDARD_MANIFESTO.md',
    'docs/MASTER_TECH_STACK.md',
    'docs/UPA_GUIDE.md'
];

describe('docs topology consistency', () => {
    it('does not advertise NEXT_LEVEL.md as an active tracker in current-law docs', () => {
        const offenders = CURRENT_LAW_DOCS.filter(docPath => {
            const fullPath = join(REPO_ROOT, docPath);
            const content = readFileSync(fullPath, 'utf8');
            return /Active tracker:\s*`docs\/NEXT_LEVEL\.md`/.test(content);
        });

        expect(offenders).toEqual([]);
    });
});
