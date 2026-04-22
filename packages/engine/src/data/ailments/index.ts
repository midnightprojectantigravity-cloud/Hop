import { MVP_AILMENT_CATALOG } from './mvp-ailments';
import { compileAilmentCatalog, parseAilmentCatalog } from './parser';
import type { AilmentCatalog, AilmentDefinition } from './contracts';
import type { CompiledAilmentCatalog } from './parser';
import type { AilmentID } from '../../types/registry';

export * from './contracts';
export * from './parser';
export * from './mvp-ailments';
export * from './consistency';

let cachedParsedCatalog: AilmentCatalog | undefined;
let cachedCompiledCatalog: CompiledAilmentCatalog | undefined;

const getCompiledCatalog = (): CompiledAilmentCatalog => {
    if (!cachedCompiledCatalog) {
        cachedParsedCatalog = cachedParsedCatalog || parseAilmentCatalog(MVP_AILMENT_CATALOG);
        cachedCompiledCatalog = compileAilmentCatalog(cachedParsedCatalog);
    }
    return cachedCompiledCatalog;
};

export const getAilmentDefinition = (id: AilmentID): AilmentDefinition | undefined => getCompiledCatalog().byId[id];
export const listAilmentDefinitions = (): AilmentDefinition[] => Object.values(getCompiledCatalog().byId);
export const getCompiledAilmentCatalog = () => getCompiledCatalog();
