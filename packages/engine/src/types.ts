import type { GameComponent } from './systems/components';
import type { SkillID, StatusID, ArchetypeID, JuiceEffectID } from './types/registry';
import type { JuiceSignaturePayloadV1 } from './types/juice-signature';
import type { CombatScoreEvent } from './systems/combat-calculator';

/**
 * ARCHITECTURE OVERVIEW: "Gold Standard" Tech Stack
 * Logic: Immutable State + Command Pattern (see Command, StateDelta)
 * Validation: TDD for Scenarios + Fuzzing for stability
 * Performance: Spatial Hashing/Bitmasks for the AI (see GameState.occupancyMask)
 * Meta: Strategic Hub with serialized JSON Loadouts
 * 
 * ECS-Lite: The Actor model stores data and components, Logic is handled by pure Systems.
 */
export interface Point {
    q: number;
    r: number;
    s: number;
}

export type WeightClass = 'Light' | 'Standard' | 'Heavy' | 'Anchored' | 'OuterWall';

// (Actor model introduced below; `Entity` is now an alias to `Actor`)

// Skill slot types
export type SkillSlot = 'offensive' | 'defensive' | 'utility' | 'passive';

export interface MovementTrace {
    actorId: string;
    origin: Point;      // Start Hex
    path: Point[];      // Every hex touched during the slide/fling
    destination: Point; // Final landing hex
    movementType?: 'slide' | 'teleport';
    durationMs?: number;
    startDelayMs?: number;
    interruptedBy?: 'WALL' | 'ACTOR' | 'BOUNDARY' | 'LAVA';
    wasLethal: boolean;
}

/** Status Effects: Buffs/Debuffs with logic hooks */
export interface StatusEffect {
    id: string;
    type: StatusID;

    duration: number; // -1 for permanent
    stacks?: number;

    // The "When" logic
    tickWindow: 'START_OF_TURN' | 'END_OF_TURN';

    // The "What" logic - Interceptor hooks
    onIncomingDamage?: (damage: number) => number;
    onTick?: (actor: Actor, state: GameState) => AtomicEffect[];
}

/** Effect Middleware: Intercepts and modifies AtomicEffects before resolution */
export type EffectInterceptor = (effect: AtomicEffect, state: GameState, context: { targetId?: string; sourceId?: string }) => AtomicEffect | null;

// Command Pattern: For Replays, Undo, and Determinism
export interface Command {
    id: string;
    timestamp: number;
    action: Action;
    // For Undo: store the delta produced by this command
    delta?: StateDelta;
}

export interface StateDelta {
    id: string;
    undoData: any; // Opaque data for revert_delta system
}

/** Initiative Entry: Represents an actor's position in the turn order */
export interface InitiativeEntry {
    actorId: string;
    initiative: number;
    hasActed: boolean;
    /** Position at the START of this actor's individual turn */
    turnStartPosition?: Point;
    /** Actor IDs that were neighbors at the START of this actor's turn */
    turnStartNeighborIds?: string[];
}

/** Initiative Queue: Manages per-actor turn order within a round */
export interface InitiativeQueue {
    /** Sorted list of actors waiting to act this round */
    entries: InitiativeEntry[];
    /** Index of the currently acting actor (-1 if between rounds) */
    currentIndex: number;
    /** Current round number (increments when all actors have acted) */
    round: number;
}

