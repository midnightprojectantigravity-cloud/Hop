import type { Entity, Point } from '../types';
import { createHex, pointToKey } from '../hex';
import { getEnemyCatalogEntry, getEnemyCatalogSkillLoadout, getFloorSpawnProfile } from '../data/enemies';
import { ensureTacticalDataBootstrapped } from '../systems/tactical-data-bootstrap';
import { getBaseUnitDefinitionBySubtype } from '../systems/entities/base-unit-registry';
import { instantiateActorFromDefinitionWithCursor, type PropensityRngCursor } from '../systems/entities/propensity-instantiation';
import { createEnemy, getEnemySkillLoadout } from '../systems/entities/entity-factory';
import { createRng, stableIdFromSeed } from '../systems/rng';

const countSpawnTags = (subtypes: string[]) => subtypes.reduce((acc, subtype) => {
    const entry = getEnemyCatalogEntry(subtype as any);
    if (!entry) return acc;
    if (entry.contract.balanceTags.includes('frontline')) acc.frontline += 1;
    if (entry.contract.balanceTags.includes('flanker')) acc.flanker += 1;
    if (entry.contract.balanceTags.includes('support')) acc.support += 1;
    if (entry.contract.combatRole === 'hazard_setter') acc.hazardSetter += 1;
    if (entry.contract.combatRole === 'boss_anchor') acc.bossAnchor += 1;
    if (entry.bestiary.stats.type === 'ranged' || entry.bestiary.stats.type === 'boss') acc.ranged += 1;
    return acc;
}, {
    frontline: 0,
    ranged: 0,
    hazardSetter: 0,
    flanker: 0,
    support: 0,
    bossAnchor: 0
});

const spawnProfileAllowsSubtype = (
    profile: ReturnType<typeof getFloorSpawnProfile>,
    selectedSubtypes: string[],
    candidateSubtype: string
): boolean => {
    const nextCounts = countSpawnTags([...selectedSubtypes, candidateSubtype]);
    const { composition } = profile;
    return nextCounts.frontline <= composition.frontlineMax
        && nextCounts.ranged <= composition.rangedMax
        && nextCounts.hazardSetter <= composition.hazardSetterMax
        && nextCounts.flanker <= composition.flankerMax
        && nextCounts.support <= composition.supportMax
        && nextCounts.bossAnchor <= composition.bossAnchorMax;
};

const chooseWeightedSubtype = (
    subtypeIds: string[],
    floorRole: ReturnType<typeof getFloorSpawnProfile>['role'],
    rng: ReturnType<typeof createRng>
): string | undefined => {
    const weighted = subtypeIds.map(subtype => ({
        subtype,
        weight: Math.max(1, getEnemyCatalogEntry(subtype)?.contract.spawnProfile.spawnRoleWeights[floorRole] ?? 1)
    }));
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) return weighted[0]?.subtype;
    let roll = rng.next() * total;
    for (const entry of weighted) {
        roll -= entry.weight;
        if (roll <= 0) return entry.subtype;
    }
    return weighted[weighted.length - 1]?.subtype;
};

