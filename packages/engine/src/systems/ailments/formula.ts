import type { AilmentFormulaExpression } from '../../data/ailments';
import type { AilmentFormulaContext } from './types';

const applyRoundMode = (value: number, mode: AilmentFormulaExpression['round']): number => {
    if (mode === 'floor') return Math.floor(value);
    if (mode === 'ceil') return Math.ceil(value);
    if (mode === 'round') return Math.round(value);
    return value;
};

const clamp = (value: number, min?: number, max?: number): number => {
    let next = value;
    if (typeof min === 'number') next = Math.max(min, next);
    if (typeof max === 'number') next = Math.min(max, next);
    return next;
};

const resolveVariable = (ctx: AilmentFormulaContext, variable: string): number => {
    switch (variable) {
    case 'currentCounters': return ctx.currentCounters;
    case 'resiliencePct': return ctx.resiliencePct;
    case 'maxHp': return ctx.maxHp;
    case 'body': return ctx.body;
    case 'mind': return ctx.mind;
    case 'instinct': return ctx.instinct;
    default: return 0;
    }
};

export const evaluateAilmentFormula = (
    formula: AilmentFormulaExpression | undefined,
    context: AilmentFormulaContext
): number => {
    if (!formula) return 0;
    const termTotal = (formula.terms || []).reduce((sum, term) => {
        return sum + (resolveVariable(context, term.variable) * term.coefficient);
    }, 0);
    const raw = formula.base + termTotal;
    const rounded = applyRoundMode(raw, formula.round);
    const clamped = clamp(rounded, formula.min, formula.max);
    return Number.isFinite(clamped) ? clamped : 0;
};

