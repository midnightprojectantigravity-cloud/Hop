import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { createActiveSkill } from '../skillRegistry';
import { DEFAULT_CALIBRATION_PROFILE, FIREMAGE_BASELINE_PROFILE, getCalibrationProfile } from '../systems/evaluation/calibration';
import { createDefaultEvaluationRegistry, evaluateEntity } from '../systems/evaluation/evaluation';
import type { Actor, SkillIntentProfile } from '../types';

describe('Calibration surfaces', () => {
    it('resolves known calibration profiles', () => {
        expect(getCalibrationProfile('cal-v1').version).toBe('cal-v1');
        expect(getCalibrationProfile('cal-v1-firemage-baseline').version).toBe('cal-v1-firemage-baseline');
        expect(getCalibrationProfile('missing-profile').version).toBe('cal-v1');
    });

    it('calibration profile changes evaluator outputs deterministically', () => {
        const registry = createDefaultEvaluationRegistry();
        const profile: SkillIntentProfile = {
            id: 'FIREBALL',
            intentTags: ['damage'],
            target: { range: 3, pattern: 'radius', aoeRadius: 1 },
            estimates: { damage: 5, control: 1 },
            economy: { cost: 3, cooldown: 1, consumesTurn: true },
            risk: { selfExposure: 0.15, hazardAffinity: 0.1 },
            complexity: 2
        };
        const base = registry.evaluate('skill', profile, { calibration: DEFAULT_CALIBRATION_PROFILE });
        const tuned = registry.evaluate('skill', profile, { calibration: FIREMAGE_BASELINE_PROFILE });
        expect(base).not.toEqual(tuned);
        const tunedAgain = registry.evaluate('skill', profile, { calibration: FIREMAGE_BASELINE_PROFILE });
        expect(tunedAgain).toEqual(tuned);
    });

    it('entity coefficients are deterministic when unchanged', () => {
        const actor: Actor = {
            id: 'calib_entity',
            type: 'player',
            subtype: 'firemage',
            position: createHex(0, 0),
            hp: 3,
            maxHp: 3,
            speed: 1,
            factionId: 'player',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: [createActiveSkill('FIREBALL')]
        };
        const a = evaluateEntity(actor, { calibration: DEFAULT_CALIBRATION_PROFILE });
        const b = evaluateEntity(actor, { calibration: DEFAULT_CALIBRATION_PROFILE });
        expect(a).toEqual(b);
    });
});
