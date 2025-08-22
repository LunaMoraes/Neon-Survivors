// Game State
const gameState = {
    running: false,
    paused: false,
    // When a modal (loot/level) opened by the game is active
    modalPaused: false,
    // queue for pending level ups
    levelUpQueue: 0,
    muted: false,
    startTime: 0,
    lastTime: 0,
    elapsed: 0,
    spawnAccumulator: 0,
    lowGraphics: false,
    screenShake: {
        intensity: 0,
        duration: 0,
        time: 0
    }
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
    if (window.quadtreeManager) {
        window.quadtreeManager.init(canvas);
    }
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game objects
let player = null;
let weaponSystem = null;
let sessionExp = 0; // accumulated exp during current match
let demoRunning = false;
let demoInterval = null;
let demoTickId = null;
let demoRaf = null;
let demoPlayer = null;

function startDemo() {
    if (demoRunning) return;
    demoRunning = true;
    // simple demo player object
    demoPlayer = { x: canvas.width/2, y: canvas.height/2, size: 20, color: '#00ff88' };
    // lightweight demo weapon system
    const ds = new WeaponSystem();
    demoInterval = setInterval(() => { spawnEnemy(1.2); }, 1100);
    // start a render loop for the demo while the main game is not running
    function demoLoop() {
        if (!demoRunning || gameState.running) { demoRaf = null; return; }
        render();
        demoRaf = requestAnimationFrame(demoLoop);
    }
    if (!demoRaf) demoRaf = requestAnimationFrame(demoLoop);
    // also run a short demo tick to move projectiles/enemies for visuals while main game isn't running
    demoTickId = setInterval(() => {
        // move enemies slowly toward demoPlayer
        for (const e of enemies) {
            const dx = demoPlayer.x - e.x; const dy = demoPlayer.y - e.y;
            const d = Math.hypot(dx,dy) || 1;
            e.x += (dx/d) * (e.speed * 0.6) * (16/1000);
            e.y += (dy/d) * (e.speed * 0.6) * (16/1000);
        }
        // age projectiles
        for (let i = projectiles.length-1;i>=0;i--) {
            projectiles[i].life -= 50;
            if (projectiles[i].life <= 0) { poolManager.releaseProjectile(projectiles[i]); projectiles.splice(i,1); }
        }
    }, 80);
}

function stopDemo() {
    demoRunning = false;
    if (demoInterval) { clearInterval(demoInterval); demoInterval = null; }
    if (demoTickId) { clearInterval(demoTickId); demoTickId = null; }
    if (demoRaf) { cancelAnimationFrame(demoRaf); demoRaf = null; }
    demoPlayer = null;
}

const enemies = [];
const projectiles = [];
const particles = [];
const expOrbs = [];
const lootBoxes = [];

// Weapon system is now handled by WeaponSystem class

// Enemy types
const enemyTypes = GAME_CONFIG.ENEMY_TYPES;
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
    
    // Initialize player and weapon system
    player = new PlayerClass(canvas);
    weaponSystem = new WeaponSystem();
    // Apply any purchased perks to player/weapon at match start
    applyPerksToPlayer();
    
    // reset
    enemies.length = 0;
    projectiles.length = 0;
    particles.length = 0;
    expOrbs.length = 0;

    // initial small wave so players see action immediately
    spawnEnemy(1);
    spawnEnemy(1.1);
    spawnEnemy(1.2);

    loadHighscore();
    gameLoop();
}

// Apply purchased perks to the player and weapon system at the start of a match
function applyPerksToPlayer() {
    const state = getPerkState();
    if (!state || !player || !weaponSystem) return;

    // SPEED: each tier gives percentage increase in movement speed (additive stacking)
    let speedBonus = 0;
    const speedTiers = state.trees?.speed || {};
    Object.keys(speedTiers).forEach(t => {
        // map tier to percent, keep same as description (8,12,18,25)
        const tier = parseInt(t,10);
        if (tier === 1) speedBonus += 0.08;
        else if (tier === 2) speedBonus += 0.12;
        else if (tier === 3) speedBonus += 0.18;
        else if (tier === 4) speedBonus += 0.25;
    });
    if (speedBonus > 0) {
        player.speed = Math.round(player.speed * (1 + speedBonus));
    }

    // STRENGTH: each tier gives +20% weapon damage and should stack multiplicatively
    const strengthTiers = state.trees?.strength || {};
    Object.keys(strengthTiers).forEach(() => {
        // apply +20% by compounding weapon._damageMultiplier
        weaponSystem.upgradeDamage(0.20);
    });

    // DEFENSE: tiers give additive armor percentages (5%, 10%, 16%, 25%) as described
    const defTiers = state.trees?.defense || {};
    let armorSum = 0;
    Object.keys(defTiers).forEach(t => {
        const tier = parseInt(t,10);
        if (tier === 1) armorSum += 0.05;
        else if (tier === 2) armorSum += 0.10;
        else if (tier === 3) armorSum += 0.16;
        else if (tier === 4) armorSum += 0.25;
    });
    if (armorSum > 0) player.armor = Math.min(0.9, armorSum);
}