const generateFloorEnemiesInternal = (
    floor: number,
    spawnPositions: Point[],
    seed: string,
    forcedSeeds: Array<Point & { subtype: string }> = []
): Entity[] => {
    ensureTacticalDataBootstrapped();
    const rng = createRng(`${seed}:enemies`);
    const spawnProfile = getFloorSpawnProfile(floor);
    let remainingBudget = spawnProfile.budget;
    let propensityCursor: PropensityRngCursor = {
        rngSeed: `${seed}:enemy-propensity`,
        rngCounter: 0
    };
    const usedKeys = new Set<string>();
    const enemies: Entity[] = [];
    const selectedSubtypes: string[] = [];

    const instantiateSeed = (subtype: string, position: Point): Entity | undefined => {
        const catalogEntry = getEnemyCatalogEntry(subtype as any);
        if (!catalogEntry) return undefined;
        const stats = catalogEntry.bestiary.stats;
        const enemySeedCounter = (propensityCursor.rngCounter << 8) + enemies.length;
        const enemyId = `enemy_${enemies.length}_${stableIdFromSeed(seed, enemySeedCounter, 6, subtype)}`;
        const unitDef = getBaseUnitDefinitionBySubtype(subtype as any);
        let enemy: Entity;

        if (unitDef) {
            const instantiated = instantiateActorFromDefinitionWithCursor(propensityCursor, unitDef, {
                actorId: enemyId,
                position,
                subtype,
                factionId: 'enemy'
            });
            propensityCursor = instantiated.nextCursor;
            enemy = instantiated.actor;
        } else {
            enemy = createEnemy({
                id: enemyId,
                subtype,
                position,
                speed: stats.speed || 1,
                skills: getEnemyCatalogSkillLoadout(subtype as any, { source: 'runtime', includePassive: true }).length > 0
                    ? getEnemyCatalogSkillLoadout(subtype as any, { source: 'runtime', includePassive: true })
                    : getEnemySkillLoadout(subtype as any),
                weightClass: stats.weightClass || 'Standard',
                armorBurdenTier: catalogEntry.contract.metabolicProfile.armorBurdenTier,
                enemyType: stats.type as 'melee' | 'ranged'
            });
        }

        return {
            ...enemy,
            subtype,
            enemyType: stats.type as 'melee' | 'ranged' | 'boss',
            actionCooldown: stats.actionCooldown ?? enemy.actionCooldown,
            isVisible: true
        };
    };

    for (const forced of forcedSeeds.sort((a, b) => pointToKey(a).localeCompare(pointToKey(b)))) {
        const entry = getEnemyCatalogEntry(forced.subtype as any);
        if (!entry || remainingBudget < entry.bestiary.stats.cost) continue;
        const key = pointToKey(forced);
        if (usedKeys.has(key)) continue;
        const enemy = instantiateSeed(forced.subtype, createHex(forced.q, forced.r));
        if (!enemy) continue;
        usedKeys.add(key);
        enemies.push(enemy);
        selectedSubtypes.push(forced.subtype);
        remainingBudget -= entry.bestiary.stats.cost;
    }

    while (remainingBudget > 0 && usedKeys.size < spawnPositions.length) {
        const affordableTypes = spawnProfile.allowedSubtypes.filter((subtype) => {
            const entry = getEnemyCatalogEntry(subtype);
            return !!entry
                && entry.bestiary.stats.cost <= remainingBudget
                && spawnProfileAllowsSubtype(spawnProfile, selectedSubtypes, subtype);
        });
        if (affordableTypes.length === 0) break;
        const currentCounts = countSpawnTags(selectedSubtypes);
        const frontlineCandidates = affordableTypes.filter(subtype =>
            getEnemyCatalogEntry(subtype)?.contract.balanceTags.includes('frontline')
        );
        const candidatePool = currentCounts.frontline < spawnProfile.composition.frontlineMin && frontlineCandidates.length > 0
            ? frontlineCandidates
            : affordableTypes;
        const enemyType = chooseWeightedSubtype(candidatePool, spawnProfile.role, rng);
        if (!enemyType) break;
        const entry = getEnemyCatalogEntry(enemyType);
        if (!entry) break;
        const availablePositions = spawnPositions.filter(position => !usedKeys.has(pointToKey(position)));
        if (availablePositions.length === 0) break;
        const position = availablePositions[Math.floor(rng.next() * availablePositions.length)];
        const enemy = instantiateSeed(enemyType, position);
        if (!enemy) break;
        usedKeys.add(pointToKey(position));
        enemies.push(enemy);
        selectedSubtypes.push(enemyType);
        remainingBudget -= entry.bestiary.stats.cost;
    }

    return enemies;
};

export const generateFloorEnemies = (
    floor: number,
    spawnPositions: Point[],
    seed: string,
    forcedSeeds: Array<Point & { subtype: string }> = []
): Entity[] => generateFloorEnemiesInternal(floor, spawnPositions, seed, forcedSeeds);
