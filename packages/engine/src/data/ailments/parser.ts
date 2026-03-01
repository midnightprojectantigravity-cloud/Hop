import type { AilmentCatalog, AilmentDefinition, AilmentFormulaExpression } from './contracts';
import type { AilmentID } from '../../types/registry';

export interface AilmentValidationIssue {
    path: string;
    message: string;
}

export class AilmentValidationError extends Error {
    readonly issues: AilmentValidationIssue[];
    constructor(issues: AilmentValidationIssue[]) {
        super(`Ailment catalog validation failed:\n${issues.map(i => `${i.path}: ${i.message}`).join('\n')}`);
        this.name = 'AilmentValidationError';
        this.issues = issues;
    }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isAilmentId = (v: unknown): v is AilmentID => ['burn', 'wet', 'poison', 'frozen', 'bleed'].includes(String(v));

const validateFormula = (value: unknown, path: string, issues: AilmentValidationIssue[]): void => {
    if (!isRecord(value)) {
        issues.push({ path, message: 'Expected formula object' });
        return;
    }
    if (!isNum(value.base)) issues.push({ path: `${path}.base`, message: 'Expected number' });
    if (value.terms !== undefined) {
        if (!Array.isArray(value.terms)) {
            issues.push({ path: `${path}.terms`, message: 'Expected array' });
        } else {
            value.terms.forEach((term, idx) => {
                if (!isRecord(term)) {
                    issues.push({ path: `${path}.terms[${idx}]`, message: 'Expected object' });
                    return;
                }
                if (!isStr(term.variable)) issues.push({ path: `${path}.terms[${idx}].variable`, message: 'Expected variable' });
                if (!isNum(term.coefficient)) issues.push({ path: `${path}.terms[${idx}].coefficient`, message: 'Expected number' });
            });
        }
    }
    if (value.min !== undefined && !isNum(value.min)) issues.push({ path: `${path}.min`, message: 'Expected number' });
    if (value.max !== undefined && !isNum(value.max)) issues.push({ path: `${path}.max`, message: 'Expected number' });
    if (isNum(value.min) && isNum(value.max) && value.min > value.max) {
        issues.push({ path, message: 'min must be <= max' });
    }
    if (
        value.round !== undefined
        && !['none', 'floor', 'round', 'ceil'].includes(String(value.round))
    ) {
        issues.push({ path: `${path}.round`, message: 'Expected none|floor|round|ceil' });
    }
};

const validateDefinition = (value: unknown, index: number, issues: AilmentValidationIssue[]): void => {
    const path = `$.ailments[${index}]`;
    if (!isRecord(value)) {
        issues.push({ path, message: 'Expected object' });
        return;
    }
    if (!isAilmentId(value.id)) issues.push({ path: `${path}.id`, message: 'Unknown ailment id' });
    if (!isStr(value.name) || value.name.length === 0) issues.push({ path: `${path}.name`, message: 'Expected non-empty name' });
    if (!isRecord(value.core)) {
        issues.push({ path: `${path}.core`, message: 'Expected object' });
    } else {
        if (!isStr(value.core.atk)) issues.push({ path: `${path}.core.atk`, message: 'Expected stat ref' });
        if (!isStr(value.core.def)) issues.push({ path: `${path}.core.def`, message: 'Expected stat ref' });
        if (!isNum(value.core.scalingFactor) || value.core.scalingFactor <= 0) issues.push({ path: `${path}.core.scalingFactor`, message: 'Expected > 0' });
        if (!isNum(value.core.baseDeposit) || value.core.baseDeposit < 0) issues.push({ path: `${path}.core.baseDeposit`, message: 'Expected >= 0' });
        if (value.core.skillMultiplierBase !== undefined && !isNum(value.core.skillMultiplierBase)) {
            issues.push({ path: `${path}.core.skillMultiplierBase`, message: 'Expected number' });
        }
    }
    if (value.interactions !== undefined) {
        if (!Array.isArray(value.interactions)) {
            issues.push({ path: `${path}.interactions`, message: 'Expected array' });
        } else {
            value.interactions.forEach((it, idx) => {
                if (!isRecord(it)) {
                    issues.push({ path: `${path}.interactions[${idx}]`, message: 'Expected object' });
                    return;
                }
                if (!isAilmentId(it.target)) issues.push({ path: `${path}.interactions[${idx}].target`, message: 'Unknown ailment target' });
                if (!isNum(it.ratio) || it.ratio <= 0) issues.push({ path: `${path}.interactions[${idx}].ratio`, message: 'Expected ratio > 0' });
                if (!isNum(it.priority)) issues.push({ path: `${path}.interactions[${idx}].priority`, message: 'Expected number priority' });
            });
        }
    }
    if (value.tick !== undefined) {
        if (!isRecord(value.tick)) {
            issues.push({ path: `${path}.tick`, message: 'Expected object' });
        } else {
            if (value.tick.damage !== undefined) validateFormula(value.tick.damage, `${path}.tick.damage`, issues);
            if (value.tick.decay !== undefined) validateFormula(value.tick.decay, `${path}.tick.decay`, issues);
        }
    }
    if (value.thresholds !== undefined) {
        if (!Array.isArray(value.thresholds)) {
            issues.push({ path: `${path}.thresholds`, message: 'Expected array' });
        } else {
            value.thresholds.forEach((th, idx) => {
                if (!isRecord(th)) {
                    issues.push({ path: `${path}.thresholds[${idx}]`, message: 'Expected object' });
                    return;
                }
                if (!isNum(th.count) || th.count <= 0) issues.push({ path: `${path}.thresholds[${idx}].count`, message: 'Expected count > 0' });
                if (!isStr(th.effectId) || th.effectId.length === 0) issues.push({ path: `${path}.thresholds[${idx}].effectId`, message: 'Expected non-empty effectId' });
                if (th.bonusDamage !== undefined && (!isNum(th.bonusDamage) || th.bonusDamage < 0)) {
                    issues.push({ path: `${path}.thresholds[${idx}].bonusDamage`, message: 'Expected bonusDamage >= 0' });
                }
            });
        }
    }
    if (!isRecord(value.hardening)) {
        issues.push({ path: `${path}.hardening`, message: 'Expected hardening config' });
    } else {
        if (!isNum(value.hardening.tickXpRate) || value.hardening.tickXpRate < 0) issues.push({ path: `${path}.hardening.tickXpRate`, message: 'Expected >= 0' });
        if (!isNum(value.hardening.shockXpRate) || value.hardening.shockXpRate < 0) issues.push({ path: `${path}.hardening.shockXpRate`, message: 'Expected >= 0' });
        if (!isNum(value.hardening.capPct) || value.hardening.capPct < 0 || value.hardening.capPct > 100) issues.push({ path: `${path}.hardening.capPct`, message: 'Expected 0..100' });
        if (!isNum(value.hardening.xpToResistance) || value.hardening.xpToResistance <= 0) issues.push({ path: `${path}.hardening.xpToResistance`, message: 'Expected > 0' });
    }
};

const validateNoCycles = (definitions: AilmentDefinition[], issues: AilmentValidationIssue[]): void => {
    const edges = new Map<AilmentID, AilmentID[]>();
    definitions.forEach(def => {
        edges.set(def.id, (def.interactions || []).map(it => it.target));
    });
    const visited = new Set<AilmentID>();
    const stack = new Set<AilmentID>();

    const walk = (node: AilmentID, chain: AilmentID[]): void => {
        if (stack.has(node)) {
            issues.push({
                path: '$.ailments',
                message: `Annihilation DAG contains cycle: ${[...chain, node].join(' -> ')}`
            });
            return;
        }
        if (visited.has(node)) return;
        visited.add(node);
        stack.add(node);
        const next = edges.get(node) || [];
        next.forEach(target => walk(target, [...chain, node]));
        stack.delete(node);
    };

    definitions.forEach(def => walk(def.id, []));
};

export const validateAilmentCatalog = (input: unknown): AilmentValidationIssue[] => {
    const issues: AilmentValidationIssue[] = [];
    if (!isRecord(input)) {
        return [{ path: '$', message: 'Expected object' }];
    }
    if (!isStr(input.version) || !/^1\./.test(input.version)) {
        issues.push({ path: '$.version', message: 'Expected v1.x version' });
    }
    if (!Array.isArray(input.ailments) || input.ailments.length === 0) {
        issues.push({ path: '$.ailments', message: 'Expected non-empty ailments array' });
        return issues;
    }
    input.ailments.forEach((def, idx) => validateDefinition(def, idx, issues));
    if (issues.length > 0) return issues;

    const definitions = input.ailments as AilmentDefinition[];
    const idSet = new Set<string>();
    definitions.forEach((def, idx) => {
        if (idSet.has(def.id)) {
            issues.push({ path: `$.ailments[${idx}].id`, message: `Duplicate id "${def.id}"` });
        }
        idSet.add(def.id);
        (def.interactions || []).forEach((it, j) => {
            if (!idSet.has(it.target) && !definitions.some(d => d.id === it.target)) {
                issues.push({ path: `$.ailments[${idx}].interactions[${j}].target`, message: `Unknown target "${it.target}"` });
            }
        });
    });
    if (issues.length > 0) return issues;

    validateNoCycles(definitions, issues);
    return issues;
};

export const parseAilmentCatalog = (input: unknown): AilmentCatalog => {
    const issues = validateAilmentCatalog(input);
    if (issues.length > 0) throw new AilmentValidationError(issues);
    return input as AilmentCatalog;
};

export interface CompiledAilmentCatalog {
    version: string;
    byId: Record<AilmentID, AilmentDefinition>;
}

export const compileAilmentCatalog = (catalog: AilmentCatalog): CompiledAilmentCatalog => {
    const byId = {} as Record<AilmentID, AilmentDefinition>;
    for (const def of catalog.ailments) {
        byId[def.id] = {
            ...def,
            interactions: [...(def.interactions || [])].sort((a, b) => b.priority - a.priority),
            thresholds: [...(def.thresholds || [])].sort((a, b) => a.count - b.count),
            tick: def.tick
                ? {
                    damage: def.tick.damage ? { ...def.tick.damage, terms: [...(def.tick.damage.terms || [])] } as AilmentFormulaExpression : undefined,
                    decay: def.tick.decay ? { ...def.tick.decay, terms: [...(def.tick.decay.terms || [])] } as AilmentFormulaExpression : undefined
                }
                : undefined
        };
    }
    return { version: catalog.version, byId };
};

