// Game Configuration and Constants
const CONFIG = {
    // Player settings
    PLAYER: {
        SIZE: 20,
        SPEED: 220,
        HEALTH: 100,
        INVULNERABILITY_TIME: 800
    },
    
    // Weapon settings - Better balanced progression
    WEAPONS: {
        BASIC: {
            name: 'Neon Blaster',
            damage: 12, // Reduced from 15 for better progression
            speed: 900,
            cooldown: 600, // Slower fire rate to make upgrades meaningful
            color: '#00ff88',
            size: 4,
            unlockLevel: 1
        },
        SPREAD: {
            name: 'Plasma Spread',
            damage: 8, // Reduced per projectile
            speed: 700,
            cooldown: 400, // Faster than basic but less per projectile
            color: '#ff0088',
            size: 3,
            count: 3,
            unlockLevel: 3
        },
        LASER: {
            name: 'Cyber Laser',
            damage: 20, // Reduced from 25
            speed: 1600,
            cooldown: 900, // Slower fire rate for high damage
            color: '#0088ff',
            size: 5,
            unlockLevel: 5
        }
    },
    
    // Enemy types
    ENEMY_TYPES: {
        DRONE: {
            size: 18,
            speed: 70,
            health: 30,
            damage: 10,
            color: '#ff4444',
            exp: 2
        },
        HUNTER: {
            size: 14,
            speed: 120,
            health: 20,
            damage: 15,
            color: '#ff8800',
            exp: 3
        },
        TANK: {
            size: 28,
            speed: 40,
            health: 120,
            damage: 25,
            color: '#8800ff',
            exp: 6
        }
    },
    
    // Game settings
    GAME: {
        MAX_PARTICLES: 600,
        PROJECTILE_LIFE: 2000,
        EXP_ORB_LIFE: 8000,
        LOOT_BOX_LIFE: 12000,
        LOOT_BOX_CHANCE: 0.18,
        EXP_ATTRACTION_RANGE: 120,
        EXP_BASE_SPEED: 240
    },
    
    // Spawn settings
    SPAWN: {
        BASE_SPAWN_RATE: 0.6,
        DIFFICULTY_SCALE: 0.4,
        MAX_SPAWNS_PER_FRAME: 5,
    SPAWN_ACCUMULATOR_THRESHOLD: 800,
    // Cap how strong per-enemy difficulty multipliers can get (prevents extreme speeds/damage)
    MAX_ENEMY_DIFFICULTY: 2.0
    },
    
    // Visual settings
    VISUAL: {
        PARTICLE_LIFE: { min: 40, max: 70 },
        PARTICLE_SIZE: { min: 1, max: 5 },
        PARTICLE_SPEED: 240,
        KNOCKBACK: 40
    }
};

// Make config globally available
window.GAME_CONFIG = CONFIG;