/** Atomic Effects: Discrete engine instructions */
export type AtomicEffect =
    | {
        type: 'Displacement';
        target: 'self' | 'targetActor' | string;
        destination: Point;
        source?: Point;
        isFling?: boolean;
        stunDuration?: number;
        path?: Point[];  // Optional: Full path for smooth tile-by-tile animation
        animationDuration?: number;  // Optional: Suggested duration in ms (e.g., 150ms per tile)
        ignoreCollision?: boolean;
        simulatePath?: boolean;
        ignoreGroundHazards?: boolean;
    }
    | { type: 'Damage'; target: 'targetActor' | 'area' | Point | string; amount: number; reason?: string; source?: Point; scoreEvent?: CombatScoreEvent }
    | { type: 'Heal'; target: 'targetActor' | string; amount: number }
    | { type: 'ApplyStatus'; target: 'targetActor' | Point | string; status: StatusID; duration: number }
    | { type: 'SpawnItem'; itemType: 'bomb' | 'spear' | 'shield'; position: Point }
    | { type: 'PickupShield'; position?: Point }
    | { type: 'PickupSpear'; position?: Point }
    | { type: 'GrantSkill'; skillId: SkillID }
    | { type: 'LavaSink'; target: string }
    | { type: 'Impact'; target: string; damage: number; direction?: Point }
    | { type: 'Message'; text: string }
    | {
        type: 'Juice';
        effect: JuiceEffectID;
        target?: Point | string;
        path?: Point[];
        intensity?: 'low' | 'medium' | 'high' | 'extreme';
        direction?: Point;
        text?: string;
        duration?: number; // For sustained effects like cable tension
        color?: string; // Hex color for themed effects
        metadata?: Record<string, any>; // Extensible payload for frontend
    }
    | { type: 'ModifyCooldown'; skillId: SkillID; amount: number; setExact?: boolean }
    | { type: 'UpdateComponent'; target: 'self' | 'targetActor'; key: string; value: GameComponent }
    | { type: 'SpawnCorpse'; position: Point }
    | { type: 'RemoveCorpse'; position: Point }
    | { type: 'SpawnActor', actor: Actor }
    | { type: 'PlaceFire'; position: Point; duration: number }
    | { type: 'PlaceTrap'; position: Point; ownerId: string; volatileCore?: boolean; chainReaction?: boolean; resetCooldown?: number }
    | { type: 'RemoveTrap'; position: Point; ownerId?: string }
    | { type: 'SetTrapCooldown'; position: Point; cooldown: number; ownerId?: string }
    | { type: 'SetStealth'; target: 'self' | 'targetActor' | string; amount: number }
    | {
        type: 'UpdateCompanionState';
        target: string;
        mode?: 'scout' | 'predator' | 'roost';
        markTarget?: string | Point; // ID (Predator) or Point (Scout)
        orbitStep?: number;
        apexStrikeCooldown?: number;
        healCooldown?: number;
    }
    | { type: 'GameOver'; reason: 'PLAYER_DIED' | 'OUT_OF_TIME' };

export interface VisualEvent {
    type: 'shake' | 'freeze' | 'combat_text' | 'vfx' | 'kinetic_trace' | 'juice_signature';
    payload: any | JuiceSignaturePayloadV1;
}

export type SimulationEventType =
    | 'UnitMoved'
    | 'DamageTaken'
    | 'Healed'
    | 'StatusApplied'
    | 'MessageLogged';

export interface SimulationEvent {
    id: string;
    turn: number;
    type: SimulationEventType;
    actorId?: string;
    targetId?: string;
    position?: Point;
    payload?: Record<string, any>;
}

export type TimelinePhase =
    | 'INTENT_START'
    | 'MOVE_START'
    | 'MOVE_END'
    | 'ON_PASS'
    | 'ON_ENTER'
    | 'HAZARD_CHECK'
    | 'STATUS_APPLY'
    | 'DAMAGE_APPLY'
    | 'DEATH_RESOLVE'
    | 'INTENT_END';

export interface TimelineEvent {
    id: string;
    turn: number;
    actorId?: string;
    stepId?: string;
    phase: TimelinePhase;
    type: string;
    payload?: any;
    blocking: boolean;
    groupId?: string;
    dependsOn?: string[];
    suggestedDurationMs?: number;
}

export interface StackResolutionTick {
    tick: number;
    effectType: string;
    depthBefore: number;
    depthAfter: number;
    reactionsQueued: number;
}

export interface TelegraphProjectionEntry {
    actorId: string;
    skillId: string;
    targetHex?: Point;
    dangerTiles: Point[];
}

export interface IntentPreview {
    sourceTurn: number;
    dangerTiles: Point[];
    projections: TelegraphProjectionEntry[];
}

export interface RunObjective {
    id: 'TURN_LIMIT' | 'HAZARD_CONSTRAINT';
    label: string;
    target: number;
}

export interface ObjectiveResult {
    id: 'TURN_LIMIT' | 'HAZARD_CONSTRAINT';
    label: string;
    target: number;
    value: number;
    success: boolean;
}

