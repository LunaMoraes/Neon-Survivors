// Game State
const gameState = {
    running: false,
    paused: false,
    muted: false,
    startTime: 0,
    lastTime: 0,
    elapsed: 0,
    spawnAccumulator: 0,
    lowGraphics: false,
};

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
// Reticle element
const reticle = document.createElement('div');
reticle.className = 'reticle';
document.body.appendChild(reticle);

let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    reticle.style.left = `${e.clientX}px`;
    reticle.style.top = `${e.clientY}px`;
});

canvas.addEventListener('click', () => {
    // Try to resume audio context on first interaction (non-blocking)
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    // Avoid requesting pointer lock automatically to prevent platform issues
});

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game objects
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 20,
    speed: 220, // pixels per second
    health: 100,
    maxHealth: 100,
    level: 1,
    exp: 0,
    expToNext: 10,
    color: '#00ff88',
    invulnerable: false,
    invulnerabilityTime: 0
};

const enemies = [];
const projectiles = [];
const particles = [];
const expOrbs = [];
const lootBoxes = [];

// Weapon system
const weapons = {
    basic: {
        name: 'Neon Blaster',
        damage: 15,
        speed: 900, // pixels/sec
        cooldown: 500,
        lastShot: 0,
        color: '#00ff88',
        size: 4
    },
    spread: {
        name: 'Plasma Spread',
        damage: 10,
        speed: 700,
        cooldown: 300,
        lastShot: 0,
        color: '#ff0088',
        size: 3,
        count: 3
    },
    laser: {
        name: 'Cyber Laser',
        damage: 25,
        speed: 1600,
        cooldown: 800,
        lastShot: 0,
        color: '#0088ff',
        size: 5
    }
};

let activeWeapons = ['basic'];

// Enemy types
const enemyTypes = {
    drone: {
        size: 18,
        speed: 70,
        health: 30,
        damage: 10,
        color: '#ff4444',
        exp: 2
    },
    hunter: {
        size: 14,
        speed: 120,
        health: 20,
        damage: 15,
        color: '#ff8800',
        exp: 3
    },
    tank: {
        size: 28,
        speed: 40,
        health: 120,
        damage: 25,
        color: '#8800ff',
        exp: 6
    }
};

// Input handling
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    // quick keys
    if (e.code === 'Space') {
        // force level up (debug)
        // levelUp();
    }
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Game functions
function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    gameState.running = true;
    gameState.startTime = performance.now();
    gameState.lastTime = performance.now();
    resizeCanvas();
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    // reset
    enemies.length = 0;
    projectiles.length = 0;
    particles.length = 0;
    expOrbs.length = 0;
    player.health = player.maxHealth;
    player.level = 1;
    player.exp = 0;
    player.expToNext = 10;

    // initial small wave so players see action immediately
    spawnEnemy(1);
    spawnEnemy(1.1);
    spawnEnemy(1.2);

    loadHighscore();
    gameLoop();
}

function updatePlayer(delta) {
    if (player.invulnerable) {
        player.invulnerabilityTime -= delta;
        if (player.invulnerabilityTime <= 0) {
            player.invulnerable = false;
        }
    }

    // Movement
    let dx = 0, dy = 0;
    if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

    // Normalize
    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; }

    player.x += dx * player.speed * (delta / 1000);
    player.y += dy * player.speed * (delta / 1000);

    // Keep player in bounds
    player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
    player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));
}

function spawnEnemy(difficultyFactor = 1) {
    const types = Object.keys(enemyTypes);
    // Make rarer spawns for stronger types
    const roll = Math.random();
    let type = 'drone';
    if (roll > 0.85) type = 'tank';
    else if (roll > 0.5) type = 'hunter';

    const enemyData = enemyTypes[type];

    // Spawn from random edge
    let x, y;
    const side = Math.floor(Math.random() * 4);
    switch(side) {
        case 0: x = Math.random() * canvas.width; y = -enemyData.size; break;
        case 1: x = canvas.width + enemyData.size; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + enemyData.size; break;
        case 3: x = -enemyData.size; y = Math.random() * canvas.height; break;
    }

    enemies.push({
        x: x,
        y: y,
        type: type,
        size: enemyData.size,
        speed: enemyData.speed * difficultyFactor,
        health: Math.floor(enemyData.health * difficultyFactor),
        damage: enemyData.damage,
        color: enemyData.color,
        exp: enemyData.exp,
        maxHealth: Math.floor(enemyData.health * difficultyFactor)
    });
}

