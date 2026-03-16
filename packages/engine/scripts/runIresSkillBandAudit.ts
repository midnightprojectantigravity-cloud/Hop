import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildIresSkillBandAuditReport } from '../src/systems/evaluation/ires-skill-band-audit';

const toMarkdown = (report: ReturnType<typeof buildIresSkillBandAuditReport>): string => {
    const lines: string[] = [];
    const formatRisk = (riskLevel: string, acceptedRisk: boolean): string =>
        acceptedRisk ? `${riskLevel} (accepted)` : riskLevel;
    const pushTable = (
        title: string,
        rows: typeof report.rows,
        renderRow: (row: (typeof report.rows)[number]) => string,
        header: string[]
    ): void => {
        lines.push(title);
        lines.push('');
        lines.push(`| ${header.join(' | ')} |`);
        lines.push(`| ${header.map(() => '---').join(' | ')} |`);
        rows.forEach((row) => lines.push(renderRow(row)));
        lines.push('');
    };

    lines.push('# IRES Skill Band Audit');
    lines.push('');
    lines.push('## Coverage Summary');
    lines.push('');
    lines.push(`- mapped known skills: ${report.mappedSkillIds.length}`);
    lines.push(`- expanded non-active mappings: ${report.expandedMappedSkillIds.length}`);
    lines.push(`- mapped active-roster skills: ${report.mappedActiveRosterSkillIds.length}`);
    lines.push(`- known legacy fallback skills: ${report.legacyFallbackSkillIds.length}`);
    lines.push(`- accepted medium-risk migrations: ${report.acceptedRiskSkillIds.length}`);
    lines.push(`- outstanding high-risk deltas: ${report.highestRiskSkillIds.length}`);
    lines.push('');

    const activeRowsByBand = new Map<string, typeof report.rows>();
    report.rows
        .filter((row) => ['player_default', 'enemy_runtime', 'shared_active'].includes(row.scope))
        .forEach((row) => {
            const bandId = row.metabolicBandId || 'unbanded';
            activeRowsByBand.set(bandId, [...(activeRowsByBand.get(bandId) || []), row]);
        });

    lines.push('## Active-Roster Skills By Band');
    lines.push('');
    [...activeRowsByBand.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .forEach(([bandId, rows]) => {
            pushTable(
                `### ${bandId}`,
                rows.sort((left, right) => left.skillId.localeCompare(right.skillId)),
                (row) => `| ${row.skillId} | ${row.scope} | ${row.derivedProfile.primaryResource} | ${row.derivedProfile.primaryCost} | ${row.derivedProfile.baseStrain} | ${row.travelEligible ? 'yes' : 'no'} | ${formatRisk(row.riskLevel, row.acceptedRisk)} |`,
                ['Skill', 'Scope', 'Resource', 'Cost', 'Strain', 'Travel Eligible', 'Risk']
            );
        });

    pushTable(
        '## Action-Bearing Off-Roster Skills',
        report.rows
            .filter((row) => row.scope === 'off_roster_action')
            .sort((left, right) => left.skillId.localeCompare(right.skillId)),
        (row) => `| ${row.skillId} | ${row.metabolicBandId || '-'} | ${row.derivedProfile.primaryResource} | ${row.derivedProfile.primaryCost} | ${row.derivedProfile.baseStrain} | ${formatRisk(row.riskLevel, row.acceptedRisk)} | ${row.notes} |`,
        ['Skill', 'Band', 'Resource', 'Cost', 'Strain', 'Risk', 'Notes']
    );

    pushTable(
        '## Inert Passive And Capability Skills',
        report.rows
            .filter((row) => row.scope === 'loadout_capability' || row.scope === 'system_passive')
            .sort((left, right) => left.skillId.localeCompare(right.skillId)),
        (row) => `| ${row.skillId} | ${row.scope} | ${row.derivedProfile.primaryResource} | ${row.derivedProfile.primaryCost} | ${row.derivedProfile.baseStrain} | ${row.legacyIntrinsicPowerScore} | ${row.derivedIntrinsicPowerScore} | ${row.deltaIntrinsicPowerScore} |`,
        ['Skill', 'Scope', 'Resource', 'Cost', 'Strain', 'Legacy Power', 'Derived Power', 'Delta Power']
    );

    pushTable(
        '## Companion Skill Table',
        report.rows
            .filter((row) => row.scope === 'companion_runtime')
            .sort((left, right) => left.skillId.localeCompare(right.skillId)),
        (row) => `| ${row.skillId} | ${row.metabolicBandId || '-'} | ${row.derivedProfile.primaryResource} | ${row.derivedProfile.primaryCost} | ${row.derivedProfile.baseStrain} | ${row.countsAsMovement ? 'yes' : 'no'} | ${row.countsAsAction ? 'yes' : 'no'} | ${row.notes} |`,
        ['Skill', 'Band', 'Resource', 'Cost', 'Strain', 'Movement', 'Action', 'Notes']
    );

    pushTable(
        '## Spawned And System Runtime Skills',
        report.rows
            .filter((row) => row.scope === 'spawned_runtime')
            .sort((left, right) => left.skillId.localeCompare(right.skillId)),
        (row) => `| ${row.skillId} | ${row.scope} | ${row.derivedProfile.primaryResource} | ${row.derivedProfile.primaryCost} | ${row.derivedProfile.baseStrain} | ${row.notes} |`,
        ['Skill', 'Scope', 'Resource', 'Cost', 'Strain', 'Notes']
    );

    pushTable(
        '## Intentional Medium-Risk Migrations',
        report.rows
            .filter((row) => row.acceptedRisk)
            .sort((left, right) => left.skillId.localeCompare(right.skillId)),
        (row) => `| ${row.skillId} | ${row.metabolicBandId || '-'} | ${row.legacyProfile.primaryCost} | ${row.derivedProfile.primaryCost} | ${row.legacyProfile.baseStrain} | ${row.derivedProfile.baseStrain} | ${row.notes} |`,
        ['Skill', 'Band', 'Legacy Cost', 'Derived Cost', 'Legacy Strain', 'Derived Strain', 'Notes']
    );

    pushTable(
        '## Outstanding High-Risk Deltas',
        report.rows
            .filter((row) => row.riskLevel === 'high')
            .sort((left, right) =>
                Math.max(Math.abs(right.deltaPrimaryCost), Math.abs(right.deltaBaseStrain))
                - Math.max(Math.abs(left.deltaPrimaryCost), Math.abs(left.deltaBaseStrain))
                || left.skillId.localeCompare(right.skillId)
            ),
        (row) => `| ${row.skillId} | ${row.scope} | ${row.metabolicBandId || '-'} | ${row.legacyProfile.primaryCost} | ${row.derivedProfile.primaryCost} | ${row.legacyProfile.baseStrain} | ${row.derivedProfile.baseStrain} | ${row.notes} |`,
        ['Skill', 'Scope', 'Band', 'Legacy Cost', 'Derived Cost', 'Legacy Strain', 'Derived Strain', 'Notes']
    );

    pushTable(
        '## Power-Score Delta Watchlist',
        report.rows
            .filter((row) => report.expandedMappedSkillIds.includes(row.skillId))
            .sort((left, right) =>
                Math.abs(right.deltaIntrinsicPowerScore) - Math.abs(left.deltaIntrinsicPowerScore)
                || left.skillId.localeCompare(right.skillId)
            ),
        (row) => `| ${row.skillId} | ${row.scope} | ${row.legacyIntrinsicPowerScore} | ${row.derivedIntrinsicPowerScore} | ${row.deltaIntrinsicPowerScore} | ${row.notes} |`,
        ['Skill', 'Scope', 'Legacy Power', 'Derived Power', 'Delta Power', 'Notes']
    );

    lines.push('## Player Loadout Coverage');
    lines.push('');
    lines.push(`- player default roster skills: ${report.playerDefaultSkillIds.length}`);
    lines.push(`- mapped in active roster: ${report.playerDefaultSkillIds.filter((skillId) => report.mappedActiveRosterSkillIds.includes(skillId)).length}`);
    lines.push(`- skills: ${report.playerDefaultSkillIds.join(', ')}`);
    lines.push('');

    lines.push('## Enemy Runtime Coverage');
    lines.push('');
    lines.push(`- enemy runtime skills: ${report.enemyRuntimeSkillIds.length}`);
    lines.push(`- mapped in active roster: ${report.enemyRuntimeSkillIds.filter((skillId) => report.mappedActiveRosterSkillIds.includes(skillId)).length}`);
    lines.push(`- skills: ${report.enemyRuntimeSkillIds.join(', ')}`);
    lines.push('');

    lines.push('## Recommended Tuning Queue');
    lines.push('');
    report.recommendedTuningQueue.forEach((skillId, index) => {
        lines.push(`${index + 1}. ${skillId}`);
    });
    lines.push('');

    return `${lines.join('\n')}\n`;
};

const jsonOutFile = process.argv[2] || 'artifacts/ires/IRES_SKILL_BAND_AUDIT.json';
const mdOutFile = process.argv[3] || 'artifacts/ires/IRES_SKILL_BAND_AUDIT.md';

const report = buildIresSkillBandAuditReport();
const jsonOutPath = resolve(process.cwd(), jsonOutFile);
const mdOutPath = resolve(process.cwd(), mdOutFile);

mkdirSync(dirname(jsonOutPath), { recursive: true });
mkdirSync(dirname(mdOutPath), { recursive: true });
writeFileSync(jsonOutPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(mdOutPath, toMarkdown(report), 'utf8');

console.log(JSON.stringify({
    wroteJson: jsonOutPath,
    wroteMarkdown: mdOutPath,
    mappedSkills: report.mappedSkillIds.length,
    expandedMappedSkills: report.expandedMappedSkillIds.length,
    mappedActiveRosterSkills: report.mappedActiveRosterSkillIds.length,
    legacyFallbackSkills: report.legacyFallbackSkillIds.length,
    acceptedMediumRiskSkills: report.acceptedRiskSkillIds.length,
    highRiskSkills: report.highestRiskSkillIds.length
}, null, 2));
