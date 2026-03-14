import { describe, expect, it } from 'vitest';
import type { GenerationSpecInput } from '../generation';
import { lintGenerationSpecInput } from '../generation';

const point = (q: number, r: number) => ({ q, r, s: -q - r });

describe('generation spec linter', () => {
    it('fails parity-stressed authored families before runtime compile', () => {
        const spec: GenerationSpecInput = {
            authoredFloorFamilies: {
                parity_fail_family: {
                    id: 'parity_fail_family',
                    role: 'pressure_spike',
                    theme: 'inferno',
                    anchors: {
                        entry: point(0, 0),
                        exit: point(1, 0),
                    },
                    preferredModuleIds: ['inferno_failed_escape'],
                    requiredTacticalTags: ['hazard_lure'],
                    requiredNarrativeTags: ['failed_escape'],
                    closedPaths: [
                        {
                            id: 'forced_even_path',
                            entryAnchorId: 'entry',
                            exitAnchorId: 'exit',
                            requiredLength: 4,
                            requiredParity: 'even'
                        }
                    ]
                }
            },
            floorFamilyAssignments: {
                5: 'parity_fail_family'
            }
        };

        const findings = lintGenerationSpecInput(spec);

        expect(findings.some((finding) => finding.code === 'SPEC_PARITY_STRESS')).toBe(true);
        expect(findings.find((finding) => finding.code === 'SPEC_PARITY_STRESS')?.severity).toBe('error');
    });
});