function updateEnemies(delta) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        // Move towards player (speed in px/sec)
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.hypot(dx, dy);

        if (distance > 0) {
            enemy.x += (dx / distance) * enemy.speed * (delta / 1000);
            enemy.y += (dy / distance) * enemy.speed * (delta / 1000);
        }

        // Check collision with player
        const playerDistance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (playerDistance < player.size + enemy.size && !player.invulnerable) {
            player.health -= enemy.damage;
            player.invulnerable = true;
            player.invulnerabilityTime = 800;

            // Knockback
            const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            const kb = 40;
            player.x += Math.cos(angle) * kb;
            player.y += Math.sin(angle) * kb;

            createParticles(enemy.x, enemy.y, '#ff4444', 8);
            playSfx('hit');

            if (player.health <= 0) gameOver();
        }

        // Remove enemies offscreen by a margin
        if (enemy.x < -2000 || enemy.x > canvas.width + 2000 || enemy.y < -2000 || enemy.y > canvas.height + 2000) {
            enemies.splice(i, 1);
        }
    }
}

function updateWeapons(delta) {
    const now = performance.now();
    activeWeapons.forEach(weaponName => {
        const weapon = weapons[weaponName];
        if (now - weapon.lastShot >= weapon.cooldown) {
            weapon.lastShot = now;
            fireWeapon(weapon, weaponName);
        }
    });
}

function fireWeapon(weapon, weaponName) {
    if (enemies.length === 0) return;
    
    // Find nearest enemy
    let nearestEnemy = enemies[0];
    let nearestDistance = Math.sqrt(
        Math.pow(player.x - nearestEnemy.x, 2) + Math.pow(player.y - nearestEnemy.y, 2)
    );
    
    enemies.forEach(enemy => {
        const distance = Math.sqrt(
            Math.pow(player.x - enemy.x, 2) + Math.pow(player.y - enemy.y, 2)
        );
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
            createProjectile(player.x, player.y, spreadAngle, weapon);
        }
    } else {
        createProjectile(player.x, player.y, angle, weapon);
    }
}

function createProjectile(x, y, angle, weapon) {
    projectiles.push({
        x: x,
        y: y,
        dx: Math.cos(angle) * weapon.speed,
        dy: Math.sin(angle) * weapon.speed,
        damage: weapon.damage,
        color: weapon.color,
        size: weapon.size,
        life: 2000
    });
    playSfx('shoot');
}

function updateProjectiles(delta) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.x += projectile.dx * (delta / 1000);
        projectile.y += projectile.dy * (delta / 1000);
        projectile.life -= delta;

        // Check collision with enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const distance = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
            if (distance < projectile.size + enemy.size) {
                enemy.health -= projectile.damage;
                createParticles(enemy.x, enemy.y, projectile.color, 4);
                playSfx('hit');
                if (enemy.health <= 0) {
                    // XP orb lasts longer so player has time to pick it up
                    expOrbs.push({ x: enemy.x, y: enemy.y, value: enemy.exp, life: 8000 });
                    createParticles(enemy.x, enemy.y, '#ffff00', 12);
                    // Chance to drop lootbox
                    if (Math.random() < 0.18) {
                        lootBoxes.push({ x: enemy.x, y: enemy.y, life: 12000, opened: false });
                    }
                    enemies.splice(j, 1);
                }
                projectiles.splice(i, 1);
                break;
            }
        }

        if (projectile.life <= 0 || projectile.x < -500 || projectile.x > canvas.width + 500 || projectile.y < -500 || projectile.y > canvas.height + 500) {
            projectiles.splice(i, 1);
        }
    }
}

