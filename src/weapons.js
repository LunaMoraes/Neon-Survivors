import poolManager from './pool.js';
import GAME_CONFIG from './config.js';

export class WeaponSystem {
    constructor() {
        const cfg = (window.GAME_CONFIG || GAME_CONFIG);
        this.weapons = {
            basic: { ...cfg.WEAPONS.BASIC, lastShot: 0 },
            spread: { ...cfg.WEAPONS.SPREAD, lastShot: 0 },
            laser: { ...cfg.WEAPONS.LASER, lastShot: 0 }
        };
        Object.values(this.weapons).forEach(w => { w._baseDamage = w.damage; w._damageMultiplier = 0; });
        this.activeWeapons = ['basic']; this.unlockedWeapons = new Set(['basic']); this.criticalChance = 0;
    }
    update(delta, player, enemies, projectiles) {
        const now = performance.now();
        this.activeWeapons.forEach(weaponName => {
            const weapon = this.weapons[weaponName];
            if (now - weapon.lastShot >= weapon.cooldown) { weapon.lastShot = now; this.fireWeapon(weapon, weaponName, player, enemies, projectiles); }
        });
    }
    fireWeapon(weapon, weaponName, player, enemies, projectiles) {
        if (enemies.length === 0) return;
        let nearestEnemy = enemies[0]; let nearestDistance = Math.hypot(player.x - nearestEnemy.x, player.y - nearestEnemy.y);
        enemies.forEach(enemy => { const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y); if (distance < nearestDistance) { nearestDistance = distance; nearestEnemy = enemy; } });
        const angle = Math.atan2(nearestEnemy.y - player.y, nearestEnemy.x - player.x);
        if (weaponName === 'spread') { for (let i = 0; i < weapon.count; i++) { const spreadAngle = angle + (i - 1) * 0.3; this.createProjectile(player.x, player.y, spreadAngle, weapon, projectiles); } } else { this.createProjectile(player.x, player.y, angle, weapon, projectiles); }
    }
    createProjectile(x, y, angle, weapon, projectiles) {
        let base = weapon._baseDamage || weapon.damage || 1; let mult = weapon._damageMultiplier || 0; let damage = Math.round(base * (1 + mult)); let isCritical = false; if (this.criticalChance > 0 && Math.random() < this.criticalChance) { damage *= 2; isCritical = true; }
    const cfg = (window.GAME_CONFIG || GAME_CONFIG);
    const projectile = poolManager.createProjectile({ x, y, dx: Math.cos(angle) * weapon.speed, dy: Math.sin(angle) * weapon.speed, damage, color: isCritical ? '#ffffff' : weapon.color, size: isCritical ? weapon.size * 1.5 : weapon.size, life: cfg.GAME.PROJECTILE_LIFE, isCritical });
        projectiles.push(projectile); playSfx('shoot'); return projectile;
    }
    unlockWeapon(name) { if (!this.activeWeapons.includes(name)) { this.activeWeapons.push(name); return true; } return false; }
    upgradeDamage(percent) { Object.values(this.weapons).forEach(weapon => { const prev = weapon._damageMultiplier || 0; const compounded = (1 + prev) * (1 + percent) - 1; weapon._damageMultiplier = compounded; }); }
    upgradeFireRate(percent) { Object.values(this.weapons).forEach(weapon => { weapon.cooldown = Math.floor(weapon.cooldown * (1 - percent)); }); }
    getWeapon(name) { return this.weapons[name]; }
}

// Non-destructive global fallback for legacy code
if (typeof window !== 'undefined') {
    window.WeaponSystem = window.WeaponSystem || WeaponSystem;
}
export default WeaponSystem;
