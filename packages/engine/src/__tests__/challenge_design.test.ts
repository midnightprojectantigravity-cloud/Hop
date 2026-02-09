import { describe, expect, it } from 'vitest';
import { runChallengeDesignWorkflow } from '../systems/challenge-design';

describe('Challenge design workflow', () => {
    it('selects deterministic encounter candidate for fixed target band', () => {
        const first = runChallengeDesignWorkflow(55, 5, 'cal-v1-firemage-baseline', 'uel-v1');
        const second = runChallengeDesignWorkflow(55, 5, 'cal-v1-firemage-baseline', 'uel-v1');
        expect(first.targetEncounter).toEqual(second.targetEncounter);
        expect(typeof first.targetEncounter.selected.encounter.difficultyGrade).toBe('number');
    });

    it('produces reinforce-first recommendations against firemage baseline', () => {
        const report = runChallengeDesignWorkflow(55, 5, 'cal-v1-firemage-baseline', 'uel-v1');
        expect(report.reinforcementPlan.length).toBeGreaterThan(0);
        expect(report.reinforcementPlan.some(r => r.upliftNeeded >= 0)).toBe(true);
    });
});
