import type {
    BaseUnitDefinition,
    CompiledBaseUnitBlueprint,
    CompiledCompositeSkillTemplate,
    CompositeAtomicEffectDefinition,
    CompositeSkillDefinition,
    CompositeSkillUpgradeDefinition,
    TacticalDataPack
} from './contracts';

export interface ValidationIssue {
    path: string;
    message: string;
}

export class ContractValidationError extends Error {
    issues: ValidationIssue[];
    constructor(kind: 'BaseUnit' | 'CompositeSkill' | 'TacticalDataPack', issues: ValidationIssue[]) {
        super(`${kind} validation failed:\n${issues.map(i => `${i.path}: ${i.message}`).join('\n')}`);
        this.name = 'ContractValidationError';
        this.issues = issues;
    }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const push = (issues: ValidationIssue[], path: string, message: string) => issues.push({ path, message });

const parseJsonLike = (input: unknown): unknown => {
    if (!isStr(input)) return input;
    try {
        return JSON.parse(input);
    } catch (err) {
        throw new Error(`Invalid JSON: ${(err as Error).message}`);
    }
};

const checkStringArray = (value: unknown, issues: ValidationIssue[], path: string, opts: { nonEmpty?: boolean; unique?: boolean } = {}) => {
    if (!Array.isArray(value)) return push(issues, path, 'Expected array');
    const seen = new Set<string>();
    if (opts.nonEmpty && value.length === 0) push(issues, path, 'Must not be empty');
    value.forEach((x, i) => {
        if (!isStr(x) || x.length === 0) return push(issues, `${path}[${i}]`, 'Expected non-empty string');
        if (opts.unique) {
            if (seen.has(x)) push(issues, `${path}[${i}]`, `Duplicate "${x}"`);
            seen.add(x);
        }
    });
};

const checkScalarExpr = (value: unknown, issues: ValidationIssue[], path: string) => {
    if (!isRecord(value)) return push(issues, path, 'Expected object');
    if (!isNum(value.base)) push(issues, `${path}.base`, 'Expected number');
    if (value.min !== undefined && !isNum(value.min)) push(issues, `${path}.min`, 'Expected number');
    if (value.max !== undefined && !isNum(value.max)) push(issues, `${path}.max`, 'Expected number');
    if (isNum(value.min) && isNum(value.max) && value.min > value.max) push(issues, path, 'min must be <= max');
};

const checkEffect = (value: unknown, issues: ValidationIssue[], path: string): value is CompositeAtomicEffectDefinition => {
    if (!isRecord(value)) {
        push(issues, path, 'Expected object');
        return false;
    }
    if (!isStr(value.id) || value.id.length === 0) push(issues, `${path}.id`, 'Expected non-empty string');
    checkStringArray(value.tags, issues, `${path}.tags`, { nonEmpty: true, unique: true });
    if (!isStr(value.kind)) {
        push(issues, `${path}.kind`, 'Expected kind');
        return false;
    }
    if (value.kind === 'DEAL_DAMAGE') {
        checkScalarExpr(value.amount, issues, `${path}.amount`);
        if (!isRecord(value.target) || !isStr(value.target.selector)) push(issues, `${path}.target`, 'Expected selector');
        return true;
    }
    if (value.kind === 'APPLY_STATUS') {
        if (!isStr(value.statusId) || value.statusId.length === 0) push(issues, `${path}.statusId`, 'Expected statusId');
        if (!isInt(value.duration) || value.duration < 0) push(issues, `${path}.duration`, 'Expected integer >= 0');
        if (!isRecord(value.target) || !isStr(value.target.selector)) push(issues, `${path}.target`, 'Expected selector');
        return true;
    }
    if (value.kind === 'APPLY_FORCE') {
        if (!isRecord(value.force)) {
            push(issues, `${path}.force`, 'Expected object');
            return true;
        }
        if (!isStr(value.force.mode) || !new Set(['push', 'pull']).has(value.force.mode)) push(issues, `${path}.force.mode`, 'Expected push|pull');
        if (!isStr(value.force.direction) || !new Set(['source_to_target', 'target_to_source']).has(value.force.direction)) push(issues, `${path}.force.direction`, 'Invalid direction');
        if (!isInt(value.force.maxDistance) || value.force.maxDistance < 0) push(issues, `${path}.force.maxDistance`, 'Expected integer >= 0');
        checkScalarExpr(value.force.magnitude, issues, `${path}.force.magnitude`);
        if (!isRecord(value.force.collision)) push(issues, `${path}.force.collision`, 'Expected object');
        return true;
    }
    if (value.kind === 'MESSAGE') {
        if (!isStr(value.text) || value.text.length === 0) push(issues, `${path}.text`, 'Expected non-empty string');
        return true;
    }
    push(issues, `${path}.kind`, 'Unknown kind');
    return false;
};

const checkPropensity = (value: unknown, issues: ValidationIssue[], path: string) => {
    if (!isRecord(value)) return push(issues, path, 'Expected object');
    if (!isStr(value.method)) return push(issues, `${path}.method`, 'Expected method');
    if (value.method === 'fixed') {
        if (!isNum(value.value)) push(issues, `${path}.value`, 'Expected number');
        return;
    }
    if (value.method === 'uniform_int') {
        if (!isInt(value.min)) push(issues, `${path}.min`, 'Expected integer');
        if (!isInt(value.max)) push(issues, `${path}.max`, 'Expected integer');
        if (isInt(value.min) && isInt(value.max) && value.min > value.max) push(issues, path, 'min must be <= max');
        return;
    }
    if (value.method === 'triangular_int') {
        if (!isInt(value.min)) push(issues, `${path}.min`, 'Expected integer');
        if (!isInt(value.mode)) push(issues, `${path}.mode`, 'Expected integer');
        if (!isInt(value.max)) push(issues, `${path}.max`, 'Expected integer');
        return;
    }
    if (value.method === 'weighted_table') {
        if (!Array.isArray(value.table) || value.table.length === 0) return push(issues, `${path}.table`, 'Expected non-empty array');
        value.table.forEach((entry, i) => {
            if (!isRecord(entry)) return push(issues, `${path}.table[${i}]`, 'Expected object');
            if (!isNum(entry.value)) push(issues, `${path}.table[${i}].value`, 'Expected number');
            if (!isNum(entry.weight) || entry.weight <= 0) push(issues, `${path}.table[${i}].weight`, 'Expected number > 0');
        });
        return;
    }
    push(issues, `${path}.method`, 'Unknown propensity method');
};

export const validateBaseUnitDefinition = (input: unknown): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    if (!isRecord(input)) {
        push(issues, '$', 'Expected object');
        return issues;
    }
    if (!isStr(input.version) || !/^1\./.test(input.version)) push(issues, '$.version', 'Expected v1.x');
    if (!isStr(input.id) || !/^[A-Z0-9_]+$/.test(input.id)) push(issues, '$.id', 'Expected uppercase id');
    if (!isStr(input.name) || input.name.length === 0) push(issues, '$.name', 'Expected non-empty string');
    if (!isStr(input.actorType) || !new Set(['player', 'enemy']).has(input.actorType)) push(issues, '$.actorType', 'Expected player|enemy');
    if (!isStr(input.factionId) || input.factionId.length === 0) push(issues, '$.factionId', 'Expected non-empty string');
    if (!isRecord(input.coordSpace) || input.coordSpace.system !== 'cube-axial' || input.coordSpace.pointFormat !== 'qrs') push(issues, '$.coordSpace', 'Expected {system:cube-axial,pointFormat:qrs}');
    if (!isRecord(input.instantiate)) {
        push(issues, '$.instantiate', 'Expected object');
    } else {
        if (!isStr(input.instantiate.rngStream) || input.instantiate.rngStream.length === 0) push(issues, '$.instantiate.rngStream', 'Expected non-empty string');
        if (!isStr(input.instantiate.counterMode) || !new Set(['consume_global', 'stateless']).has(input.instantiate.counterMode)) push(issues, '$.instantiate.counterMode', 'Expected consume_global|stateless');
        checkStringArray(input.instantiate.drawOrder, issues, '$.instantiate.drawOrder', { nonEmpty: true, unique: true });
    }
    if (!isRecord(input.propensities)) {
        push(issues, '$.propensities', 'Expected object');
    } else {
        const propensities = input.propensities as Record<string, unknown>;
        ['body', 'mind', 'instinct', 'speed', 'mass'].forEach(k => {
            if (!(k in propensities)) push(issues, `$.propensities.${k}`, 'Missing required propensity');
        });
        Object.entries(propensities).forEach(([key, val]) => checkPropensity(val, issues, `$.propensities.${key}`));
    }
    if (!isRecord(input.skillLoadout)) {
        push(issues, '$.skillLoadout', 'Expected object');
    } else {
        checkStringArray(input.skillLoadout.baseSkillIds, issues, '$.skillLoadout.baseSkillIds', { nonEmpty: true, unique: true });
        if (input.skillLoadout.passiveSkillIds !== undefined) checkStringArray(input.skillLoadout.passiveSkillIds, issues, '$.skillLoadout.passiveSkillIds', { unique: true });
    }
    return issues;
};

