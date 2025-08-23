class ObjectPool {
    constructor(createFn, resetFn, initialSize = 20) { this.create = createFn; this.reset = resetFn; this.pool = []; this.active = new Set(); for (let i = 0; i < initialSize; i++) this.pool.push(this.create()); }
    acquire() { let obj; if (this.pool.length > 0) obj = this.pool.pop(); else obj = this.create(); this.reset(obj); this.active.add(obj); return obj; }
    release(obj) { if (this.active.has(obj)) { this.active.delete(obj); this.pool.push(obj); } }
    releaseAll() { for (const obj of this.active) this.pool.push(obj); this.active.clear(); }
    getActiveCount() { return this.active.size; }
    getPoolSize() { return this.pool.length; }
}

const poolFactories = {
    enemy: () => ({ x:0,y:0,type:'',size:0,speed:0,health:0,damage:0,color:'',exp:0,maxHealth:0 }),
    projectile: () => ({ x:0,y:0,dx:0,dy:0,damage:0,color:'',size:0,life:0,isCritical:false }),
    particle: () => ({ x:0,y:0,dx:0,dy:0,color:'',life:0,maxLife:0,size:0 }),
    expOrb: () => ({ x:0,y:0,value:0,life:0 }),
    lootBox: () => ({ x:0,y:0,life:0,opened:false })
};

const poolResetters = {
    enemy: (obj, data) => Object.assign(obj, data), projectile: (obj, data) => Object.assign(obj, data), particle: (obj,data) => Object.assign(obj, data), expOrb: (obj,data) => Object.assign(obj,data), lootBox: (obj,data) => Object.assign(obj,data)
};

const pools = { enemy: new ObjectPool(poolFactories.enemy, poolResetters.enemy, 50), projectile: new ObjectPool(poolFactories.projectile, poolResetters.projectile, 100), particle: new ObjectPool(poolFactories.particle, poolResetters.particle, 200), expOrb: new ObjectPool(poolFactories.expOrb, poolResetters.expOrb, 50), lootBox: new ObjectPool(poolFactories.lootBox, poolResetters.lootBox, 10) };

const poolManager = {
    createEnemy: (data) => { const e = pools.enemy.acquire(); poolResetters.enemy(e, data); return e; },
    createProjectile: (data) => { const p = pools.projectile.acquire(); poolResetters.projectile(p, data); return p; },
    createParticle: (data) => { const p = pools.particle.acquire(); poolResetters.particle(p, data); return p; },
    createExpOrb: (data) => { const o = pools.expOrb.acquire(); poolResetters.expOrb(o, data); return o; },
    createLootBox: (data) => { const l = pools.lootBox.acquire(); poolResetters.lootBox(l, data); return l; },
    releaseEnemy: (e)=>pools.enemy.release(e), releaseProjectile: (p)=>pools.projectile.release(p), releaseParticle: (p)=>pools.particle.release(p), releaseExpOrb: (o)=>pools.expOrb.release(o), releaseLootBox: (l)=>pools.lootBox.release(l),
    getStats: () => ({ enemies:{active:pools.enemy.getActiveCount(), pool:pools.enemy.getPoolSize()}, projectiles:{active:pools.projectile.getActiveCount(), pool:pools.projectile.getPoolSize()}, particles:{active:pools.particle.getActiveCount(), pool:pools.particle.getPoolSize()}, expOrbs:{active:pools.expOrb.getActiveCount(), pool:pools.expOrb.getPoolSize()}, lootBoxes:{active:pools.lootBox.getActiveCount(), pool:pools.lootBox.getPoolSize()} })
};

// Provide backwards-compatible global but prefer module import
if (typeof window !== 'undefined') {
    window.poolManager = window.poolManager || poolManager;
}

export default poolManager;
export { poolManager };
