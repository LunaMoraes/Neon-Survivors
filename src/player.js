// Player class (module copy)
export class Player {
    constructor(canvas) {
        this.x = canvas.width / 2; this.y = canvas.height / 2;
        this.size = window.GAME_CONFIG.PLAYER.SIZE;
        this.speed = window.GAME_CONFIG.PLAYER.SPEED;
        this.health = window.GAME_CONFIG.PLAYER.HEALTH; this.maxHealth = window.GAME_CONFIG.PLAYER.HEALTH;
        this.armor = 0; this.level = 1; this.exp = 0; this.expToNext = 10; this.color = '#00ff88'; this.invulnerable = false; this.invulnerabilityTime = 0; this.keys = {};
        this.expMagnet = false; this.healthRegen = 0;
        this.bindEvents();
    }
    bindEvents() { window.addEventListener('keydown', (e) => { this.keys[e.code] = true; }); window.addEventListener('keyup', (e) => { this.keys[e.code] = false; }); }
    update(delta, canvas) {
        if (this.invulnerable) { this.invulnerabilityTime -= delta; if (this.invulnerabilityTime <= 0) { this.invulnerable = false; } }
        if (this.healthRegen > 0) this.health = Math.min(this.maxHealth, this.health + this.healthRegen * (delta / 1000));
        let dx = 0, dy = 0; if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1; if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1; if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1; if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;
        const len = Math.hypot(dx, dy); if (len > 0) { dx /= len; dy /= len; }
        this.x += dx * this.speed * (delta / 1000); this.y += dy * this.speed * (delta / 1000);
        this.x = Math.max(this.size, Math.min(canvas.width - this.size, this.x)); this.y = Math.max(this.size, Math.min(canvas.height - this.size, this.y));
    }
    takeDamage(damage) { if (this.invulnerable) return false; const effective = Math.max(0, Math.round(damage * (1 - (this.armor || 0)))); this.health -= effective; this.invulnerable = true; this.invulnerabilityTime = window.GAME_CONFIG.PLAYER.INVULNERABILITY_TIME; return this.health <= 0; }
    addExp(amount) { this.exp += amount; return this.exp >= this.expToNext; }
    levelUp() { this.level++; this.exp -= this.expToNext; this.expToNext = Math.floor(this.expToNext * 1.2); return true; }
    heal(amount) { this.health = Math.min(this.maxHealth, this.health + amount); }
    increaseMaxHealth(amount) { this.maxHealth += amount; this.health += amount; }
    increaseSpeed(amount) { this.speed += amount; }
    getHealthPercent() { return (this.health / this.maxHealth) * 100; }
}

window.PlayerClass = Player;
export default Player;