export type PendingFrameType =
    | 'STAIRS_TRANSITION'
    | 'SHRINE_CHOICE'
    | 'RUN_WON'
    | 'RUN_LOST';

export interface PendingFrame {
    id: string;
    type: PendingFrameType;
    status: 'playing' | 'choosing_upgrade' | 'won' | 'lost';
    createdTurn: number;
    blocking: boolean;
    payload?: Record<string, any>;
}

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
    rationale?: string;      // RATIONALE block for Narrative TDD
    setup: (engine: any) => void; // Functional setup (mutates state/engine)
    run: (engine: any) => void;   // The specific action to take
    verify: (state: GameState, logs: string[], events?: import('./types').VisualEvent[]) => boolean; // The behavioral assertion
}

export type SkillIntentTag =
    | 'damage'
    | 'move'
    | 'heal'
    | 'protect'
    | 'control'
    | 'summon'
    | 'hazard'
    | 'objective'
    | 'economy'
    | 'utility';

export interface SkillIntentProfile {
    id: SkillID;
    intentTags: SkillIntentTag[];
    target: {
        range: number;
        pattern: 'self' | 'single' | 'line' | 'radius' | 'global';
        aoeRadius?: number;
    };
    estimates: {
        damage?: number;
        movement?: number;
        healing?: number;
        shielding?: number;
        control?: number;
        summon?: number;
    };
    economy: {
        cost: number;
        cooldown: number;
        consumesTurn?: boolean;
    };
    risk: {
        selfExposure?: number;
        hazardAffinity?: number;
        noProgressCastPenalty?: number;
        requireEnemyContact?: boolean;
        noContactPenalty?: number;
    };
    complexity: number;
}

export interface SkillDefinition {
    id: SkillID;
    /** Tactical name (supports State-Shifting skills) */
    name: string | ((state: GameState) => string);
    /** Tactical description (supports State-Shifting skills) */
    description: string | ((state: GameState) => string);
    slot: SkillSlot;
    icon: string;
    baseVariables: {
        range: number;
        cost: number;
        cooldown: number;
        damage?: number;
        momentum?: number;
    };
    /** Core Logic: Functional execution returning a list of effects */
    execute: (state: GameState, attacker: Actor, target?: Point, activeUpgrades?: string[], context?: Record<string, any>) => {
        effects: AtomicEffect[];
        messages: string[];
        consumesTurn?: boolean;
        kills?: number;
    };
    /** Optional helper for UI/tests: return valid target hexes for previews (Level 1/2) */
    getValidTargets?: (state: GameState, origin: Point) => Point[];
    intentProfile?: SkillIntentProfile;
    upgrades: Record<string, SkillModifier>;
    scenarios?: ScenarioV2[];
}

// Skill with cooldown tracking and upgrade system
export interface Skill {
    id: SkillID;
    /** Tactical name (supports State-Shifting skills) */
    name: string | ((state: GameState) => string);
    /** Tactical description (supports State-Shifting skills) */
    description: string | ((state: GameState) => string);
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

    // Movement and combat variables
    movementSpeed?: number;
    speed: number;           // Determines initiative / turn frequency
    factionId: string;       // 'player' or 'enemy' for friendly fire logic
    facing?: number;
    isVisible?: boolean;
    actionCooldown?: number;

    // Logic state
    previousPosition?: Point;
    enemyType?: 'melee' | 'ranged' | 'boss';

    // Initiative system
    initiative?: number; // Custom initiative score (overrides default)

    // Status system
    statusEffects: StatusEffect[];
    temporaryArmor: number;

    // ECS-Lite: Components can be stored here as optional records
    components?: Map<string, GameComponent>;

    // Skills
    activeSkills: Skill[];

    // Weight class for hook/bash logic
    weightClass?: WeightClass;

    // Archetype for passive/core logic
    archetype?: ArchetypeID;

    // Stealth system
    stealthCounter?: number;

