import type { LoadoutCatalog, LoadoutDefinition } from './contracts';

export interface LoadoutValidationIssue {
    path: string;
    message: string;
}

export class LoadoutValidationError extends Error {
    issues: LoadoutValidationIssue[];
    constructor(issues: LoadoutValidationIssue[]) {
        super(`Loadout validation failed:\n${issues.map(i => `${i.path}: ${i.message}`).join('\n')}`);
        this.name = 'LoadoutValidationError';
        this.issues = issues;
    }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const isStr = (v: unknown): v is string => typeof v === 'string';

const push = (issues: LoadoutValidationIssue[], path: string, message: string) =>
    issues.push({ path, message });

const checkStringArray = (
    value: unknown,
    issues: LoadoutValidationIssue[],
    path: string,
    opts: { unique?: boolean } = {}
) => {
    if (!Array.isArray(value)) {
        push(issues, path, 'Expected array');
        return;
    }
    const seen = new Set<string>();
    value.forEach((entry, idx) => {
        if (!isStr(entry) || entry.length === 0) {
            push(issues, `${path}[${idx}]`, 'Expected non-empty string');
            return;
        }
        if (opts.unique) {
            if (seen.has(entry)) push(issues, `${path}[${idx}]`, `Duplicate "${entry}"`);
            seen.add(entry);
        }
    });
};

export const validateLoadoutDefinition = (input: unknown, path = '$'): LoadoutValidationIssue[] => {
    const issues: LoadoutValidationIssue[] = [];
    if (!isRecord(input)) {
        push(issues, path, 'Expected object');
        return issues;
    }
    if (!isStr(input.id) || input.id.length === 0) push(issues, `${path}.id`, 'Expected non-empty string');
    if (!isStr(input.name) || input.name.length === 0) push(issues, `${path}.name`, 'Expected non-empty string');
    if (!isStr(input.description)) push(issues, `${path}.description`, 'Expected string');
    checkStringArray(input.startingUpgrades, issues, `${path}.startingUpgrades`, { unique: true });
    checkStringArray(input.startingSkills, issues, `${path}.startingSkills`, { unique: true });
    return issues;
};

export const validateLoadoutCatalog = (input: unknown): LoadoutValidationIssue[] => {
    const issues: LoadoutValidationIssue[] = [];
    if (!isRecord(input)) {
        push(issues, '$', 'Expected loadout catalog object');
        return issues;
    }

    for (const [key, value] of Object.entries(input)) {
        const entryIssues = validateLoadoutDefinition(value, `$.${key}`);
        issues.push(...entryIssues);
        if (isRecord(value) && isStr(value.id) && value.id !== key) {
            push(issues, `$.${key}.id`, `Must match catalog key "${key}"`);
        }
    }

    return issues;
};

export const parseLoadoutCatalog = (input: unknown): LoadoutCatalog => {
    const issues = validateLoadoutCatalog(input);
    if (issues.length > 0) throw new LoadoutValidationError(issues);
    return input as LoadoutCatalog;
};

export const cloneLoadoutCatalog = (catalog: LoadoutCatalog): LoadoutCatalog =>
    Object.fromEntries(
        Object.entries(catalog).map(([key, value]) => [
            key,
            {
                ...value,
                startingUpgrades: [...value.startingUpgrades],
                startingSkills: [...value.startingSkills],
            } satisfies LoadoutDefinition
        ])
    );

