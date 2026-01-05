export interface Point {
    q: number;
    r: number;
    s: number;
}

// (Actor model introduced below; `Entity` is now an alias to `Actor`)

// Skill slot types
export type SkillSlot = 'offensive' | 'defensive' | 'utility';

/** Atomic Effects: Discrete engine instructions */
export type AtomicEffect =
    | { type: 'Displacement'; target: 'self' | 'targetActor'; destination: Point; source?: Point }
    | { type: 'Damage'; target: 'targetActor' | 'area' | Point; amount: number }
    | { type: 'ApplyStatus'; target: 'targetActor'; status: 'stunned' | 'poisoned'; duration: number }
    | { type: 'SpawnItem'; itemType: 'bomb' | 'spear' | 'shield'; position: Point }
    | { type: 'Message'; text: string }
    | { type: 'Juice'; effect: 'shake' | 'flash' | 'lavaSink' | 'spearTrail'; target?: Point; path?: Point[] }
    | { type: 'ModifyCooldown'; skillId: string; amount: number; setExact?: boolean };

export interface SkillModifier {
    id: string;
    name: string;
    description: string;
    modifyRange?: number;
    modifyCooldown?: number;
    extraEffects?: AtomicEffect[];
}

export interface ScenarioV2 {
    id: string;              // Unique ID (e.g., "bash_into_lava")
    title: string;           // Tutorial Title
    description: string;     // Tutorial Instructions
    setup: (engine: any) => void; // Functional setup (mutates state/engine)
    run: (engine: any) => void;   // The specific action to take
    verify: (state: GameState, logs: string[]) => boolean; // The behavioral assertion
}

export interface SkillDefinition {
    id: string;
    name: string;
    description: string;
    slot: SkillSlot;
    icon: string;
    baseVariables: {
        range: number;
        cost: number;
        cooldown: number;
    };
    /** Core Logic: Functional execution returning a list of effects */
    execute: (state: GameState, attacker: Actor, target?: Point, activeUpgrades?: string[]) => {
        effects: AtomicEffect[];
        messages: string[];
        consumesTurn?: boolean;
    };
    upgrades: Record<string, SkillModifier>;
    scenarios: ScenarioV2[];
}

// Skill with cooldown tracking and upgrade system
export interface Skill {
    id: string;
    name: string;
    description: string;
    slot: SkillSlot;
    cooldown: number;           // Max cooldown in turns
    currentCooldown: number;    // Turns remaining (0 = ready)
    range: number;              // Skill range
    upgrades: string[];         // Available upgrades for this skill
    activeUpgrades: string[];   // Upgrades the player has acquired
    energyCost?: number;
    pushDistance?: number;      // For Shield Bash
}

// New Actor model: shared between player and enemies, extensible with gear and skills.
export interface Actor {
    id: string;
    type: 'player' | 'enemy';
    subtype?: string;
    position: Point;
    hp: number;
    maxHp: number;
    energy?: number;
    intent?: string;
    intentPosition?: Point;

    // Movement and combat modifiers
    movementSpeed?: number;   // Hexes per turn (default 1)
    facing?: number;          // Direction 0-5 for Shield Bearer
    isVisible?: boolean;      // For visibility mechanics
    actionCooldown?: number;  // For slow enemies

    // New mechanics from design doc
    temporaryArmor?: number;  // Shield passive: +1 armor that resets each turn
    isStunned?: boolean;      // From Wall Slam or Stunning Landing
    previousPosition?: Point; // Track for Punch passive (hit enemies that started and ended adjacent)
    enemyType?: 'melee' | 'ranged'; // Visual: melee=diamond, ranged=triangle

    // Equipment slots (optional, can be extended later)
    gear?: {
        weapon?: string;
        head?: string;
        body?: string;
        [key: string]: string | undefined;
    };

    // Skills or abilities the actor can use (old string array for upgrades)
    skills?: string[];

    // New skill system with cooldowns (3 slots: offensive, defensive, utility)
    activeSkills?: Skill[];
}

// Backwards-compatible alias: existing code that expects `Entity` keeps working.
export type Entity = Actor;

// Room for procedural dungeon generation
export interface Room {
    id: string;
    type: 'entrance' | 'combat' | 'treasure' | 'corridor' | 'boss' | 'secret';
    center: Point;
    hexes: Point[];          // All hexes belonging to this room
    connections: string[];   // IDs of connected rooms
}

// Floor themes
export type FloorTheme = 'catacombs' | 'inferno' | 'throne' | 'frozen' | 'void';

export interface GameState {
    turn: number;
    player: Entity;
    enemies: Entity[];
    gridWidth: number;
    gridHeight: number;
    gameStatus: 'playing' | 'won' | 'lost' | 'choosing_upgrade';
    message: string[];
    hasSpear: boolean;
    spearPosition?: Point;
    stairsPosition: Point;
    lavaPositions: Point[];
    wallPositions: Point[];      // Wall tiles that block movement
    shrinePosition?: Point;

    // Shield Mechanics
    hasShield: boolean;
    shieldPosition?: Point;

    floor: number;
    upgrades: string[];

    // Procedural generation
    rooms?: Room[];          // Generated dungeon rooms
    theme?: FloorTheme;      // Visual/gameplay theme

    // New deterministic / replay fields:
    rngSeed?: string;            // seed used for initial generation
    actionLog?: Action[];        // recorded player actions for replay
    initialSeed?: string;        // original run seed (stays constant across floors)
    rngCounter?: number;         // number of deterministic random draws consumed so far
    // Completed run snapshot for post-run actions (leaderboard submission, export)
    completedRun?: {
        seed?: string;
        actionLog?: Action[];
        score?: number;
        floor?: number;
    };

    // Score tracking
    kills: number;
    environmentalKills: number;

    // Juice & Animations
    dyingEntities?: Entity[];    // Entities currently playing death animation
    lastSpearPath?: Point[];    // For spear trail animation
    isShaking?: boolean;        // Trigger screen shake
    occupiedCurrentTurn?: Point[]; // Internal: track occupied tiles to prevent stacking
}

export type Action =
    | { type: 'MOVE'; payload: Point }
    | { type: 'LEAP'; payload: Point }       // Legacy name, now JUMP
    | { type: 'JUMP'; payload: Point }       // New: Jump skill
    | { type: 'ATTACK'; payload: string }
    | { type: 'WAIT' }
    | { type: 'RESET' }
    | { type: 'THROW_SPEAR'; payload: Point }
    | { type: 'SHIELD_BASH'; payload: Point } // New: Shield Bash skill
    | { type: 'SELECT_UPGRADE'; payload: string }
    | { type: 'USE_SKILL'; payload: { skillId: string; target?: Point } }
    | { type: 'LOAD_STATE'; payload: GameState };

export interface Scenario {
    id: string;
    metadata: {
        title: string;
        text: string;
    };
    grid: {
        w: number;
        h: number;
    };
    state: {
        player: {
            pos: Point;
            skills: string[];
            hp?: number;
            maxHp?: number;
        };
        enemies: Array<{
            id: string;
            type: string;
            pos: Point;
            hp?: number;
        }>;
        lava: Point[];
        walls?: Point[];
    };
    assertions: {
        onAction: Action | { type: 'SKILL'; id: string; target: Point };
        expect: {
            enemies?: string[]; // IDs of expected remaining enemies
            playerPos?: Point;
            messages?: string[];
            gameStatus?: string;
        };
    };
}