    // Companion system (Falcon)
    companionOf?: string;      // Owner's actor ID (for Falcon)
    isFlying?: boolean;        // Ignores traps, ground hazards
    companionState?: {
        mode: 'scout' | 'predator' | 'roost';
        markTarget?: Point | string;  // Tile position or Actor ID
        orbitStep?: number;           // Scout rotation counter (0-5)
        revivalCooldown?: number;     // Tethered Spirit countdown
        apexStrikeCooldown?: number;  // Tracking for design alignment
        healCooldown?: number;
    };
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
    turnNumber: number;
    player: Entity;
    enemies: Entity[];
    companions?: Entity[];
    gridWidth: number;
    gridHeight: number;
    gameStatus: 'hub' | 'playing' | 'won' | 'lost' | 'choosing_upgrade';
    message: string[];
    hasSpear: boolean;
    spearPosition?: Point;
    stairsPosition: Point;

    /** The World-Class Data-Driven Tile Grid */
    tiles: Map<string, import('./systems/tile-types').Tile>;


    // Spatial Hashing / Bitmasks (Goal 3)
    occupancyMask: bigint[];

    shrinePosition?: Point;
    shrineOptions?: string[];

    hasShield: boolean;
    shieldPosition?: Point;

    floor: number;
    upgrades: string[];

    // Procedural generation
    rooms?: Room[];
    theme?: FloorTheme;

    // Command & Replay (Goal 2)
    commandLog: Command[];
    undoStack: StateDelta[];

    // Initiative Queue (Per-Actor Turn Management)
    initiativeQueue?: InitiativeQueue;

    rngSeed?: string;
    actionLog?: Action[];
    initialSeed?: string;
    rngCounter?: number;
    completedRun?: {
        seed?: string;
        actionLog?: Action[];
        score?: number;
        floor?: number;
        objectives?: ObjectiveResult[];
        combatTelemetry?: {
            events: number;
            avgEfficiency: number;
            riskBonusEvents: number;
        };
    };
    dailyRunDate?: string;
    runObjectives?: RunObjective[];
    hazardBreaches?: number;

    // Selected loadout id from the Hub (not persisted to a run unless START_RUN is called)
    selectedLoadoutId?: string;

    // Score
    kills: number;
    environmentalKills: number;

    // Juice
    dyingEntities?: Entity[];
    lastSpearPath?: Point[];
    isShaking?: boolean;
    occupiedCurrentTurn?: Point[];
    visualEvents: VisualEvent[];
    simulationEvents?: SimulationEvent[];
    timelineEvents?: TimelineEvent[];
    stackTrace?: StackResolutionTick[];
    combatScoreEvents?: CombatScoreEvent[];
    intentPreview?: IntentPreview;
    turnsSpent: number;
    pendingStatus?: {
        status: 'hub' | 'playing' | 'won' | 'lost' | 'choosing_upgrade';
        shrineOptions?: string[];
        completedRun?: any;
    };
    pendingFrames?: PendingFrame[];

    // Kinetic Tri-Trap system
    traps?: Array<{
        position: Point;
        ownerId: string;
        isRevealed: boolean;
        cooldown: number;  // Individual trap reset CD
        volatileCore?: boolean;
        chainReaction?: boolean;
        resetCooldown?: number;
    }>;
}

export type Action =
    | { type: 'MOVE'; payload: Point }
    | { type: 'LEAP'; payload: Point }       // Legacy name, now JUMP
    | { type: 'JUMP'; payload: Point }       // New: Jump skill
    | { type: 'ATTACK'; payload: string }
    | { type: 'WAIT' }
    | { type: 'RESET'; payload?: { seed: string } }
    | { type: 'THROW_SPEAR'; payload: Point }
    | { type: 'SHIELD_BASH'; payload: Point } // New: Shield Bash skill
    | { type: 'SELECT_UPGRADE'; payload: string }
    | { type: 'USE_SKILL'; payload: { skillId: string; target?: Point } }
    | { type: 'ADVANCE_TURN' }
    | { type: 'LOAD_STATE'; payload: GameState }
    | { type: 'START_RUN'; payload: { loadoutId: string; seed?: string; mode?: 'normal' | 'daily'; date?: string } }
    | { type: 'APPLY_LOADOUT'; payload: any }
    | { type: 'EXIT_TO_HUB' }
    | { type: 'RESOLVE_PENDING' };

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
            upgrades?: string[];
            hp?: number;
            maxHp?: number;
        };
        enemies: Array<{
            id: string;
            type: string;
            pos: Point;
            hp?: number;
            isStunned?: boolean;
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
