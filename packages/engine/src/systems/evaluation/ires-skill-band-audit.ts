import { SkillRegistry, COMPOSITIONAL_SKILLS } from '../../skillRegistry';
import {
    ENEMY_RUNTIME_ACTIVE_SKILL_IDS,
    listBandMappedSkillIds,
    listExpandedBandMappedSkillIds,
    listLegacyFallbackSkillIds,
    listMappedActiveRosterSkillIds,
    PLAYER_DEFAULT_ACTIVE_SKILL_IDS,
    resolveLegacySkillResourceProfile,
    resolveSkillMetabolicBandProfile,
    resolveSkillResourceProfile
} from '../ires/skill-catalog';
import type { SkillMetabolicBandProfile, SkillResourceProfile, SkillSlot } from '../../types';
import { computeSkillPowerProfileWithResourceProfile } from './balance-skill-power';

export type IresSkillBandAuditScope =
    | 'player_default'
    | 'enemy_runtime'
    | 'shared_active'
    | 'loadout_capability'
    | 'off_roster_action'
    | 'companion_runtime'
    | 'spawned_runtime'
    | 'system_passive';
export type IresSkillBandAuditRiskLevel = 'low' | 'medium' | 'high';

export interface IresSkillBandAuditRow {
    skillId: string;
    slot: SkillSlot;
    scope: IresSkillBandAuditScope;
    profileSource: NonNullable<SkillResourceProfile['profileSource']>;
    metabolicBandId?: SkillMetabolicBandProfile['bandId'];
    resourceMode?: SkillMetabolicBandProfile['resourceMode'];
    countsAsMovement: boolean;
    countsAsAction: boolean;
    travelEligible: boolean;
    legacyProfile: SkillResourceProfile;
    derivedProfile: SkillResourceProfile;
    deltaPrimaryCost: number;
    deltaBaseStrain: number;
    deltaCountsAsMovement: number;
    deltaCountsAsAction: number;
    legacyIntrinsicPowerScore: number;
    derivedIntrinsicPowerScore: number;
    deltaIntrinsicPowerScore: number;
    riskLevel: IresSkillBandAuditRiskLevel;
    acceptedRisk: boolean;
    notes: string;
}

export interface IresSkillBandAuditReport {
    generatedAt: string;
    mappedSkillIds: string[];
    expandedMappedSkillIds: string[];
    mappedActiveRosterSkillIds: string[];
    legacyFallbackSkillIds: string[];
    playerDefaultSkillIds: string[];
    enemyRuntimeSkillIds: string[];
    rows: IresSkillBandAuditRow[];
    highestRiskSkillIds: string[];
    acceptedRiskSkillIds: string[];
    recommendedTuningQueue: string[];
}

const effectiveTravelEligible = (profile: SkillResourceProfile): boolean =>
    profile.travelEligible ?? (profile.countsAsMovement && !profile.countsAsAction);

const ACCEPTED_MEDIUM_RISK_SKILLS = new Set<string>(['BASIC_MOVE', 'GRAPPLE_HOOK']);
const playerDefaultActiveSkillSet = new Set<string>(PLAYER_DEFAULT_ACTIVE_SKILL_IDS);
const enemyRuntimeActiveSkillSet = new Set<string>(ENEMY_RUNTIME_ACTIVE_SKILL_IDS);
const SCOPE_PRIORITY: IresSkillBandAuditScope[] = [
    'shared_active',
    'player_default',
    'enemy_runtime',
    'loadout_capability',
    'off_roster_action',
    'companion_runtime',
    'spawned_runtime',
    'system_passive'
];

const resolveScope = (skillId: string, bandProfile: SkillMetabolicBandProfile | undefined): IresSkillBandAuditScope => {
    const scopeTags = bandProfile?.scopeTags || [];
    const resolvedScope = SCOPE_PRIORITY.find((scope) => scopeTags.includes(scope));
    if (resolvedScope) {
        return resolvedScope;
    }

    if (playerDefaultActiveSkillSet.has(skillId) && enemyRuntimeActiveSkillSet.has(skillId)) {
        return 'shared_active';
    }
    if (playerDefaultActiveSkillSet.has(skillId)) {
        return 'player_default';
    }
    if (enemyRuntimeActiveSkillSet.has(skillId)) {
        return 'enemy_runtime';
    }
    return 'system_passive';
};

const round2 = (value: number): number => Number(value.toFixed(2));

