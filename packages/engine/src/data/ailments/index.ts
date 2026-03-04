import { MVP_AILMENT_CATALOG } from './mvp-ailments';
import { compileAilmentCatalog, parseAilmentCatalog } from './parser';
import type { AilmentDefinition } from './contracts';
import type { AilmentID } from '../../types/registry';

export * from './contracts';
export * from './parser';
export * from './mvp-ailments';
export * from './consistency';

const parsed = parseAilmentCatalog(MVP_AILMENT_CATALOG);
const compiled = compileAilmentCatalog(parsed);

export const getAilmentDefinition = (id: AilmentID): AilmentDefinition | undefined => compiled.byId[id];
export const listAilmentDefinitions = (): AilmentDefinition[] => Object.values(compiled.byId);
export const getCompiledAilmentCatalog = () => compiled;