function updatePlayer(delta) {
    player.update(delta, canvas);
}

function spawnEnemy(difficultyFactor = 1) {
    const types = Object.keys(enemyTypes);
    
    // Dynamic enemy type distribution based on difficulty
    let type = 'DRONE';
    const roll = Math.random();
    
    if (difficultyFactor > 5) {
        // Very high difficulty: BRUTE and ASSASSIN appear
        if (roll > 0.85) type = 'BRUTE';
        else if (roll > 0.6) type = 'ASSASSIN';
        else if (roll > 0.35) type = 'TANK';
        else type = 'HUNTER';
    } else if (difficultyFactor > 3) {
        // High difficulty: more tanks and hunters and some assassins
        if (roll > 0.75) type = 'TANK';
        else if (roll > 0.45) type = 'HUNTER';
        else if (roll > 0.3) type = 'ASSASSIN';
    } else if (difficultyFactor > 2) {
        // Medium difficulty: balanced mix
        if (roll > 0.8) type = 'TANK';
        else if (roll > 0.4) type = 'HUNTER';
    } else if (difficultyFactor > 1.5) {
        // Low-medium difficulty: some hunters
        if (roll > 0.9) type = 'TANK';
        else if (roll > 0.6) type = 'HUNTER';
    }
    // Low difficulty: mostly drones

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

    enemies.push(poolManager.createEnemy({
        x: x,
        y: y,
        type: type,
    size: enemyData.size,
    speed: enemyData.speed * difficultyFactor,
    health: Math.floor(enemyData.health * difficultyFactor),
    damage: Math.max(1, Math.floor(enemyData.damage * difficultyFactor)),
        color: enemyData.color,
    exp: enemyData.exp,
    maxHealth: Math.floor(enemyData.health * difficultyFactor),
    armor: enemyData.armor || 0
    }));
}

function updateEnemies(delta) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const target = player || demoPlayer;
        // Move towards target (player or demo player) (speed in px/sec)
        const dx = (target.x || 0) - enemy.x;
        const dy = (target.y || 0) - enemy.y;
        const distance = Math.hypot(dx, dy);

        if (distance > 0) {
            enemy.x += (dx / distance) * enemy.speed * (delta / 1000);
            enemy.y += (dy / distance) * enemy.speed * (delta / 1000);
        }

        // Check collision with player using quadtree
        if (window.quadtreeManager) {
            const potentialCollisions = window.quadtreeManager.findCollisions(enemy);
            
            for (const obj of potentialCollisions) {
                if (obj === player && !player.invulnerable) {
                    const playerDistance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
                    if (playerDistance < player.size + enemy.size) {
                        const isDead = player.takeDamage(enemy.damage);
                        
                        if (isDead) {
                            gameOver();
                        } else {
                            // Knockback
                            const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
                            const kb = GAME_CONFIG.VISUAL.KNOCKBACK;
                            player.x += Math.cos(angle) * kb;
                            player.y += Math.sin(angle) * kb;
                            
                            createParticles(enemy.x, enemy.y, '#ff4444', 8);
                            playSfx('hit');
                        }
                        break;
                    }
                }
            }
        }

        // Remove enemies offscreen by a margin
        if (enemy.x < -2000 || enemy.x > canvas.width + 2000 || enemy.y < -2000 || enemy.y > canvas.height + 2000) {
            poolManager.releaseEnemy(enemies[i]);
            enemies.splice(i, 1);
        }
    }
}

function updateWeapons(delta) {
    weaponSystem.update(delta, player, enemies, projectiles);
}

// fireWeapon function is now handled by WeaponSystem class

// createProjectile function is now handled by WeaponSystem class