const resolveRiskLevel = (
    row: Pick<IresSkillBandAuditRow, 'skillId' | 'deltaPrimaryCost' | 'deltaBaseStrain' | 'deltaCountsAsMovement' | 'deltaCountsAsAction'>
): IresSkillBandAuditRiskLevel => {
    const maxDelta = Math.max(Math.abs(row.deltaPrimaryCost), Math.abs(row.deltaBaseStrain));
    const flagsChanged = row.deltaCountsAsMovement !== 0 || row.deltaCountsAsAction !== 0;
    if ((row.skillId === 'SENTINEL_BLAST' && maxDelta > 0) || maxDelta > 10) {
        return 'high';
    }
    if (maxDelta > 5 || flagsChanged) {
        return 'medium';
    }
    return 'low';
};

const resolveAcceptedRisk = (
    row: Pick<IresSkillBandAuditRow, 'skillId' | 'riskLevel'>
): boolean => row.riskLevel === 'medium' && ACCEPTED_MEDIUM_RISK_SKILLS.has(row.skillId);

const buildNotes = (
    skillId: string,
    scope: IresSkillBandAuditScope,
    bandProfile: SkillMetabolicBandProfile | undefined,
    legacyProfile: SkillResourceProfile,
    derivedProfile: SkillResourceProfile,
    deltaIntrinsicPowerScore: number,
    riskLevel: IresSkillBandAuditRiskLevel,
    acceptedRisk: boolean
): string => {
    const notes: string[] = [];
    if (bandProfile) {
        notes.push(`Band-derived from ${bandProfile.bandId}.`);
    }
    if (bandProfile?.resourceMode === 'none' && !derivedProfile.countsAsMovement && !derivedProfile.countsAsAction) {
        notes.push('Metabolically inert in runtime: no spark, mana, or BFI tax.');
    }
    if (scope === 'loadout_capability' && ['BURROW', 'FLIGHT', 'PHASE_STEP'].includes(skillId)) {
        notes.push('Passive movement capability only; modifies BASIC_MOVE pathing without becoming an active movement cost.');
    }
    if (scope === 'companion_runtime' && skillId === 'FALCON_AUTO_ROOST') {
        notes.push('Consumes the falcon turn internally but remains zero-cost and strain-free.');
    }
    if (scope === 'spawned_runtime' && skillId === 'TIME_BOMB') {
        notes.push('Fuse resolution may consume the bomb turn but remains metabolically free.');
    }
    if (skillId === 'FALCON_SCOUT') {
        notes.push('Metabolically corrected to movement semantics to match scouting displacement.');
    }
    if (derivedProfile.countsAsMovement !== legacyProfile.countsAsMovement || derivedProfile.countsAsAction !== legacyProfile.countsAsAction) {
        notes.push('Movement/action semantics changed relative to the legacy bucket.');
    }
    if ((bandProfile?.travelEligible === false) && derivedProfile.countsAsMovement && !derivedProfile.countsAsAction) {
        notes.push('Special movement stays out of travel relief.');
    }
    if (skillId === 'SENTINEL_BLAST') {
        notes.push('Boss spike remains intentionally above heavy-band pressure while staying castable inside the sentinel\'s current runtime mana pool.');
    }
    if (skillId === 'BASIC_MOVE') {
        notes.push('Ordinary locomotion is intentionally anchored to the maintenance band instead of the legacy move bucket.');
    }
    if (skillId === 'GRAPPLE_HOOK') {
        notes.push('Hybrid movement plus action semantics are intentional and retained even though the legacy bucket treated it as pure movement.');
    }
    if (Math.abs(deltaIntrinsicPowerScore) >= 3) {
        notes.push(`Intrinsic power shifted by ${round2(deltaIntrinsicPowerScore)} after profile derivation.`);
    }
    if (riskLevel === 'high') {
        notes.push('Tune via offsets before reconsidering the underlying band.');
    }
    if (acceptedRisk) {
        notes.push('Accepted medium-risk migration for this phase.');
    }
    return notes.join(' ');
};

const TUNING_QUEUE = [
    'BASIC_MOVE',
    'DASH',
    'JUMP',
    'GRAPPLE_HOOK',
    'VAULT',
    'WITHDRAWAL',
    'FIREWALK',
    'SHADOW_STEP',
    'SOUL_SWAP',
    'BASIC_ATTACK',
    'AUTO_ATTACK',
    'ARCHER_SHOT',
    'SPEAR_THROW',
    'SHIELD_BASH',
    'SHIELD_THROW',
    'ABSORB_FIRE',
    'FALCON_COMMAND',
    'KINETIC_TRI_TRAP',
    'SMOKE_SCREEN',
    'BOMB_TOSS',
    'SENTINEL_TELEGRAPH',
    'FIREBALL',
    'FIREWALL',
    'CORPSE_EXPLOSION',
    'RAISE_DEAD',
    'SNEAK_ATTACK',
    'SENTINEL_BLAST',
    'BULWARK_CHARGE',
    'SWIFT_ROLL',
    'MULTI_SHOOT',
    'SET_TRAP',
    'FALCON_PECK',
    'FALCON_APEX_STRIKE',
    'FALCON_HEAL',
    'FALCON_SCOUT'
];

