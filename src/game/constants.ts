export const GRID_RADIUS = 3; // Radius of 3 creates a decent sized arena
export const TILE_SIZE = 40; // Pixel size for rendering

export const INITIAL_PLAYER_STATS = {
    hp: 3,
    maxHp: 3,
    energy: 100,
};

export const ENEMY_STATS = {
    footman: { hp: 2, maxHp: 2, range: 1, damage: 1 },
    archer: { hp: 1, maxHp: 1, range: 3, damage: 1 },
};