function updateProjectiles(delta) {
    // Update quadtree with current game state
    if (window.quadtreeManager) {
        window.quadtreeManager.update(enemies, projectiles, player);
    }
    
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.x += projectile.dx * (delta / 1000);
        projectile.y += projectile.dy * (delta / 1000);
        projectile.life -= delta;

        // Check collision with enemies using quadtree
        let collisionFound = false;
        if (window.quadtreeManager) {
            const potentialCollisions = window.quadtreeManager.findCollisions(projectile);
            
            for (const obj of potentialCollisions) {
                if (obj !== projectile && enemies.includes(obj)) {
                    const distance = Math.hypot(projectile.x - obj.x, projectile.y - obj.y);
                    if (distance < projectile.size + obj.size) {
                        // Apply armor: damage reduced by enemy armor percentage
                        const armor = obj.armor || 0;
                        const effectiveDamage = Math.max(0, Math.round(projectile.damage * (1 - armor)));
                        obj.health -= effectiveDamage;
                        createParticles(obj.x, obj.y, projectile.color, 4);
                        playSfx('hit');
                        if (obj.health <= 0) {
                            // XP orb lasts longer so player has time to pick it up
                            expOrbs.push(poolManager.createExpOrb({ x: obj.x, y: obj.y, value: obj.exp, life: 8000 }));
                            createParticles(obj.x, obj.y, '#00ff00', 12);
                            // Chance to drop lootbox
                            if (Math.random() < 0.18) {
                                lootBoxes.push(poolManager.createLootBox({ x: obj.x, y: obj.y, life: 12000, opened: false }));
                            }
                            const enemyIndex = enemies.indexOf(obj);
                            if (enemyIndex !== -1) {
                                poolManager.releaseEnemy(enemies[enemyIndex]);
                                enemies.splice(enemyIndex, 1);
                            }
                        }
                        poolManager.releaseProjectile(projectiles[i]);
                        projectiles.splice(i, 1);
                        collisionFound = true;
                        break;
                    }
                }
            }
        }
        
        if (collisionFound) continue;

        if (projectile.life <= 0 || projectile.x < -500 || projectile.x > canvas.width + 500 || projectile.y < -500 || projectile.y > canvas.height + 500) {
            poolManager.releaseProjectile(projectiles[i]);
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
        // Increased attraction range with exp magnet upgrade
        let attractionRange = Math.max(120, player.speed * 0.6);
        if (player.expMagnet) {
            attractionRange *= 1.5; // 50% larger attraction range
        }
        if (distance < attractionRange) {
            const angle = Math.atan2(player.y - orb.y, player.x - orb.x);
            // base speed + bonus proportional to player speed
            const baseSpeed = 240;
            const speed = baseSpeed + (player.speed * 0.8);
            orb.x += Math.cos(angle) * speed * (delta / 1000);
            orb.y += Math.sin(angle) * speed * (delta / 1000);
            // pickup distance increased so fast players can scoop orbs
            if (distance < Math.max(22, player.size + 6)) {
                    const shouldLevelUp = player.addExp(orb.value);
                    sessionExp += orb.value;
                if (shouldLevelUp) {
                    gameState.levelUpQueue = (gameState.levelUpQueue || 0) + 1;
                    processLevelQueue();
                }
                expOrbs.splice(i, 1);
                playSfx('pickup');
                continue;
            }
        }
        if (orb.life <= 0) {
            poolManager.releaseExpOrb(expOrbs[i]);
            expOrbs.splice(i, 1);
        }
    }
}

// Loot interaction: auto-collected when player steps on lootbox

// Add loot box cleanup and auto-collection in update loop
function updateLootBoxes(delta) {
    for (let i = lootBoxes.length - 1; i >= 0; i--) {
        const box = lootBoxes[i];
        box.life -= delta;
        
        // Auto-collect when player steps on lootbox
        if (player && !box.opened) {
            const distance = Math.hypot(player.x - box.x, player.y - box.y);
            if (distance < player.size + 20) { // 20px pickup radius
                openLootBox(i);
                continue; // Skip to next lootbox since this one is being opened
            }
        }
        
        if (box.life <= 0) {
            poolManager.releaseLootBox(lootBoxes[i]);
            lootBoxes.splice(i, 1);
        }
    }
}

