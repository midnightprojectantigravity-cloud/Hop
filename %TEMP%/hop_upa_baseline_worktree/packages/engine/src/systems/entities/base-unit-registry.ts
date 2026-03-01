import type { BaseUnitDefinition } from '../../data/contracts';

const unitsById = new Map<string, BaseUnitDefinition>();
const unitsBySubtype = new Map<string, BaseUnitDefinition>();

export const clearBaseUnitRegistry = (): void => {
    unitsById.clear();
    unitsBySubtype.clear();
};

export const registerBaseUnitDefinition = (definition: BaseUnitDefinition): BaseUnitDefinition => {
    unitsById.set(definition.id, definition);
    if (definition.subtype) unitsBySubtype.set(definition.subtype, definition);
    return definition;
};

export const registerBaseUnitDefinitions = (definitions: BaseUnitDefinition[]): BaseUnitDefinition[] =>
    definitions.map(registerBaseUnitDefinition);

export const getBaseUnitDefinitionById = (id: string): BaseUnitDefinition | undefined =>
    unitsById.get(id);

export const getBaseUnitDefinitionBySubtype = (subtype: string): BaseUnitDefinition | undefined =>
    unitsBySubtype.get(subtype);

export const getAllBaseUnitDefinitions = (): BaseUnitDefinition[] =>
    [...unitsById.values()];

