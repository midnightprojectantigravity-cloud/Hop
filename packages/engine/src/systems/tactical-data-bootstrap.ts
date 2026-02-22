import type { TacticalDataPack } from '../data/contracts';
import { parseTacticalDataPack } from '../data/contract-parser';
import { TACTICAL_CORE_MVP_PACK } from '../data/packs/mvp-pack';
import { clearBaseUnitRegistry, registerBaseUnitDefinitions } from './base-unit-registry';
import { clearCompositeSkillRegistry, registerCompositeSkillDefinitions } from './composite-skill-bridge';

let bootstrapped = false;

export interface TacticalBootstrapResult {
    unitsRegistered: number;
    skillsRegistered: number;
}

export const bootstrapTacticalData = (input: TacticalDataPack = TACTICAL_CORE_MVP_PACK): TacticalBootstrapResult => {
    const pack = parseTacticalDataPack(input);
    registerBaseUnitDefinitions(pack.units);
    registerCompositeSkillDefinitions(pack.skills);
    bootstrapped = true;
    return {
        unitsRegistered: pack.units.length,
        skillsRegistered: pack.skills.length
    };
};

export const ensureTacticalDataBootstrapped = (): TacticalBootstrapResult => {
    if (bootstrapped) {
        return {
            unitsRegistered: 0,
            skillsRegistered: 0
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