function openLootBox(index) {
    const box = lootBoxes[index];
    if (!box || box.opened) return;
    box.opened = true;
    
    // Pause the game during loot selection. Save previous pause state so we can restore it.
    gameState.previousPaused = !!gameState.paused;
    gameState.modalPaused = true;
    gameState.paused = true;
    
    // generate 3 loot choices
    const lootPool = [
        { name: 'Minor Health', effect: () => { player.health = Math.min(player.maxHealth, player.health + 30); } },
        { name: 'Exp Cache', effect: () => { player.exp += 5; if (player.exp >= player.expToNext) { gameState.levelUpQueue = (gameState.levelUpQueue || 0) + 1; processLevelQueue(); } } },
        { name: 'Speed Chip', effect: () => { player.speed += 30; } },
    { name: 'Weapon Shard', effect: () => { if (weaponSystem) weaponSystem.upgradeDamage(0.25); } },
        { name: 'Max Health', effect: () => { player.maxHealth += 20; player.health += 20; } }
    ];

    const shuffled = lootPool.sort(() => 0.5 - Math.random()).slice(0,3);
    const modal = document.getElementById('lootModal');
    const options = document.getElementById('lootOptions');
    options.innerHTML = '';
    
    // Create a function to handle loot selection and resume game
    const handleLootSelection = (item) => {
        item.effect();
        modal.style.display = 'none';
        // restore previous pause state (if player had manually paused the game keep it paused)
        gameState.modalPaused = false;
        gameState.paused = !!gameState.previousPaused;
        delete gameState.previousPaused;
    };
    
    shuffled.forEach(item => {
        const div = document.createElement('div');
        div.className = 'upgrade-option loot-item';
        div.innerHTML = `<h3>${item.name}</h3><p></p>`;
        div.onclick = () => handleLootSelection(item);
        options.appendChild(div);
    });
    modal.style.display = 'flex';
}


function levelUp() {
    // queue level ups to avoid modal/pause races
    gameState.levelUpQueue = (gameState.levelUpQueue || 0) + 1;
    processLevelQueue();
}

function processLevelQueue() {
    if (!gameState.levelUpQueue || gameState.levelUpQueue <= 0) return;
    const modal = document.getElementById('levelUpModal');
    const lootModal = document.getElementById('lootModal');
    // If another modal is open, wait
    if ((modal && modal.style.display === 'flex') || (lootModal && lootModal.style.display === 'flex')) return;

    // Apply the level increment now
    player.levelUp();
    gameState.levelUpQueue = Math.max(0, gameState.levelUpQueue - 1);
    // Pause and show modal
    gameState.previousPaused = !!gameState.paused;
    gameState.paused = true;
    gameState.modalPaused = true;
    showLevelUpModal();
}

function showLevelUpModal() {
    const modal = document.getElementById('levelUpModal');
    const options = document.getElementById('upgradeOptions');
    
    // Generate upgrade options with more variety
    const upgrades = [
        {
            name: 'Health Boost',
            description: 'Increase max health by 25',
            effect: () => {
                player.increaseMaxHealth(25);
            }
        },
        {
            name: 'Speed Enhancement',
            description: 'Increase movement speed by 30',
            effect: () => {
                player.increaseSpeed(30);
            }
        },
        {
            name: 'Weapon Damage +40%',
            description: 'Increase all weapon damage by 40% (stacks)',
            effect: () => {
                weaponSystem.upgradeDamage(0.4);
            }
        },
        {
            name: 'Fire Rate +15%',
            description: 'Reduce weapon cooldown by 15%',
            effect: () => {
                weaponSystem.upgradeFireRate(0.15);
            }
        },
        {
            name: 'Projectile Speed +10%',
            description: 'Increase projectile speed for all weapons',
            effect: () => {
                Object.values(weaponSystem.weapons).forEach(weapon => {
                    weapon.speed = Math.floor(weapon.speed * 1.1);
                });
            }
        },
        {
            name: 'Exp Magnet',
            description: 'Increase experience orb attraction range',
            effect: () => {
                // This will be handled in the exp orb update logic
                player.expMagnet = true;
            }
        },
        {
            name: 'Critical Hits',
            description: '10% chance to deal double damage',
            effect: () => {
                weaponSystem.criticalChance = 0.1;
            }
        },
        {
            name: 'Health Regeneration',
            description: 'Regenerate 1 health per second',
            effect: () => {
                player.healthRegen = 1;
            }
        }
    ];
    
    // Add weapon unlock options based on config unlock levels
    const weaponUnlocks = [
        { name: 'spread', config: GAME_CONFIG.WEAPONS.SPREAD },
        { name: 'laser', config: GAME_CONFIG.WEAPONS.LASER }
    ];
    
    weaponUnlocks.forEach(weapon => {
        if (player.level >= weapon.config.unlockLevel && 
            !weaponSystem.activeWeapons.includes(weapon.name)) {
            upgrades.push({
                name: `Unlock ${weapon.config.name}`,
                description: weapon.name === 'spread' ? 'Fires 3 projectiles in a spread pattern' : 'High damage, long range laser weapon',
                effect: () => {
                    weaponSystem.unlockWeapon(weapon.name);
                }
            });
        }
    });
    
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
            // restore previous pause state
            gameState.modalPaused = false;
            gameState.paused = !!gameState.previousPaused;
            delete gameState.previousPaused;
            // If more queued level-ups remain, process next
            if (gameState.levelUpQueue && gameState.levelUpQueue > 0) {
                setTimeout(processLevelQueue, 200);
            }
        };
        options.appendChild(div);
    });
    
    modal.style.display = 'flex';
}