export const validateCompositeSkillDefinition = (input: unknown): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    if (!isRecord(input)) {
        push(issues, '$', 'Expected object');
        return issues;
    }
    if (!isStr(input.version) || !/^1\./.test(input.version)) push(issues, '$.version', 'Expected v1.x');
    if (!isStr(input.id) || !/^[A-Z0-9_]+$/.test(input.id)) push(issues, '$.id', 'Expected uppercase id');
    if (!isStr(input.name) || input.name.length === 0) push(issues, '$.name', 'Expected non-empty string');
    if (!isStr(input.slot) || !new Set(['offensive', 'defensive', 'utility', 'passive']).has(input.slot)) push(issues, '$.slot', 'Invalid slot');
    checkStringArray(input.keywords, issues, '$.keywords', { unique: true });
    if (!isRecord(input.targeting)) {
        push(issues, '$.targeting', 'Expected object');
    } else {
        if (!isStr(input.targeting.mode) || !new Set(['self', 'single', 'line', 'radius', 'global']).has(input.targeting.mode)) push(issues, '$.targeting.mode', 'Invalid mode');
        if (!isInt(input.targeting.range) || input.targeting.range < 0) push(issues, '$.targeting.range', 'Expected integer >= 0');
        if (typeof input.targeting.requiresLos !== 'boolean') push(issues, '$.targeting.requiresLos', 'Expected boolean');
        if (typeof input.targeting.allowOccupied !== 'boolean') push(issues, '$.targeting.allowOccupied', 'Expected boolean');
    }
    if (!isRecord(input.stackPolicy) || input.stackPolicy.resolveOrder !== 'LIFO') push(issues, '$.stackPolicy.resolveOrder', 'MVP requires LIFO');
    if (!isRecord(input.baseAction)) {
        push(issues, '$.baseAction', 'Expected object');
    } else {
        if (!isRecord(input.baseAction.costs)) push(issues, '$.baseAction.costs', 'Expected object');
        else {
            if (!isNum(input.baseAction.costs.energy) || input.baseAction.costs.energy < 0) push(issues, '$.baseAction.costs.energy', 'Expected number >= 0');
            if (!isInt(input.baseAction.costs.cooldown) || input.baseAction.costs.cooldown < 0) push(issues, '$.baseAction.costs.cooldown', 'Expected integer >= 0');
            if (typeof input.baseAction.costs.consumesTurn !== 'boolean') push(issues, '$.baseAction.costs.consumesTurn', 'Expected boolean');
        }
        if (!Array.isArray(input.baseAction.effects) || input.baseAction.effects.length === 0) push(issues, '$.baseAction.effects', 'Expected non-empty array');
        else input.baseAction.effects.forEach((e, i) => checkEffect(e, issues, `$.baseAction.effects[${i}]`));
    }
    if (!Array.isArray(input.upgrades)) push(issues, '$.upgrades', 'Expected array');
    else input.upgrades.forEach((u, i) => {
        if (!isRecord(u)) return push(issues, `$.upgrades[${i}]`, 'Expected object');
        if (!isStr(u.id) || !/^[A-Z0-9_]+$/.test(u.id)) push(issues, `$.upgrades[${i}].id`, 'Expected uppercase id');
        if (!isStr(u.name) || u.name.length === 0) push(issues, `$.upgrades[${i}].name`, 'Expected non-empty string');
        if (!Array.isArray(u.modifiers)) push(issues, `$.upgrades[${i}].modifiers`, 'Expected array');
    });
    return issues;
};

