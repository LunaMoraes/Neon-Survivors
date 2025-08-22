// Weapon system
class WeaponSystem {
    constructor() {
        this.weapons = {
            basic: { ...GAME_CONFIG.WEAPONS.BASIC, lastShot: 0 },
            spread: { ...GAME_CONFIG.WEAPONS.SPREAD, lastShot: 0 },
            laser: { ...GAME_CONFIG.WEAPONS.LASER, lastShot: 0 }
        };
        this.activeWeapons = ['basic'];
        this.unlockedWeapons = new Set(['basic']);
        this.criticalChance = 0;
    }
    
    update(delta, player, enemies, projectiles) {
        const now = performance.now();
        
        this.activeWeapons.forEach(weaponName => {
            const weapon = this.weapons[weaponName];
            if (now - weapon.lastShot >= weapon.cooldown) {
                weapon.lastShot = now;
                this.fireWeapon(weapon, weaponName, player, enemies, projectiles);
            }
        });
    }
    
    fireWeapon(weapon, weaponName, player, enemies, projectiles) {
        if (enemies.length === 0) return;
        
        // Find nearest enemy
        let nearestEnemy = enemies[0];
        let nearestDistance = Math.hypot(player.x - nearestEnemy.x, player.y - nearestEnemy.y);
        
        enemies.forEach(enemy => {
            const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = enemy;
            }
        });
        
        const angle = Math.atan2(nearestEnemy.y - player.y, nearestEnemy.x - player.x);
        
        if (weaponName === 'spread') {
            // Fire multiple projectiles
            for (let i = 0; i < weapon.count; i++) {
                const spreadAngle = angle + (i - 1) * 0.3;
                this.createProjectile(player.x, player.y, spreadAngle, weapon, projectiles);
            }
        } else {
            this.createProjectile(player.x, player.y, angle, weapon, projectiles);
        }
    }
    
    createProjectile(x, y, angle, weapon, projectiles) {
        // Calculate damage with critical chance
        let damage = weapon.damage;
        let isCritical = false;
        
        if (this.criticalChance > 0 && Math.random() < this.criticalChance) {
            damage *= 2;
            isCritical = true;
        }
        
        const projectile = poolManager.createProjectile({
            x: x,
            y: y,
            dx: Math.cos(angle) * weapon.speed,
            dy: Math.sin(angle) * weapon.speed,
            damage: damage,
            color: isCritical ? '#ffffff' : weapon.color, // White for critical hits
            size: isCritical ? weapon.size * 1.5 : weapon.size,
            life: GAME_CONFIG.GAME.PROJECTILE_LIFE,
            isCritical: isCritical
        });
        
        projectiles.push(projectile);
        playSfx('shoot');
        
        // Visual effect for critical hits
        if (isCritical) {
            // This would be handled by a particle system
        }
        
        return projectile;
    }
    
    unlockWeapon(weaponName) {
        if (!this.activeWeapons.includes(weaponName)) {
            this.activeWeapons.push(weaponName);
            return true;
        }
        return false;
    }
    
    upgradeDamage(percent) {
        Object.values(this.weapons).forEach(weapon => {
            weapon.damage = Math.floor(weapon.damage * (1 + percent));
        });
    }
    
    upgradeFireRate(percent) {
        Object.values(this.weapons).forEach(weapon => {
            weapon.cooldown = Math.floor(weapon.cooldown * (1 - percent));
        });
    }
    
    getWeapon(weaponName) {
        return this.weapons[weaponName];
    }
}

// Make WeaponSystem globally available
window.WeaponSystem = WeaponSystem;