function createParticles(x, y, color, count) {
    const maxParticles = 600;
    for (let i = 0; i < count; i++) {
        if (particles.length > maxParticles) break;
        particles.push(poolManager.createParticle({
            x: x + (Math.random() - 0.5) * 20,
            y: y + (Math.random() - 0.5) * 20,
            dx: (Math.random() - 0.5) * 240,
            dy: (Math.random() - 0.5) * 240,
            color: color,
            life: 40 + Math.random() * 30,
            maxLife: 40 + Math.random() * 30,
            size: Math.random() * 4 + 1
        }));
    }
}

// Screen shake functions
function triggerScreenShake(intensity = 10, duration = 200) {
    gameState.screenShake.intensity = intensity;
    gameState.screenShake.duration = duration;
    gameState.screenShake.time = duration;
}

function updateScreenShake(delta) {
    if (gameState.screenShake.time > 0) {
        gameState.screenShake.time -= delta;
        gameState.screenShake.intensity *= 0.9; // Decay intensity
    } else {
        gameState.screenShake.intensity = 0;
    }
}

function getScreenShakeOffset() {
    if (gameState.screenShake.intensity <= 0) return { x: 0, y: 0 };
    
    const intensity = gameState.screenShake.intensity;
    return {
        x: (Math.random() - 0.5) * intensity,
        y: (Math.random() - 0.5) * intensity
    };
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
            poolManager.releaseParticle(particles[i]);
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

    // Award perk points based on sessionExp and store in cookies
    const prog = getPerkState();
    let pointsAwarded = 1;
    if (sessionExp >= (GAME_CONFIG.PROGRESSION.POINT_THRESHOLDS[1] || 150)) pointsAwarded = 3;
    else if (sessionExp >= (GAME_CONFIG.PROGRESSION.POINT_THRESHOLDS[0] || 50)) pointsAwarded = 2;
    prog.points = (prog.points || 0) + Math.min(pointsAwarded, GAME_CONFIG.PROGRESSION.MAX_POINTS_PER_MATCH || 3);
    savePerkState(prog);
    sessionExp = 0;

    // Update Game Over modal buttons for restart / main menu
    const modalContent = modal.querySelector('.modal-content');
        const runPoints = pointsAwarded;
        modalContent.innerHTML = `\n        <h2>GAME OVER</h2>\n        <p>You survived for <span id="finalTimeDisplay">${finalTime.textContent}</span></p>\n        <p>Final Level: <span id="finalLevelDisplay">${player.level}</span></p>\n        <p style="margin-top:8px;color:#cfe;">Perk Points earned this run: <strong>${runPoints}</strong></p>\n        <div style="display:flex;gap:12px;justify-content:center;margin-top:12px;">\n          <button class="start-btn" id="goMain">MAIN MENU</button>\n          <button class="start-btn" id="goRestart">RESTART</button>\n        </div>\n    `;
    document.getElementById('goMain').addEventListener('click', () => { document.getElementById('gameOverModal').style.display = 'none'; document.getElementById('startScreen').style.display = 'flex'; });
    document.getElementById('goRestart').addEventListener('click', () => { location.reload(); });
}

function updateUI() {
    // Health bar
    const healthPercent = player.getHealthPercent();
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

    // Show active perk bonuses summary
    const perkSummary = computePerkSummary();
    const perkEl = document.getElementById('perkBuffs');
    if (perkEl) {
        perkEl.textContent = perkSummary || '\u00A0';
    }
}

function computePerkSummary() {
    const state = getPerkState();
    if (!state) return '';
    const parts = [];
    const s = state.trees || {};
    // Strength: count tiers
    const strengthCount = Object.keys(s.strength || {}).length;
    if (strengthCount > 0) parts.push(`Dmg +${Math.round((Math.pow(1.2, strengthCount)-1)*100)}%`);
    const speedCount = Object.keys(s.speed || {}).length;
    if (speedCount > 0) {
        // derive % from our mapping used earlier
        let speedPct = 0;
        for (const t of Object.keys(s.speed||{})) {
            const tier = parseInt(t,10);
            if (tier===1) speedPct += 8;
            else if (tier===2) speedPct += 12;
            else if (tier===3) speedPct += 18;
            else if (tier===4) speedPct += 25;
        }
        parts.push(`Spd +${speedPct}%`);
    }
    const defCount = Object.keys(s.defense || {}).length;
    if (defCount > 0) {
        let armorPct = 0;
        for (const t of Object.keys(s.defense||{})) {
            const tier = parseInt(t,10);
            if (tier===1) armorPct += 5;
            else if (tier===2) armorPct += 10;
            else if (tier===3) armorPct += 16;
            else if (tier===4) armorPct += 25;
        }
        parts.push(`Armor +${armorPct}%`);
    }
    return parts.join(' • ');
}

