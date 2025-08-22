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
            exp: 2,
            armor: 0
        },
        HUNTER: {
            size: 14,
            speed: 120,
            health: 20,
            damage: 15,
            color: '#ff8800',
            exp: 3,
            armor: 0
        },
        TANK: {
            size: 28,
            speed: 40,
            health: 120,
            damage: 25,
            color: '#8800ff',
            exp: 6,
            armor: 0.15
        }
        ,
        ASSASSIN: {
            size: 12,
            speed: 180,
            health: 18,
            damage: 18,
            color: '#00ffaa',
            exp: 4,
            armor: 0
        },
        BRUTE: {
            size: 34,
            speed: 38,
            health: 220,
            damage: 32,
            color: '#aa44ff',
            exp: 10,
            armor: 0.3
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
        // Per-type speed caps (multiplier) to avoid impossible-to-hit enemies
        TYPE_SPEED_CAPS: {
            HUNTER: 2.2,
            ASSASSIN: 2.0
        },
        // (legacy) max enemy difficulty placeholder (not used by spawn now)
        MAX_ENEMY_DIFFICULTY: 2.0
    },

    // Progression / perks
    PROGRESSION: {
        // sessionExp thresholds for awarding 1/2/3 perk points
        POINT_THRESHOLDS: [50, 150], // <50 =>1, 50-149 =>2, >=150 =>3
        MAX_POINTS_PER_MATCH: 3
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