export const buildIresSkillBandAuditReport = (): IresSkillBandAuditReport => {
    const mappedSkillIds = listBandMappedSkillIds();
    const expandedMappedSkillIds = listExpandedBandMappedSkillIds();
    const mappedActiveRosterSkillIds = listMappedActiveRosterSkillIds();
    const legacyFallbackSkillIds = listLegacyFallbackSkillIds();
    const rows = Object.keys(COMPOSITIONAL_SKILLS)
        .sort((left, right) => left.localeCompare(right))
        .map((skillId) => {
            const skillDef = SkillRegistry.get(skillId);
            if (!skillDef) {
                throw new Error(`Missing skill definition for "${skillId}" while building IRES skill-band audit.`);
            }
            const bandProfile = resolveSkillMetabolicBandProfile(skillId);
            const legacyProfile = resolveLegacySkillResourceProfile(skillId);
            const derivedProfile = resolveSkillResourceProfile(skillId);
            const legacyPowerProfile = computeSkillPowerProfileWithResourceProfile(skillId, legacyProfile);
            const derivedPowerProfile = computeSkillPowerProfileWithResourceProfile(skillId, derivedProfile);
            const scope = resolveScope(skillId, bandProfile);
            const row: IresSkillBandAuditRow = {
                skillId,
                slot: skillDef.slot,
                scope,
                profileSource: derivedProfile.profileSource || 'legacy',
                metabolicBandId: bandProfile?.bandId,
                resourceMode: bandProfile?.resourceMode,
                countsAsMovement: derivedProfile.countsAsMovement,
                countsAsAction: derivedProfile.countsAsAction,
                travelEligible: effectiveTravelEligible(derivedProfile),
                legacyProfile,
                derivedProfile,
                deltaPrimaryCost: derivedProfile.primaryCost - legacyProfile.primaryCost,
                deltaBaseStrain: derivedProfile.baseStrain - legacyProfile.baseStrain,
                deltaCountsAsMovement: Number(derivedProfile.countsAsMovement) - Number(legacyProfile.countsAsMovement),
                deltaCountsAsAction: Number(derivedProfile.countsAsAction) - Number(legacyProfile.countsAsAction),
                legacyIntrinsicPowerScore: legacyPowerProfile.intrinsicPowerScore,
                derivedIntrinsicPowerScore: derivedPowerProfile.intrinsicPowerScore,
                deltaIntrinsicPowerScore: round2(derivedPowerProfile.intrinsicPowerScore - legacyPowerProfile.intrinsicPowerScore),
                riskLevel: 'low',
                acceptedRisk: false,
                notes: ''
            };
            row.riskLevel = resolveRiskLevel(row);
            row.acceptedRisk = resolveAcceptedRisk(row);
            row.notes = buildNotes(
                skillId,
                scope,
                bandProfile,
                legacyProfile,
                derivedProfile,
                row.deltaIntrinsicPowerScore,
                row.riskLevel,
                row.acceptedRisk
            );
            return row;
        });

    const highestRiskSkillIds = rows
        .filter((row) => row.riskLevel === 'high')
        .map((row) => row.skillId)
        .sort((left, right) => left.localeCompare(right));
    const acceptedRiskSkillIds = rows
        .filter((row) => row.acceptedRisk)
        .map((row) => row.skillId)
        .sort((left, right) => left.localeCompare(right));

    return {
        generatedAt: new Date().toISOString(),
        mappedSkillIds,
        expandedMappedSkillIds,
        mappedActiveRosterSkillIds,
        legacyFallbackSkillIds,
        playerDefaultSkillIds: [...PLAYER_DEFAULT_ACTIVE_SKILL_IDS],
        enemyRuntimeSkillIds: [...ENEMY_RUNTIME_ACTIVE_SKILL_IDS],
        rows,
        highestRiskSkillIds,
        acceptedRiskSkillIds,
        recommendedTuningQueue: TUNING_QUEUE
    };
};
