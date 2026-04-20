import type { BaseUnitDefinition } from '../contracts';
import {
    getAllBaseUnitDefinitions,
    getBaseUnitDefinitionById as getRegisteredUnitDefinitionById,
    getBaseUnitDefinitionBySubtype as getRegisteredUnitDefinitionBySubtype
} from '../../systems/entities/base-unit-registry';
import {
    getEnemyCatalogBestiaryEntry as getEnemyCatalogBestiaryEntryFromContent,
    getEnemyCatalogContract as getEnemyCatalogContractFromContent,
    getEnemyCatalogEntry as getEnemyCatalogEntryFromContent,
    getEnemyCatalogSkillLoadout as getEnemyCatalogSkillLoadoutFromContent,
    listEnemyCatalogEntries as listEnemyCatalogEntriesFromContent,
    type EnemyCatalogEntry
} from '../enemies';
import { CORE_UNIT_DEFINITIONS } from './core-unit-definitions';
import {
    COMPANION_BALANCE_CONTENT,
    getCompanionBalanceEntry as getCompanionBalanceEntryFromContent,
    getCompanionModeDefinition as getCompanionModeDefinitionFromContent,
    listCompanionBalanceEntries as listCompanionBalanceEntriesFromContent,
    type CompanionBalanceEntry,
    type CompanionModeDefinition,
    type CompanionModeId,
    type CompanionSubtypeId
} from '../companions/content';

export const listUnitDefinitions = (): BaseUnitDefinition[] => {
    const registered = getAllBaseUnitDefinitions();
    return registered.length > 0 ? registered : [...CORE_UNIT_DEFINITIONS];
};

export const getUnitDefinitionBySubtype = (subtype: string): BaseUnitDefinition | undefined =>
    getRegisteredUnitDefinitionBySubtype(subtype)
    || CORE_UNIT_DEFINITIONS.find(def =>
        def.subtype === subtype
        || def.id === subtype
        || def.id === `PLAYER_${subtype.toUpperCase()}`
        || def.id === `COMPANION_${subtype.toUpperCase()}`
    );

export const getUnitDefinitionById = (id: string): BaseUnitDefinition | undefined =>
    getRegisteredUnitDefinitionById(id) || CORE_UNIT_DEFINITIONS.find(def => def.id === id);

export const getCompanionBalanceEntry = (subtype: string): CompanionBalanceEntry | undefined =>
    getCompanionBalanceEntryFromContent(subtype);

export const listCompanionBalanceEntries = (): CompanionBalanceEntry[] =>
    listCompanionBalanceEntriesFromContent();

export const getCompanionModeDefinition = (
    subtype: CompanionSubtypeId,
    mode: CompanionModeId
): CompanionModeDefinition | undefined =>
    getCompanionModeDefinitionFromContent(subtype, mode);

export const listEnemyCatalogEntries = (): EnemyCatalogEntry[] =>
    listEnemyCatalogEntriesFromContent();

export const getEnemyCatalogEntry = (subtype: string): EnemyCatalogEntry | undefined =>
    getEnemyCatalogEntryFromContent(subtype);

export const getEnemyCatalogBestiaryEntry = (subtype: string) =>
    getEnemyCatalogBestiaryEntryFromContent(subtype);

export const getEnemyCatalogContract = (subtype: string) =>
    getEnemyCatalogContractFromContent(subtype);

export const getEnemyCatalogSkillLoadout = (
    subtype: string,
    options: {
        includePassive?: boolean;
        source?: 'runtime' | 'bestiary';
    } = {}
): string[] =>
    getEnemyCatalogSkillLoadoutFromContent(subtype, options);

export { COMPANION_BALANCE_CONTENT };
