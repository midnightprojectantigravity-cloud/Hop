import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
    BalanceBudgetViolation,
    BalanceStackBaselineArtifact,
    BalanceStackGateReport,
    BalanceViolationAllowlistEntry
} from '../src/systems/evaluation/balance-schema';
import { classifyBalanceViolations, isAllowlistEntryExpired } from '../src/systems/evaluation/balance-budget-gates';

const loadJson = <T>(file: string): T =>
    JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8')) as T;

const normalizeViolationSignature = (violation: BalanceBudgetViolation): string =>
    [
        violation.category,
        violation.subjectId,
        violation.metric,
        String(violation.floor ?? ''),
        String(violation.role ?? '')
    ].join('|');

export const buildBalanceStackGateReport = (
    baseline: BalanceStackBaselineArtifact,
    candidate: BalanceStackBaselineArtifact,
    allowlist: BalanceViolationAllowlistEntry[],
    asOfDate: string = new Date().toISOString().slice(0, 10)
): BalanceStackGateReport => {
    const baselineErrorSignatures = new Set(
        baseline.budgetViolations
            .filter(violation => violation.severity === 'error')
            .map(normalizeViolationSignature)
    );
    const candidateClassification = classifyBalanceViolations(candidate.budgetViolations, allowlist, asOfDate);
    const candidateErrorViolations = candidate.budgetViolations.filter(violation => violation.severity === 'error');
    const newErrorViolations = candidateErrorViolations.filter(
        violation => !baselineErrorSignatures.has(normalizeViolationSignature(violation))
    );
    const unallowlistedErrorViolations = candidateClassification.unallowlistedViolations.filter(
        violation => violation.severity === 'error'
    );
    const expiredAllowlistEntries = allowlist.filter(entry => isAllowlistEntryExpired(entry, asOfDate));

    return {
        generatedAt: new Date().toISOString(),
        baseline: {
            generatedAt: baseline.generatedAt,
            params: baseline.params,
            errorViolations: baseline.budgetViolations.filter(violation => violation.severity === 'error').length,
            warningViolations: baseline.budgetViolations.filter(violation => violation.severity === 'warning').length
        },
        candidate: {
            generatedAt: candidate.generatedAt,
            params: candidate.params,
            errorViolations: candidateErrorViolations.length,
            warningViolations: candidate.budgetViolations.filter(violation => violation.severity === 'warning').length,
            allowlistedErrors: candidateClassification.allowlistedViolations.filter(violation => violation.severity === 'error').length,
            unallowlistedErrors: unallowlistedErrorViolations.length
        },
        allowlist: {
            entries: allowlist.length,
            expiredEntryIds: expiredAllowlistEntries.map(entry => entry.id).sort()
        },
        newErrorViolations,
        unallowlistedErrorViolations,
        expiredAllowlistEntries,
        passed: expiredAllowlistEntries.length === 0
            && unallowlistedErrorViolations.length === 0
            && newErrorViolations.length === 0
    };
};

export const writeBalanceStackGateReport = (file: string, report: BalanceStackGateReport): string => {
    const outPath = resolve(process.cwd(), file);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return outPath;
};

export const runBalanceStackGate = (
    baselineFile: string,
    candidateFile: string,
    allowlistFile: string,
    outFile: string,
    strict = true
): BalanceStackGateReport => {
    const report = buildBalanceStackGateReport(
        loadJson<BalanceStackBaselineArtifact>(baselineFile),
        loadJson<BalanceStackBaselineArtifact>(candidateFile),
        loadJson<BalanceViolationAllowlistEntry[]>(allowlistFile)
    );
    const outPath = writeBalanceStackGateReport(outFile, report);
    console.log(JSON.stringify({
        wrote: outPath,
        passed: report.passed,
        newErrors: report.newErrorViolations.length,
        unallowlistedErrors: report.unallowlistedErrorViolations.length,
        expiredAllowlistEntries: report.expiredAllowlistEntries.length
    }, null, 2));
    if (strict && !report.passed) {
        process.exitCode = 2;
    }
    return report;
};

const isDirectExecution = (): boolean => {
    const invokedPath = process.argv[1];
    if (!invokedPath) return false;
    return resolve(invokedPath) === resolve(fileURLToPath(import.meta.url));
};

if (isDirectExecution()) {
    const baselineFile = process.argv[2] || 'artifacts/balance/BALANCE_STACK_BASELINE.json';
    const candidateFile = process.argv[3] || 'artifacts/balance/BALANCE_STACK_CANDIDATE.json';
    const allowlistFile = process.argv[4] || 'artifacts/balance/BALANCE_STACK_ALLOWLIST.json';
    const outFile = process.argv[5] || 'artifacts/balance/BALANCE_STACK_GATE_REPORT.json';
    const strict = (process.argv[6] || '1') === '1';
    runBalanceStackGate(baselineFile, candidateFile, allowlistFile, outFile, strict);
}
