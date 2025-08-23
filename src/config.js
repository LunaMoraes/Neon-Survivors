// Game Configuration and Constants (module copy)
const GAME_CONFIG = {
    PLAYER: { SIZE: 20, SPEED: 220, HEALTH: 100, INVULNERABILITY_TIME: 800 },
    WEAPONS: {
        BASIC: { name: 'Neon Blaster', damage: 12, speed: 900, cooldown: 600, color: '#00ff88', size: 4, unlockLevel: 1 },
        SPREAD: { name: 'Plasma Spread', damage: 8, speed: 700, cooldown: 400, color: '#ff0088', size: 3, count: 3, unlockLevel: 3 },
        LASER: { name: 'Cyber Laser', damage: 20, speed: 1600, cooldown: 900, color: '#0088ff', size: 5, unlockLevel: 5 }
    },
    ENEMY_TYPES: {
        DRONE: { size: 18, speed: 70, health: 30, damage: 10, color: '#ff4444', exp: 2, armor: 0 },
        HUNTER: { size: 14, speed: 120, health: 20, damage: 15, color: '#ff8800', exp: 3, armor: 0 },
        TANK: { size: 28, speed: 40, health: 120, damage: 25, color: '#8800ff', exp: 6, armor: 0.15 },
        ASSASSIN: { size: 12, speed: 180, health: 18, damage: 18, color: '#00ffaa', exp: 4, armor: 0 },
        BRUTE: { size: 34, speed: 38, health: 220, damage: 32, color: '#aa44ff', exp: 10, armor: 0.3 }
    },
    GAME: { MAX_PARTICLES: 600, PROJECTILE_LIFE: 2000, EXP_ORB_LIFE: 8000, LOOT_BOX_LIFE: 12000, LOOT_BOX_CHANCE: 0.18, EXP_ATTRACTION_RANGE: 120, EXP_BASE_SPEED: 240 },
    SPAWN: { BASE_SPAWN_RATE: 0.6, DIFFICULTY_SCALE: 0.4, MAX_SPAWNS_PER_FRAME: 5, SPAWN_ACCUMULATOR_THRESHOLD: 800, TYPE_SPEED_CAPS: { HUNTER: 2.2, ASSASSIN: 2.0 }, MAX_ENEMY_DIFFICULTY: 2.0 },
    PROGRESSION: { POINT_THRESHOLDS: [50, 150], MAX_POINTS_PER_MATCH: 3 },
    VISUAL: { PARTICLE_LIFE: { min: 40, max: 70 }, PARTICLE_SIZE: { min: 1, max: 5 }, PARTICLE_SPEED: 240, KNOCKBACK: 40 }
};

window.GAME_CONFIG = GAME_CONFIG;
export default GAME_CONFIG;
