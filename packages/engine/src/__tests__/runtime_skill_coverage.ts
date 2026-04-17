export type RuntimeSkillCoverageTag =
    | 'parity-covered'
    | 'scenario-covered'
    | 'vm-covered'
    | 'cross-system-covered';

export interface RuntimeSkillCoverageCase {
    skillId: string;
    tags: RuntimeSkillCoverageTag[];
    notes: string;
}

export const RUNTIME_SKILL_COVERAGE: RuntimeSkillCoverageCase[] = [
    {
        skillId: 'ABSORB_FIRE',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus absorb_fire and relics scenarios.'
    },
    {
        skillId: 'AUTO_ATTACK',
        tags: ['parity-covered', 'scenario-covered', 'cross-system-covered'],
        notes: 'Parity plus dedicated auto_attack scenarios and passive turn-loop coverage.'
    },
    {
        skillId: 'ARCHER_SHOT',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus dedicated archer_shot scenarios.'
    },
    {
        skillId: 'BASIC_ATTACK',
        tags: ['parity-covered', 'scenario-covered', 'cross-system-covered'],
        notes: 'Parity plus basic_attack scenarios and preview/combat integration coverage.'
    },
    {
        skillId: 'BASIC_AWARENESS',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus information reveal and loadout hydration coverage.'
    },
    {
        skillId: 'BASIC_MOVE',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus movement, hazards, and objectives scenarios.'
    },
    {
        skillId: 'BOMB_TOSS',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus bomber scenario coverage.'
    },
    {
        skillId: 'CORPSE_EXPLOSION',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus corpse_explosion scenarios.'
    },
    {
        skillId: 'DEATH_TOUCH',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus trinity integration and entity-factory coverage.'
    },
    {
        skillId: 'BLIND_FIGHTING',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus unseen-penalty movement overlay coverage.'
    },
    {
        skillId: 'BURROW',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus tunneling movement overlay coverage.'
    },
    {
        skillId: 'COMBAT_ANALYSIS',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus trinity-stat reveal and awareness coverage.'
    },
    {
        skillId: 'DASH',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus dash momentum, shunt, and collision scenario coverage.'
    },
    {
        skillId: 'FALCON_APEX_STRIKE',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus falcon command and companion-turn coverage.'
    },
    {
        skillId: 'FALCON_AUTO_ROOST',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus falcon companion-state coverage.'
    },
    {
        skillId: 'FALCON_COMMAND',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus dedicated falcon command scenarios.'
    },
    {
        skillId: 'FALCON_HEAL',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus falcon turn-resolution coverage.'
    },
    {
        skillId: 'FALCON_PECK',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus falcon companion command and behavior coverage.'
    },
    {
        skillId: 'FALCON_SCOUT',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus falcon companion command and orbit coverage.'
    },
    {
        skillId: 'ENEMY_AWARENESS',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus enemy detection and AI visibility coverage.'
    },
    {
        skillId: 'FIREBALL',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus fireball scenario coverage.'
    },
    {
        skillId: 'FIREWALK',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus firewalk scenario coverage.'
    },
    {
        skillId: 'FLIGHT',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus movement-policy and loadout coverage.'
    },
    {
        skillId: 'FIREWALL',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus firewall geometry and wall-filter scenarios.'
    },
    {
        skillId: 'JUMP',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus jump and stunning-landing scenarios.'
    },
    {
        skillId: 'KINETIC_TRI_TRAP',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus kinetic tri-trap scenario coverage.'
    },
    {
        skillId: 'METEOR_IMPACT',
        tags: ['parity-covered', 'scenario-covered', 'vm-covered'],
        notes: 'Parity, dedicated scenario pack, and VM substrate coverage.'
    },
    {
        skillId: 'MULTI_SHOOT',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus dedicated multi_shoot scenario coverage.'
    },
    {
        skillId: 'RAISE_DEAD',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus necromancer summon and ally-push scenarios.'
    },
    {
        skillId: 'ORACLE_SIGHT',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus top-action utility reveal coverage.'
    },
    {
        skillId: 'PHASE_STEP',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus movement-policy and teleport coverage.'
    },
    {
        skillId: 'SENTINEL_BLAST',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus sentinel blast and telegraph projection scenarios.'
    },
    {
        skillId: 'SENTINEL_TELEGRAPH',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus telegraph projection scenarios.'
    },
    {
        skillId: 'SET_TRAP',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus set_trap placement and invalid-target scenarios.'
    },
    {
        skillId: 'SHADOW_STEP',
        tags: ['parity-covered'],
        notes: 'Parity plus movement, stealth, and shadow-step validation coverage.'
    },
    {
        skillId: 'STANDARD_VISION',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus fog/LoS and loadout coverage.'
    },
    {
        skillId: 'TACTICAL_INSIGHT',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus intent reveal coverage.'
    },
    {
        skillId: 'SHIELD_THROW',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus shield_throw and integration chain-reaction scenarios.'
    },
    {
        skillId: 'SHIELD_BASH',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus shield_bash push and collision scenarios.'
    },
    {
        skillId: 'SPEAR_THROW',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus spear_throw scenarios and vanguard replay artifacts.'
    },
    {
        skillId: 'SMOKE_SCREEN',
        tags: ['parity-covered'],
        notes: 'Parity plus stealth, blind-smoke, and status overlay coverage.'
    },
    {
        skillId: 'SNEAK_ATTACK',
        tags: ['parity-covered'],
        notes: 'Parity plus stealth-damage branch coverage.'
    },
    {
        skillId: 'SOUL_SWAP',
        tags: ['parity-covered'],
        notes: 'Parity plus soul swap swap-behavior coverage.'
    },
    {
        skillId: 'THEME_HAZARDS',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus hazard and loadout pipeline coverage.'
    },
    {
        skillId: 'TIME_BOMB',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus bomber and time_bomb scenario coverage.'
    },
    {
        skillId: 'VIBRATION_SENSE',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus motion detection and fog/LoS coverage.'
    },
    {
        skillId: 'TORNADO_KICK',
        tags: ['parity-covered', 'scenario-covered', 'vm-covered'],
        notes: 'Parity, dedicated scenario pack, and VM substrate coverage.'
    },
    {
        skillId: 'VOLATILE_PAYLOAD',
        tags: ['parity-covered', 'cross-system-covered'],
        notes: 'Parity plus bomber_time_bomb and spawn-chain coverage.'
    },
    {
        skillId: 'SWIFT_ROLL',
        tags: ['parity-covered'],
        notes: 'Parity plus movement policy and teleport utility coverage.'
    },
    {
        skillId: 'VAULT',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus vault parity-shift and landing scenarios.'
    },
    {
        skillId: 'WITHDRAWAL',
        tags: ['parity-covered', 'scenario-covered'],
        notes: 'Parity plus withdrawal shot and backroll scenarios.'
    }
] ;

export const RUNTIME_SKILL_COVERAGE_BY_ID = new Map(
    RUNTIME_SKILL_COVERAGE.map(entry => [entry.skillId, entry] as const)
);