function updateExpOrbs(delta) {
    for (let i = expOrbs.length - 1; i >= 0; i--) {
        const orb = expOrbs[i];
        orb.life -= delta;
        const distance = Math.hypot(player.x - orb.x, player.y - orb.y);
        // attraction range scales with player speed to avoid falling behind
        const attractionRange = Math.max(120, player.speed * 0.6);
        if (distance < attractionRange) {
            const angle = Math.atan2(player.y - orb.y, player.x - orb.x);
            // base speed + bonus proportional to player speed
            const baseSpeed = 240;
            const speed = baseSpeed + (player.speed * 0.8);
            orb.x += Math.cos(angle) * speed * (delta / 1000);
            orb.y += Math.sin(angle) * speed * (delta / 1000);
            // pickup distance increased so fast players can scoop orbs
            if (distance < Math.max(22, player.size + 6)) {
                player.exp += orb.value;
                if (player.exp >= player.expToNext) levelUp();
                expOrbs.splice(i, 1);
                playSfx('pickup');
                continue;
            }
        }
        if (orb.life <= 0) expOrbs.splice(i, 1);
    }
}

// Loot interaction: press E near lootbox or click on it to open
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') {
        // find nearest loot near player
        let nearest = null; let nd = Infinity;
        lootBoxes.forEach((l, idx) => {
            const d = Math.hypot(player.x - l.x, player.y - l.y);
            if (d < 60 && !l.opened && d < nd) { nearest = { l, idx }; nd = d; }
        });
        if (nearest) {
            openLootBox(nearest.idx);
        }
    }
});

function openLootBox(index) {
    const box = lootBoxes[index];
    if (!box || box.opened) return;
    box.opened = true;
    // generate 3 loot choices
    const lootPool = [
        { name: 'Minor Health', effect: () => { player.health = Math.min(player.maxHealth, player.health + 30); } },
        { name: 'Exp Cache', effect: () => { player.exp += 5; if (player.exp >= player.expToNext) levelUp(); } },
        { name: 'Speed Chip', effect: () => { player.speed += 30; } },
        { name: 'Weapon Shard', effect: () => { Object.values(weapons).forEach(w=> w.damage = Math.floor(w.damage * 1.1)); } },
        { name: 'Max Health', effect: () => { player.maxHealth += 20; player.health += 20; } }
    ];

    const shuffled = lootPool.sort(() => 0.5 - Math.random()).slice(0,3);
    const modal = document.getElementById('lootModal');
    const options = document.getElementById('lootOptions');
    options.innerHTML = '';
    shuffled.forEach(item => {
        const div = document.createElement('div');
        div.className = 'upgrade-option loot-item';
        div.innerHTML = `<h3>${item.name}</h3><p></p>`;
        div.onclick = () => { item.effect(); modal.style.display = 'none'; }
        options.appendChild(div);
    });
    modal.style.display = 'flex';
}


function levelUp() {
    player.level++;
    player.exp -= player.expToNext;
    player.expToNext = Math.floor(player.expToNext * 1.2);
    
    gameState.paused = true;
    showLevelUpModal();
}

function showLevelUpModal() {
    const modal = document.getElementById('levelUpModal');
    const options = document.getElementById('upgradeOptions');
    
    // Generate upgrade options
    const upgrades = [
        {
            name: 'Health Boost',
            description: 'Increase max health by 25',
            effect: () => {
                player.maxHealth += 25;
                player.health = Math.min(player.health + 25, player.maxHealth);
            }
        },
        {
            name: 'Speed Enhancement',
            description: 'Increase movement speed by 0.5',
            effect: () => {
                player.speed += 0.5;
            }
        },
        {
            name: 'Weapon Upgrade',
            description: 'Increase all weapon damage by 20%',
            effect: () => {
                Object.values(weapons).forEach(weapon => {
                    weapon.damage = Math.floor(weapon.damage * 1.2);
                });
            }
        },
        {
            name: 'Fire Rate Boost',
            description: 'Reduce weapon cooldown by 15%',
            effect: () => {
                Object.values(weapons).forEach(weapon => {
                    weapon.cooldown = Math.floor(weapon.cooldown * 0.85);
                });
            }
        }
    ];
    
    // Add weapon unlock options based on level
    if (player.level === 3 && !activeWeapons.includes('spread')) {
        upgrades.push({
            name: 'Unlock Plasma Spread',
            description: 'Fires 3 projectiles in a spread pattern',
            effect: () => {
                activeWeapons.push('spread');
            }
        });
    }
    
    if (player.level === 5 && !activeWeapons.includes('laser')) {
        upgrades.push({
            name: 'Unlock Cyber Laser',
            description: 'High damage, long range laser weapon',
            effect: () => {
                activeWeapons.push('laser');
            }
        });
    }
    
    // Shuffle and pick 3 random upgrades
    const shuffled = upgrades.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    
    options.innerHTML = '';
    selected.forEach(upgrade => {
        const div = document.createElement('div');
        div.className = 'upgrade-option';
        div.innerHTML = `
            <h3>${upgrade.name}</h3>
            <p>${upgrade.description}</p>
        `;
        div.onclick = () => {
            upgrade.effect();
            modal.style.display = 'none';
            gameState.paused = false;
        };
        options.appendChild(div);
    });
    
    modal.style.display = 'flex';
}

