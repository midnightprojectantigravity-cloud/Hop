export interface Point {
    q: number;
    r: number;
    s: number;
}

// (Actor model introduced below; `Entity` is now an alias to `Actor`)

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
    // Equipment slots (optional, can be extended later)
    gear?: {
        weapon?: string;
        head?: string;
        body?: string;
        [key: string]: string | undefined;
    };
    // Skills or abilities the actor can use
    skills?: string[];
}

// Backwards-compatible alias: existing code that expects `Entity` keeps working.
export type Entity = Actor;

export interface GameState {
    turn: number;
    player: Entity;
    enemies: Entity[];
    gridRadius: number;
    gameStatus: 'playing' | 'won' | 'lost' | 'choosing_upgrade';
    message: string;
    hasSpear: boolean;
    spearPosition?: Point;
    stairsPosition: Point;
    lavaPositions: Point[];
    shrinePosition?: Point;
    floor: number;
    upgrades: string[];

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
}

export type Action =
    | { type: 'MOVE'; payload: Point }
    | { type: 'LEAP'; payload: Point }
    | { type: 'ATTACK'; payload: string }
    | { type: 'WAIT' }
    | { type: 'RESET' }
    | { type: 'THROW_SPEAR'; payload: Point }
    | { type: 'SELECT_UPGRADE'; payload: string }
    | { type: 'LOAD_STATE'; payload: GameState };