export const parseBaseUnitDefinition = (input: unknown): BaseUnitDefinition => {
    const parsed = parseJsonLike(input);
    const issues = validateBaseUnitDefinition(parsed);
    if (issues.length > 0) throw new ContractValidationError('BaseUnit', issues);
    return parsed as BaseUnitDefinition;
};

export const parseCompositeSkillDefinition = (input: unknown): CompositeSkillDefinition => {
    const parsed = parseJsonLike(input);
    const issues = validateCompositeSkillDefinition(parsed);
    if (issues.length > 0) throw new ContractValidationError('CompositeSkill', issues);
    return parsed as CompositeSkillDefinition;
};

export const parseTacticalDataPack = (input: unknown): TacticalDataPack => {
    const parsed = parseJsonLike(input);
    const issues: ValidationIssue[] = [];
    if (!isRecord(parsed)) {
        throw new ContractValidationError('TacticalDataPack', [{ path: '$', message: 'Expected pack object' }]);
    }
    if (!isStr(parsed.version) || !/^1\./.test(parsed.version)) {
        issues.push({ path: '$.version', message: 'Expected v1.x string' });
    }
    if (!Array.isArray(parsed.units)) {
        issues.push({ path: '$.units', message: 'Expected array' });
    } else {
        parsed.units.forEach((unit, idx) => {
            const unitIssues = validateBaseUnitDefinition(unit);
            unitIssues.forEach(issue => issues.push({ path: `$.units[${idx}]${issue.path.slice(1)}`, message: issue.message }));
        });
    }
    if (!Array.isArray(parsed.skills)) {
        issues.push({ path: '$.skills', message: 'Expected array' });
    } else {
        parsed.skills.forEach((skill, idx) => {
            const skillIssues = validateCompositeSkillDefinition(skill);
            skillIssues.forEach(issue => issues.push({ path: `$.skills[${idx}]${issue.path.slice(1)}`, message: issue.message }));
        });
    }
    if (issues.length > 0) {
        throw new ContractValidationError('TacticalDataPack', issues);
    }
    return parsed as unknown as TacticalDataPack;
};

export const compileBaseUnitBlueprint = (definition: BaseUnitDefinition): CompiledBaseUnitBlueprint => ({
    definition,
    drawOrder: [...definition.instantiate.drawOrder],
    skillIds: [...definition.skillLoadout.baseSkillIds],
    passiveSkillIds: [...(definition.skillLoadout.passiveSkillIds || [])]
});

export const compileCompositeSkillTemplate = (definition: CompositeSkillDefinition): CompiledCompositeSkillTemplate => {
    const upgradesById: Record<string, CompositeSkillUpgradeDefinition> = {};
    definition.upgrades.forEach(upgrade => {
        upgradesById[upgrade.id] = upgrade;
    });
    return {
        definition,
        baseEffects: [...definition.baseAction.effects],
        upgradesById
    };
};
