import { SCALED_IDENTITY } from '../constants';

export interface FixedPointIssue {
    path: string;
    message: string;
}

export const isCanonicalFixedPointInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value);

export const toFixedPoint = (value: number): number =>
    Math.round(Number(value || 0) * SCALED_IDENTITY);

export const fromFixedPoint = (value: number): number =>
    Number(value || 0) / SCALED_IDENTITY;

export const formatFixedPoint = (value: number, digits = 4): string =>
    fromFixedPoint(value).toFixed(digits);

export const assertFixedPointInteger = (
    value: unknown,
    issues: FixedPointIssue[],
    path: string,
    label = 'scaled integer'
): void => {
    if (!isCanonicalFixedPointInteger(value)) {
        issues.push({ path, message: `Expected ${label}` });
    }
};

export const assertFixedPointRange = (
    value: unknown,
    issues: FixedPointIssue[],
    path: string,
    label = 'scaled integer'
): void => {
    if (!isCanonicalFixedPointInteger(value)) {
        issues.push({ path, message: `Expected ${label}` });
        return;
    }
    if (!Number.isSafeInteger(value)) {
        issues.push({ path, message: 'Expected safe integer' });
    }
};
