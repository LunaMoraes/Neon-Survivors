// Object Pooling System for Neon Survivors
class ObjectPool {
    constructor(createFn, resetFn, initialSize = 20) {
        this.create = createFn;
        this.reset = resetFn;
        this.pool = [];
        this.active = new Set();
        
        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.create());
        }
    }
    
    acquire() {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            obj = this.create();
        }
        this.reset(obj);
        this.active.add(obj);
        return obj;
    }
    
    release(obj) {
        if (this.active.has(obj)) {
            this.active.delete(obj);
            this.pool.push(obj);
        }
    }
    
    releaseAll() {
        for (const obj of this.active) {
            this.pool.push(obj);
        }
        this.active.clear();
    }
    
    getActiveCount() {
        return this.active.size;
    }
    
    getPoolSize() {
        return this.pool.length;
    }
}

// Factory functions for different object types
const poolFactories = {
    enemy: () => ({
        x: 0, y: 0, type: '', size: 0, speed: 0, 
        health: 0, damage: 0, color: '', exp: 0, maxHealth: 0
    }),
    
    projectile: () => ({
        x: 0, y: 0, dx: 0, dy: 0, damage: 0, 
        color: '', size: 0, life: 0, isCritical: false
    }),
    
    particle: () => ({
        x: 0, y: 0, dx: 0, dy: 0, color: '', 
        life: 0, maxLife: 0, size: 0
    }),
    
    expOrb: () => ({
        x: 0, y: 0, value: 0, life: 0
    }),
    
    lootBox: () => ({
        x: 0, y: 0, life: 0, opened: false
    })
};

// Reset functions
const poolResetters = {
    enemy: (obj, data) => {
        Object.assign(obj, data);
    },
    
    projectile: (obj, data) => {
        Object.assign(obj, data);
    },
    
    particle: (obj, data) => {
        Object.assign(obj, data);
    },
    
    expOrb: (obj, data) => {
        Object.assign(obj, data);
    },
    
    lootBox: (obj, data) => {
        Object.assign(obj, data);
    }
};

// Global pools
const pools = {
    enemy: new ObjectPool(poolFactories.enemy, poolResetters.enemy, 50),
    projectile: new ObjectPool(poolFactories.projectile, poolResetters.projectile, 100),
    particle: new ObjectPool(poolFactories.particle, poolResetters.particle, 200),
    expOrb: new ObjectPool(poolFactories.expOrb, poolResetters.expOrb, 50),
    lootBox: new ObjectPool(poolFactories.lootBox, poolResetters.lootBox, 10)
};

// Utility functions for game code
window.poolManager = {
    createEnemy: (data) => {
        const enemy = pools.enemy.acquire();
        poolResetters.enemy(enemy, data);
        return enemy;
    },
    
    createProjectile: (data) => {
        const projectile = pools.projectile.acquire();
        poolResetters.projectile(projectile, data);
        return projectile;
    },
    
    createParticle: (data) => {
        const particle = pools.particle.acquire();
        poolResetters.particle(particle, data);
        return particle;
    },
    
    createExpOrb: (data) => {
        const orb = pools.expOrb.acquire();
        poolResetters.expOrb(orb, data);
        return orb;
    },
    
    createLootBox: (data) => {
        const box = pools.lootBox.acquire();
        poolResetters.lootBox(box, data);
        return box;
    },
    
    releaseEnemy: (enemy) => pools.enemy.release(enemy),
    releaseProjectile: (projectile) => pools.projectile.release(projectile),
    releaseParticle: (particle) => pools.particle.release(particle),
    releaseExpOrb: (orb) => pools.expOrb.release(orb),
    releaseLootBox: (box) => pools.lootBox.release(box),
    
    getStats: () => ({
        enemies: { active: pools.enemy.getActiveCount(), pool: pools.enemy.getPoolSize() },
        projectiles: { active: pools.projectile.getActiveCount(), pool: pools.projectile.getPoolSize() },
        particles: { active: pools.particle.getActiveCount(), pool: pools.particle.getPoolSize() },
        expOrbs: { active: pools.expOrb.getActiveCount(), pool: pools.expOrb.getPoolSize() },
        lootBoxes: { active: pools.lootBox.getActiveCount(), pool: pools.lootBox.getPoolSize() }
    })
};