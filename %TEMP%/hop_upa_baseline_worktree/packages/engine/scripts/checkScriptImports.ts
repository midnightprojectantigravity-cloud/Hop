import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const SCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const RESOLUTION_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];

interface MissingImportIssue {
    filePath: string;
    specifier: string;
}

const scriptRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));

const collectScriptFiles = (dirPath: string): string[] => {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectScriptFiles(fullPath));
            continue;
        }
        if (!entry.isFile()) continue;
        if (SCRIPT_EXTENSIONS.has(extname(entry.name))) {
            files.push(fullPath);
        }
    }
    return files;
};

const getScriptKind = (filePath: string): ts.ScriptKind => {
    switch (extname(filePath)) {
    case '.ts':
        return ts.ScriptKind.TS;
    case '.tsx':
        return ts.ScriptKind.TSX;
    case '.js':
        return ts.ScriptKind.JS;
    case '.mjs':
        return ts.ScriptKind.JS;
    case '.cjs':
        return ts.ScriptKind.JS;
    default:
        return ts.ScriptKind.Unknown;
    }
};

const parseRelativeSpecifiers = (filePath: string): string[] => {
    const content = readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        getScriptKind(filePath),
    );

    const specifiers: string[] = [];
    const addSpecifier = (value: string | undefined): void => {
        if (!value) return;
        if (!value.startsWith('.')) return;
        specifiers.push(value);
    };

    const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node)) {
            const moduleSpecifier = node.moduleSpecifier;
            if (moduleSpecifier && ts.isStringLiteralLike(moduleSpecifier)) {
                addSpecifier(moduleSpecifier.text);
            }
        } else if (ts.isExportDeclaration(node)) {
            const moduleSpecifier = node.moduleSpecifier;
            if (moduleSpecifier && ts.isStringLiteralLike(moduleSpecifier)) {
                addSpecifier(moduleSpecifier.text);
            }
        } else if (ts.isCallExpression(node)) {
            const [firstArg] = node.arguments;
            if (!firstArg || !ts.isStringLiteralLike(firstArg)) {
                ts.forEachChild(node, visit);
                return;
            }

            if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
                addSpecifier(firstArg.text);
            } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
                addSpecifier(firstArg.text);
            }
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return specifiers;
};

const pathExists = (pathValue: string): boolean => {
    try {
        statSync(pathValue);
        return true;
    } catch {
        return false;
    }
};

const resolveSpecifierExists = (fromFile: string, specifier: string): boolean => {
    const basePath = resolve(dirname(fromFile), specifier);
    if (pathExists(basePath)) return true;

    for (const ext of RESOLUTION_EXTENSIONS) {
        if (pathExists(`${basePath}${ext}`)) return true;
    }
    for (const ext of RESOLUTION_EXTENSIONS) {
        if (pathExists(join(basePath, `index${ext}`))) return true;
    }
    return false;
};

const main = (): void => {
    const scriptFiles = collectScriptFiles(scriptRoot);
    const missing: MissingImportIssue[] = [];

    for (const filePath of scriptFiles) {
        const specifiers = parseRelativeSpecifiers(filePath);
        for (const specifier of specifiers) {
            if (!resolveSpecifierExists(filePath, specifier)) {
                missing.push({ filePath, specifier });
            }
        }
    }

    if (missing.length > 0) {
        for (const issue of missing) {
            const relativeFilePath = issue.filePath.replace(`${scriptRoot}\\`, '').replace(`${scriptRoot}/`, '');
            console.error(`[missing-import] ${relativeFilePath}: ${issue.specifier}`);
        }
        process.exit(1);
    }

    console.log(`OK: verified ${scriptFiles.length} script files under packages/engine/scripts`);
};

main();
