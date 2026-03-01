import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const SKIP_DIR_NAMES = new Set([
    'node_modules',
    'dist',
    'build',
    'coverage',
    '__tests__',
    'scenarios',
]);
const DEPRECATED_TOKENS = ['ENEMY_STATS', 'FLOOR_ENEMY_BUDGET', 'FLOOR_ENEMY_TYPES'] as const;
const tokenPattern = new RegExp(`\\b(?:${DEPRECATED_TOKENS.join('|')})\\b`);

interface DeprecatedTokenIssue {
    filePath: string;
    lineNumber: number;
    token: string;
    lineText: string;
}

const scriptDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const engineRoot = resolve(scriptDir, '..');
const repoRoot = resolve(engineRoot, '..', '..');

const targetRoots = [
    resolve(engineRoot, 'src'),
    resolve(repoRoot, 'apps', 'web', 'src'),
].filter(rootPath => existsSync(rootPath));

const collectSourceFiles = (dirPath: string): string[] => {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIR_NAMES.has(entry.name)) continue;
            files.push(...collectSourceFiles(fullPath));
            continue;
        }
        if (!entry.isFile()) continue;
        if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
            files.push(fullPath);
        }
    }
    return files;
};

const findDeprecatedTokenIssues = (filePath: string): DeprecatedTokenIssue[] => {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/u);
    const issues: DeprecatedTokenIssue[] = [];

    for (let lineNumber = 1; lineNumber <= lines.length; lineNumber += 1) {
        const lineText = lines[lineNumber - 1];
        const match = tokenPattern.exec(lineText);
        tokenPattern.lastIndex = 0;
        if (!match) continue;

        issues.push({
            filePath,
            lineNumber,
            token: match[0],
            lineText: lineText.trim(),
        });
    }
    return issues;
};

const assertReadableRoot = (rootPath: string): void => {
    if (!existsSync(rootPath)) {
        throw new Error(`Missing source root: ${rootPath}`);
    }
    const stats = statSync(rootPath);
    if (!stats.isDirectory()) {
        throw new Error(`Expected directory source root, got file: ${rootPath}`);
    }
};

const toRepoRelativePath = (filePath: string): string =>
    relative(repoRoot, filePath).split(sep).join('/');

const main = (): void => {
    for (const rootPath of targetRoots) {
        assertReadableRoot(rootPath);
    }

    const sourceFiles = targetRoots.flatMap(collectSourceFiles);
    const issues = sourceFiles.flatMap(findDeprecatedTokenIssues);

    if (issues.length > 0) {
        console.error('[deprecated-constants] Runtime/source usage detected.');
        console.error('Use data/enemies catalog + spawn-profile modules instead of ENEMY_STATS/FLOOR_ENEMY_*.');
        for (const issue of issues) {
            console.error(
                `  - ${toRepoRelativePath(issue.filePath)}:${issue.lineNumber} token=${issue.token} :: ${issue.lineText}`
            );
        }
        process.exit(1);
    }

    console.log(
        `OK: checked ${sourceFiles.length} source files across ${targetRoots.length} roots for deprecated constants usage`
    );
};

main();
