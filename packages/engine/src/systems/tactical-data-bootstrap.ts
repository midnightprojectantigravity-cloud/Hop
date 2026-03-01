import type { TacticalDataPack } from '../data/contracts';
import { parseTacticalDataPack } from '../data/contract-parser';
import { TACTICAL_CORE_MVP_PACK } from '../data/packs/mvp-pack';
import { assertEnemyContentConsistency } from '../data/enemies';
import { assertAilmentContentConsistency, MVP_AILMENT_CATALOG } from '../data/ailments';
import { clearBaseUnitRegistry, registerBaseUnitDefinitions } from './entities/base-unit-registry';
import { clearCompositeSkillRegistry, registerCompositeSkillDefinitions } from './composite-skill-bridge';
import { validateDefaultLoadouts } from './loadout';

let bootstrapped = false;

export interface TacticalBootstrapResult {
    unitsRegistered: number;
    skillsRegistered: number;
    loadoutsValidated: number;
}

export const bootstrapTacticalData = (input: TacticalDataPack = TACTICAL_CORE_MVP_PACK): TacticalBootstrapResult => {
    const pack = parseTacticalDataPack(input);
    if (input === TACTICAL_CORE_MVP_PACK) {
        assertEnemyContentConsistency(pack);
        assertAilmentContentConsistency(MVP_AILMENT_CATALOG);
    }
    const loadoutsValidated = validateDefaultLoadouts();
    registerBaseUnitDefinitions(pack.units);
    registerCompositeSkillDefinitions(pack.skills);
    bootstrapped = true;
    return {
        unitsRegistered: pack.units.length,
        skillsRegistered: pack.skills.length,
        loadoutsValidated
    };
};

export const ensureTacticalDataBootstrapped = (): TacticalBootstrapResult => {
    if (bootstrapped) {
        return {
            unitsRegistered: 0,
            skillsRegistered: 0,
            loadoutsValidated: 0
        };
    }
    return bootstrapTacticalData();
};

export const isTacticalDataBootstrapped = (): boolean => bootstrapped;

export const resetTacticalDataBootstrap = (): void => {
    bootstrapped = false;
    clearBaseUnitRegistry();
    clearCompositeSkillRegistry();
};
