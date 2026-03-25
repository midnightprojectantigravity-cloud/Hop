import { describe, expect, it } from 'vitest';
import { validateDefaultWorldgenSpec } from '../generation';

describe('default worldgen spec validation', () => {
    it('has no error-severity findings', () => {
        const findings = validateDefaultWorldgenSpec();

        expect(findings.filter((finding) => finding.severity === 'error')).toEqual([]);
    });
});
