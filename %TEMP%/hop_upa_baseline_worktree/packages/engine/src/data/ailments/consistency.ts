import type { AilmentID } from '../../types/registry';
import { TILE_EFFECTS } from '../../systems/tiles/tile-registry';
import type { AilmentCatalog } from './contracts';

export interface AilmentContentIssue {
    code: 'MISSING_PILOT_AILMENT' | 'MISSING_MIASMA_TILE_EFFECT' | 'MISSING_INCINERATED_THRESHOLD';
    message: string;
}

const PILOT_AILMENTS: AilmentID[] = ['burn', 'wet', 'poison', 'frozen', 'bleed'];

export const validateAilmentContentConsistency = (catalog: AilmentCatalog): AilmentContentIssue[] => {
    const issues: AilmentContentIssue[] = [];
    const byId = new Map(catalog.ailments.map(def => [def.id, def]));
    PILOT_AILMENTS.forEach(id => {
        if (!byId.has(id)) {
            issues.push({
                code: 'MISSING_PILOT_AILMENT',
                message: `Missing pilot ailment definition "${id}"`
            });
        }
    });

    const burn = byId.get('burn');
    const hasIncinerated = !!burn?.thresholds?.some(t => t.effectId === 'INCINERATED');
    if (!hasIncinerated) {
        issues.push({
            code: 'MISSING_INCINERATED_THRESHOLD',
            message: 'burn thresholds must define INCINERATED entry for pilot behavior.'
        });
    }

    if (!TILE_EFFECTS.MIASMA) {
        issues.push({
            code: 'MISSING_MIASMA_TILE_EFFECT',
            message: 'Tile effect registry must include MIASMA for ACAE pilot.'
        });
    }
    return issues;
};

export const assertAilmentContentConsistency = (catalog: AilmentCatalog): void => {
    const issues = validateAilmentContentConsistency(catalog);
    if (issues.length === 0) return;
    throw new Error(`Ailment content consistency failed: ${issues.map(i => `[${i.code}] ${i.message}`).join(' | ')}`);
};

