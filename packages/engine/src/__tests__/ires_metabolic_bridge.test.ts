import { describe, expect, it } from 'vitest';
import { DEFAULT_IRES_METABOLIC_CONFIG } from '../systems/ires/metabolic-config';
import {
    resolveLegacyIresRulesetFromMetabolic,
    resolveLegacyMovementProfilesFromMetabolic
} from '../systems/ires/metabolic-runtime-bridge';

describe('IRES metabolic runtime bridge', () => {
    it('derives additive legacy ruleset fields without mutating the metabolic config', () => {
        const ruleset = resolveLegacyIresRulesetFromMetabolic(DEFAULT_IRES_METABOLIC_CONFIG);

        expect(ruleset.metabolism?.version).toBe('ires-metabolism-v6');
        expect(ruleset.enterExhaustedAt).toBe(DEFAULT_IRES_METABOLIC_CONFIG.enterExhaustedAt);
        expect(ruleset.restExhaustionClear).toBe(DEFAULT_IRES_METABOLIC_CONFIG.waitExhaustionBonus);
        expect(DEFAULT_IRES_METABOLIC_CONFIG.baseBfiFormula.base).toBe(10);
    });

    it('maps movement entries into legacy skill resource profiles via their assigned bands', () => {
        const movementProfiles = resolveLegacyMovementProfilesFromMetabolic(DEFAULT_IRES_METABOLIC_CONFIG);

        expect(movementProfiles.BASIC_MOVE.primaryResource).toBe('spark');
        expect(movementProfiles.BASIC_MOVE.primaryCost).toBe(DEFAULT_IRES_METABOLIC_CONFIG.actionBands.maintenance.sparkCost);
        expect(movementProfiles.PHASE_STEP.primaryResource).toBe('mana');
        expect(movementProfiles.VAULT.countsAsAction).toBe(true);
    });
});
