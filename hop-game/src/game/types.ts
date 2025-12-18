export interface Point {
    q: number;
    r: number;
    s: number;
}

export interface Entity {
    id: string;
    type: 'player' | 'enemy';
    subtype?: 'footman' | 'archer' | 'bomber';
    position: Point;
    hp: number;
    maxHp: number;
    energy?: number; // For player special moves
    intent?: string; // Description of next move
}

export interface GameState {
    turn: number;
    player: Entity;
    enemies: Entity[];
    gridRadius: number;
    gameStatus: 'playing' | 'won' | 'lost';
    message: string;
}

export type Action =
    | { type: 'MOVE'; payload: Point }
    | { type: 'ATTACK'; payload: string } // entity id
    | { type: 'WAIT' }
    | { type: 'RESET' };