function createParticles(x, y, color, count) {
    const maxParticles = 600;
    for (let i = 0; i < count; i++) {
        if (particles.length > maxParticles) break;
        particles.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y + (Math.random() - 0.5) * 20,
            dx: (Math.random() - 0.5) * 240,
            dy: (Math.random() - 0.5) * 240,
            color: color,
            life: 40 + Math.random() * 30,
            maxLife: 40 + Math.random() * 30,
            size: Math.random() * 4 + 1
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
    // assume delta ~16ms if not passed; particle velocities are px/sec
    const dt = 16;
    particle.x += particle.dx * (dt / 1000);
    particle.y += particle.dy * (dt / 1000);
    particle.dx *= 0.94;
    particle.dy *= 0.94;
    particle.life -= (dt / 16);
        
        if (particle.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function gameOver() {
    gameState.running = false;
    
    const modal = document.getElementById('gameOverModal');
    const finalTime = document.getElementById('finalTime');
    const finalLevel = document.getElementById('finalLevel');
    
    const timeElapsed = Math.floor((performance.now() - gameState.startTime) / 1000);
    const minutes = Math.floor(timeElapsed / 60);
    const seconds = timeElapsed % 60;
    
    finalTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    finalLevel.textContent = player.level;
    
    modal.style.display = 'flex';
    saveHighscore();
}

function updateUI() {
    // Health bar
    const healthPercent = (player.health / player.maxHealth) * 100;
    document.getElementById('healthBar').style.width = `${healthPercent}%`;
    document.getElementById('healthText').textContent = `${Math.max(0, Math.floor(player.health))}/${player.maxHealth}`;
    
    // Stats
    document.getElementById('playerLevel').textContent = player.level;
    document.getElementById('expText').textContent = `${player.exp}/${player.expToNext}`;
    
    // Timer
    if (gameState.running) {
        const timeElapsed = Math.floor((performance.now() - gameState.startTime) / 1000);
        const minutes = Math.floor(timeElapsed / 60);
        const seconds = timeElapsed % 60;
        document.getElementById('gameTimer').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Highscore (longest survival time in seconds)
function saveHighscore() {
    const timeElapsed = Math.floor((performance.now() - gameState.startTime) / 1000);
    const prev = parseInt(localStorage.getItem('neon_highscore') || '0', 10);
    if (timeElapsed > prev) {
        localStorage.setItem('neon_highscore', timeElapsed.toString());
        updateHighscoreDisplay(timeElapsed);
    }
}

function loadHighscore() {
    const prev = parseInt(localStorage.getItem('neon_highscore') || '0', 10);
    updateHighscoreDisplay(prev);
}

function updateHighscoreDisplay(sec) {
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    document.getElementById('highscore').textContent = `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
}

// Simple SFX using WebAudio
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let sfxGain = audioCtx.createGain();
sfxGain.connect(audioCtx.destination);
sfxGain.gain.value = 0.25;

function playTone(freq, duration=0.08, type='sine') {
    if (gameState.muted) return;
    try {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.value = 0.001;
        o.connect(g);
        g.connect(sfxGain);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        o.stop(audioCtx.currentTime + duration + 0.02);
    } catch(e) { /* audio blocked sometimes */ }
}

function playSfx(name) {
    if (gameState.muted) return;
    if (!audioCtx) return;
    switch(name) {
        case 'shoot': playTone(900, 0.04, 'square'); break;
        case 'hit': playTone(120, 0.12, 'sawtooth'); break;
        case 'pickup': playTone(1400, 0.06, 'sine'); break;
        default: playTone(800, 0.03, 'sine');
    }
}

// UI buttons
document.getElementById('btnPause').addEventListener('click', () => {
    gameState.paused = !gameState.paused;
    document.getElementById('btnPause').textContent = gameState.paused ? 'RESUME' : 'PAUSE';
});

document.getElementById('btnMute').addEventListener('click', () => {
    gameState.muted = !gameState.muted;
    document.getElementById('btnMute').textContent = gameState.muted ? 'UNMUTE' : 'MUTE';
});

document.getElementById('btnLowGraphics').addEventListener('click', () => {
    gameState.lowGraphics = !gameState.lowGraphics;
    document.getElementById('btnLowGraphics').classList.toggle('active', gameState.lowGraphics);
    document.getElementById('btnLowGraphics').textContent = gameState.lowGraphics ? 'LOW✓' : 'LOW';
});

document.getElementById('btnFullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
    } else {
        document.exitFullscreen?.();
    }
});

// Rendering
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background grid
    if (!gameState.lowGraphics) {
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.08)';
        ctx.lineWidth = 1;
        const gridSize = 50;
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
    }
    
    // Draw particles (skip in low graphics)
    if (!gameState.lowGraphics) {
        particles.forEach(particle => {
            const alpha = Math.max(0, particle.life / particle.maxLife);
            ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = particle.color;
            ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        });
    }
    
    // Draw projectiles
    projectiles.forEach(projectile => {
        ctx.fillStyle = projectile.color;
        if (!gameState.lowGraphics) { ctx.shadowColor = projectile.color; ctx.shadowBlur = 10; }
        ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.size, 0, Math.PI * 2); ctx.fill();
        if (!gameState.lowGraphics) ctx.shadowBlur = 0;
    });
    
    // Draw exp orbs
    expOrbs.forEach(orb => {
        const pulse = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 255, 0, ${0.8 + pulse * 0.2})`;
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Draw loot boxes
    lootBoxes.forEach(box => {
        if (box.opened) return;
        ctx.save();
        ctx.fillStyle = 'rgba(200,180,60,0.95)';
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(box.x - 12, box.y - 12, 24, 24);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#000'; ctx.font = '10px Orbitron, monospace';
        ctx.fillText('E', box.x - 5, box.y + 5);
        ctx.restore();
    });
    
    // Draw enemies
    enemies.forEach(enemy => {
        // Health bar
        if (enemy.health < enemy.maxHealth) {
            const barWidth = enemy.size * 2;
            const barHeight = 4;
            const healthPercent = enemy.health / enemy.maxHealth;
            
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.fillRect(enemy.x - barWidth/2, enemy.y - enemy.size - 10, barWidth, barHeight);
            
            ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.fillRect(enemy.x - barWidth/2, enemy.y - enemy.size - 10, barWidth * healthPercent, barHeight);
        }
        
        // Enemy body
        ctx.fillStyle = enemy.color;
        if (!gameState.lowGraphics) { ctx.shadowColor = enemy.color; ctx.shadowBlur = 8; }
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
        ctx.fill();

        // Punk spikes / studs for enemies to feel punk
        const spikes = enemy.type === 'drone' ? 4 : (enemy.type === 'hunter' ? 6 : 8);
        for (let s = 0; s < spikes; s++) {
            const ang = (s / spikes) * Math.PI * 2;
            const sx = enemy.x + Math.cos(ang) * (enemy.size + 6);
            const sy = enemy.y + Math.sin(ang) * (enemy.size + 6);
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(enemy.x + Math.cos(ang + 0.12) * (enemy.size + 2), enemy.y + Math.sin(ang + 0.12) * (enemy.size + 2));
            ctx.lineTo(enemy.x + Math.cos(ang - 0.12) * (enemy.size + 2), enemy.y + Math.sin(ang - 0.12) * (enemy.size + 2));
            ctx.closePath();
            ctx.fill();
        }

        // Enemy eye/detail
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        if (!gameState.lowGraphics) ctx.shadowBlur = 8;
    });
    
    // Draw player
    ctx.save();
    if (player.invulnerable) {
        ctx.globalAlpha = Math.sin(Date.now() * 0.02) * 0.5 + 0.5;
    }
    
        // Draw player with punk mohawk and jacket
        ctx.save();
        if (player.invulnerable) {
            ctx.globalAlpha = Math.sin(Date.now() * 0.02) * 0.5 + 0.5;
        }

        // Jacket / torso behind the player (punk leather)
        ctx.save();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.ellipse(player.x, player.y + player.size * 0.7, player.size * 1.5, player.size * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        // studs on jacket
        if (!gameState.lowGraphics) {
            for (let i = -2; i <= 2; i++) {
                ctx.fillStyle = 'rgba(200,200,200,0.9)';
                ctx.beginPath(); ctx.arc(player.x + i * 8, player.y + player.size * 0.5, 2, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.restore();

        // Head base
        ctx.fillStyle = player.color;
        ctx.shadowColor = player.color;
        ctx.shadowBlur = gameState.lowGraphics ? 0 : 14;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
        ctx.fill();

        // Player core
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = gameState.lowGraphics ? 0 : 8;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Mohawk: draw triangular spikes across the top
        const spikes = 7;
        const spikeW = player.size * 0.8;
        for (let i = 0; i < spikes; i++) {
            const t = (i / (spikes - 1)) - 0.5;
            const px = player.x + t * spikeW * 1.6;
            const py = player.y - player.size * 0.9 + Math.abs(t) * 2;
            const h = player.size * (1.2 + (1 - Math.abs(t)) * 0.8);
            // color gradient neon punk
            const color = i % 2 === 0 ? '#ff00aa' : '#00ddff';
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(px, py - h);
            ctx.lineTo(px - spikeW * 0.4, py + 6);
            ctx.lineTo(px + spikeW * 0.4, py + 6);
            ctx.closePath();
            ctx.fill();
        }

        // Visual aura by level (more aggressive when higher)
        const stage = Math.min(4, Math.floor(player.level / 3) + 1);
        if (stage >= 2) {
            ctx.save(); ctx.globalAlpha = 0.6; ctx.strokeStyle = stage === 2 ? '#ff44aa' : stage === 3 ? '#44aaff' : '#ffd24d'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(player.x, player.y, player.size + 8 + stage * 3, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        ctx.restore();
    
    ctx.restore();
    if (!gameState.lowGraphics) ctx.shadowBlur = 0;

    // Draw reticle (canvas overlay subtle)
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,255,136,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

// Game loop
let difficulty = 1;

function gameLoop(now) {
    if (!gameState.running) return;
    if (!now) now = performance.now();
    const delta = Math.min(60, now - gameState.lastTime);
    gameState.lastTime = now;

    if (!gameState.paused) {
        gameState.elapsed = now - gameState.startTime;

        // difficulty scales with time
        difficulty = 1 + gameState.elapsed / 60000; // slowly increases over minutes

        // Spawn accumulation
        gameState.spawnAccumulator += delta * (0.6 + difficulty * 0.4);
            // Cap spawns per frame to avoid freeze if accumulator grew large
            const maxSpawns = Math.min(5, Math.floor(gameState.spawnAccumulator / 800));
            for (let s = 0; s < maxSpawns; s++) {
                spawnEnemy(1 + difficulty * 0.25);
                gameState.spawnAccumulator -= 800;
            }

        // Update game objects with delta
        updatePlayer(delta);
        updateEnemies(delta);
        updateWeapons(delta);
        updateProjectiles(delta);
        updateExpOrbs(delta);
        updateParticles(delta);
    }

    // Render and UI
    render();
    updateUI();

    requestAnimationFrame(gameLoop);
}

// Initialize
window.addEventListener('load', () => {
    resizeCanvas();
});