// Populate debug overlay with weapon and enemy stats
function updateDebugOverlay() {
    if (!showDebug) return;
    if (!weaponSystem || !player) {
        debugOverlay.textContent = 'weaponSystem/player not initialized';
        return;
    }

    const lines = [];
    lines.push('--- DEBUG ---');
    // weapon info
    Object.entries(weaponSystem.weapons).forEach(([name, w]) => {
        const base = w._baseDamage || w.damage || 0;
        const mult = (w._damageMultiplier || 0).toFixed(2);
        const effective = Math.round(base * (1 + (w._damageMultiplier || 0)));
        lines.push(`${name}: base=${base} mult=${mult} -> eff=${effective} dmg cooldown=${w.cooldown}`);
    });

    // nearest enemy info
    if (enemies.length > 0) {
        let nearest = enemies[0];
        let nd = Math.hypot(player.x - nearest.x, player.y - nearest.y);
        for (let i = 1; i < enemies.length; i++) {
            const e = enemies[i];
            const d = Math.hypot(player.x - e.x, player.y - e.y);
            if (d < nd) { nearest = e; nd = d; }
        }
        lines.push(`nearestEnemy: type=${nearest.type} hp=${nearest.health}/${nearest.maxHealth} speed=${nearest.speed.toFixed(1)} dmg=${nearest.damage}`);
    } else {
        lines.push('nearestEnemy: none');
    }

    lines.push(`levelUpQueue=${gameState.levelUpQueue || 0} paused=${gameState.paused} modalPaused=${gameState.modalPaused}`);

    debugOverlay.textContent = lines.join('\n');
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

// Debug: Show pool stats (press P) and toggle quadtree visualization (press Q)
let showQuadtree = false;
let showDebug = false;
// create debug overlay element
const debugOverlay = document.createElement('div');
debugOverlay.id = 'debugOverlay';
debugOverlay.style.position = 'absolute';
debugOverlay.style.left = '8px';
debugOverlay.style.bottom = '8px';
debugOverlay.style.padding = '8px 10px';
debugOverlay.style.background = 'rgba(0,0,0,0.6)';
debugOverlay.style.color = '#fff';
debugOverlay.style.fontFamily = 'monospace';
debugOverlay.style.fontSize = '12px';
debugOverlay.style.zIndex = 1001;
debugOverlay.style.pointerEvents = 'none';
debugOverlay.style.maxWidth = '360px';
debugOverlay.style.whiteSpace = 'pre-wrap';
debugOverlay.style.display = 'none';
document.body.appendChild(debugOverlay);
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' && e.shiftKey) {
        const stats = poolManager.getStats();
        console.log('Pool Statistics:', stats);
    }
    if (e.code === 'KeyQ' && e.shiftKey) {
        showQuadtree = !showQuadtree;
        console.log('Quadtree visualization:', showQuadtree ? 'ON' : 'OFF');
    }
    if (e.code === 'KeyU') {
        showDebug = !showDebug;
        debugOverlay.style.display = showDebug ? 'block' : 'none';
        console.log('Debug overlay:', showDebug ? 'ON' : 'OFF');
    }
});

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
    
    // Apply screen shake offset
    const shakeOffset = getScreenShakeOffset();
    ctx.save();
    ctx.translate(shakeOffset.x, shakeOffset.y);
    
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
    ctx.fillStyle = `rgba(0, 255, 0, ${0.8 + pulse * 0.2})`;
    ctx.shadowColor = '#00ff00';
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
    const renderPlayer = player || demoPlayer;
    if (renderPlayer && renderPlayer.invulnerable) {
        ctx.globalAlpha = Math.sin(Date.now() * 0.02) * 0.5 + 0.5;
    }
    
        // Draw player with punk mohawk and jacket
        ctx.save();
        if (renderPlayer && renderPlayer.invulnerable) {
            ctx.globalAlpha = Math.sin(Date.now() * 0.02) * 0.5 + 0.5;
        }

        // Jacket / torso behind the player (punk leather)
        ctx.save();
        ctx.fillStyle = '#111';
        ctx.beginPath();
    ctx.ellipse(renderPlayer.x, renderPlayer.y + renderPlayer.size * 0.7, renderPlayer.size * 1.5, renderPlayer.size * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        // studs on jacket
        if (!gameState.lowGraphics) {
            for (let i = -2; i <= 2; i++) {
                ctx.fillStyle = 'rgba(200,200,200,0.9)';
                ctx.beginPath(); ctx.arc(renderPlayer.x + i * 8, renderPlayer.y + renderPlayer.size * 0.5, 2, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.restore();

        // Head base
        ctx.fillStyle = player.color;
        ctx.shadowColor = player.color;
        ctx.shadowBlur = gameState.lowGraphics ? 0 : 14;
    ctx.beginPath();
    ctx.arc(renderPlayer.x, renderPlayer.y, renderPlayer.size, 0, Math.PI * 2);
    ctx.fill();

        // Player core
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = gameState.lowGraphics ? 0 : 8;
    ctx.beginPath();
    ctx.arc(renderPlayer.x, renderPlayer.y, renderPlayer.size * 0.5, 0, Math.PI * 2);
    ctx.fill();

        // Mohawk: draw triangular spikes across the top
        const spikes = 7;
    const spikeW = renderPlayer.size * 0.8;
        for (let i = 0; i < spikes; i++) {
            const t = (i / (spikes - 1)) - 0.5;
            const px = renderPlayer.x + t * spikeW * 1.6;
            const py = renderPlayer.y - renderPlayer.size * 0.9 + Math.abs(t) * 2;
            const h = renderPlayer.size * (1.2 + (1 - Math.abs(t)) * 0.8);
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
    
    // Debug: Draw quadtree visualization
    if (showQuadtree && window.quadtreeManager) {
        window.quadtreeManager.debugDraw();
    }
    
    ctx.restore(); // Restore from screen shake
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

        // Improved difficulty scaling with plateaus and varied progression
        const minutes = gameState.elapsed / 60000;
        
        // Base difficulty increases with time, but with plateaus
        difficulty = 1 + Math.min(minutes * 0.8, 5); // Cap at 6x difficulty
        
        // Add periodic difficulty spikes every 30 seconds
        const spikeFactor = Math.sin(gameState.elapsed / 30000 * Math.PI) * 0.3;
        
        // Add player level influence (higher level = slightly easier)
        const levelFactor = Math.max(0.7, 1 - (player.level * 0.02));
        
        const totalDifficulty = difficulty + spikeFactor;

        // Spawn accumulation with dynamic rates
        const baseSpawnRate = GAME_CONFIG.SPAWN.BASE_SPAWN_RATE;
        const difficultyScale = GAME_CONFIG.SPAWN.DIFFICULTY_SCALE;
        gameState.spawnAccumulator += delta * (baseSpawnRate + totalDifficulty * difficultyScale) * levelFactor;
        
        // Cap spawns per frame to avoid freeze if accumulator grew large
        const maxSpawns = Math.min(GAME_CONFIG.SPAWN.MAX_SPAWNS_PER_FRAME, 
                                 Math.floor(gameState.spawnAccumulator / GAME_CONFIG.SPAWN.SPAWN_ACCUMULATOR_THRESHOLD));
        
        for (let s = 0; s < maxSpawns; s++) {
            // Vary enemy types based on difficulty
            let enemyDifficulty = totalDifficulty;
            if (minutes > 2) enemyDifficulty *= 1.2; // Ramp up after 2 minutes
            if (minutes > 5) enemyDifficulty *= 1.5; // Significant ramp after 5 minutes
            
            spawnEnemy(enemyDifficulty);
            gameState.spawnAccumulator -= GAME_CONFIG.SPAWN.SPAWN_ACCUMULATOR_THRESHOLD;
        }

        // Update game objects with delta
        updatePlayer(delta);
        updateEnemies(delta);
        updateWeapons(delta);
        updateProjectiles(delta);
        updateExpOrbs(delta);
        updateLootBoxes(delta);
        updateParticles(delta);
        updateScreenShake(delta);
    }

    // Render and UI
    render();
    updateUI();
    updateDebugOverlay();

    requestAnimationFrame(gameLoop);
}

// Initialize
window.addEventListener('load', () => {
    resizeCanvas();
    // main menu wiring
    const playBtn = document.getElementById('playBtn');
    const progressionBtn = document.getElementById('progressionBtn');
    const progressionModal = document.getElementById('progressionModal');
    const closeProgression = document.getElementById('closeProgression');

    playBtn?.addEventListener('click', () => {
    document.getElementById('startScreen').style.display = 'none';
    stopDemo();
    startGame();
    });
    progressionBtn?.addEventListener('click', () => {
        showProgression();
    });
    closeProgression?.addEventListener('click', () => { progressionModal.style.display = 'none'; });

    renderPerkTrees();
    // start background demo in main menu
    startDemo();
});

// Cookie helpers for simple persistence
function setCookie(name, value, days = 365) {
    const d = new Date(); d.setTime(d.getTime() + (days*24*60*60*1000));
    document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))};expires=${d.toUTCString()};path=/`;
}
function getCookie(name) {
    const v = document.cookie.split('; ').find(row => row.startsWith(name+'='));
    if (!v) return null;
    try { return JSON.parse(decodeURIComponent(v.split('=')[1])); } catch(e) { return null; }
}

// Perk storage and UI
function getPerkState() {
    return getCookie('neon_perks') || { points: 0, trees: { speed: {}, strength: {}, defense: {} } };
}
function savePerkState(state) { setCookie('neon_perks', state); document.getElementById('perkPoints').textContent = (state.points||0); }

function renderPerkTrees() {
    const container = document.getElementById('perkTrees');
    if (!container) return;
    const state = getPerkState();
    container.innerHTML = '';
    const trees = ['speed','strength','defense'];
    // Perk definitions with descriptions and effect hints
    const perkDefs = {
        speed: {
            1: { desc: '+8% move speed', effect: 'Adds +8% base movement speed.' },
            2: { desc: '+12% move speed', effect: 'Adds +12% movement (stacking).' },
            3: { desc: '+18% move speed', effect: 'Adds +18% movement.' },
            4: { desc: '+25% move speed', effect: 'Adds +25% movement.' }
        },
        strength: {
            1: { desc: '+20% weapon damage', effect: 'Increases weapon damage multiplicatively by 20% (stacks).' },
            2: { desc: '+20% weapon damage', effect: 'Another +20% (stacks with previous tiers).' },
            3: { desc: '+20% weapon damage', effect: 'Another +20% (stacks).' },
            4: { desc: '+20% weapon damage', effect: 'Another +20% (stacks).' }
        },
        defense: {
            1: { desc: '+5% armor', effect: 'Grants +5% starting armor (reduces incoming damage).' },
            2: { desc: '+10% armor', effect: 'Grants +10% starting armor.' },
            3: { desc: '+16% armor', effect: 'Grants +16% starting armor.' },
            4: { desc: '+25% armor', effect: 'Grants +25% starting armor.' }
        }
    };

    trees.forEach(t => {
        const box = document.createElement('div');
        box.className = 'perk-tree';
        const title = document.createElement('h3'); title.textContent = t.toUpperCase(); box.appendChild(title);

        // sequential nodes with connectors
        for (let i=1;i<=4;i++) {
            const node = document.createElement('div');
            node.className = 'perk-node';
            const owned = !!(state.trees[t] && state.trees[t][i]);
            const prevOwned = (i===1) ? true : !!(state.trees[t] && state.trees[t][i-1]);
            if (!prevOwned && !owned) node.classList.add('locked');

            // left: label
            const label = document.createElement('div');
            label.innerHTML = `<strong>Tier ${i}</strong>`;
            // right: button / status
            const right = document.createElement('div');
            right.style.display = 'flex'; right.style.gap = '8px'; right.style.alignItems = 'center';

            const desc = document.createElement('div');
            desc.className = 'info';
            desc.textContent = perkDefs[t][i].desc;
            desc.title = perkDefs[t][i].effect; // tooltip with extended info

            const btn = document.createElement('button');
            btn.textContent = owned ? 'Owned' : 'Buy';
            btn.disabled = owned || !prevOwned || (state.points <= 0);
            btn.dataset.tree = t; btn.dataset.tier = i;
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                const s = getPerkState();
                // verify prerequisites
                const canBuy = !s.trees[t]?.[i] && ((i===1) || !!s.trees[t]?.[i-1]) && (s.points > 0);
                if (!canBuy) return;
                s.points = Math.max(0, s.points - 1);
                s.trees[t] = s.trees[t] || {};
                s.trees[t][i] = true;
                savePerkState(s);
                renderPerkTrees();
            });

            node.appendChild(label);
            right.appendChild(desc);
            right.appendChild(btn);
            node.appendChild(right);

            box.appendChild(node);

            if (i < 4) {
                const connector = document.createElement('div');
                connector.className = 'perk-connector';
                box.appendChild(connector);
            }
        }

        container.appendChild(box);
    });
}

function showProgression() {
    const modal = document.getElementById('progressionModal');
    if (!modal) return;
    const state = getPerkState();
    document.getElementById('perkPoints').textContent = state.points || 0;
    renderPerkTrees();
    modal.style.display = 'flex';
}
