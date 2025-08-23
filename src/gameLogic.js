// Core game logic restored
import { gameState, canvas, ctx, enemies, projectiles, particles, expOrbs, lootBoxes, sessionExp, setPlayer } from './state.js';

let player = null;
let weaponSystem = null;

// startGame function
export function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    gameState.running = true;
    gameState.startTime = performance.now();
    gameState.lastTime = performance.now();
    
    if (typeof window.resizeCanvas === 'function') window.resizeCanvas();
    
    // Initialize player and weapon system
    if (window.PlayerClass) {
        player = new window.PlayerClass(canvas);
        setPlayer(player); // Update both exported state and window.player
    }
    if (window.WeaponSystem) weaponSystem = new window.WeaponSystem();
    
    // Apply any purchased perks to player/weapon at match start
    applyPerksToPlayer();
    
    // reset arrays
    enemies.length = 0;
    projectiles.length = 0;
    particles.length = 0;
    expOrbs.length = 0;
    lootBoxes.length = 0;

    // initial small wave so players see action immediately
    spawnEnemy(1);
    spawnEnemy(1.1);
    spawnEnemy(1.2);

    loadHighscore();
    if (gameState.running && window.gameLoop) window.gameLoop();
}

// Apply purchased perks to the player and weapon system at the start of a match
function applyPerksToPlayer() {
    const state = getPerkState();
    if (!state || !player || !weaponSystem) return;

    // SPEED: each tier gives percentage increase in movement speed (additive stacking)
    let speedBonus = 0;
    const speedTiers = state.trees?.speed || {};
    Object.keys(speedTiers).forEach(t => {
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

export function spawnEnemy(difficultyFactor = 1) {
    const enemyTypes = window.GAME_CONFIG?.ENEMY_TYPES || {};
    const types = Object.keys(enemyTypes);
    
    // Dynamic enemy type distribution based on difficulty
    let type = 'DRONE';
    const roll = Math.random();
    
    if (difficultyFactor > 5) {
        if (roll > 0.85) type = 'BRUTE';
        else if (roll > 0.6) type = 'ASSASSIN';
        else if (roll > 0.35) type = 'TANK';
        else type = 'HUNTER';
    } else if (difficultyFactor > 3) {
        if (roll > 0.75) type = 'TANK';
        else if (roll > 0.45) type = 'HUNTER';
        else if (roll > 0.3) type = 'ASSASSIN';
    } else if (difficultyFactor > 2) {
        if (roll > 0.8) type = 'TANK';
        else if (roll > 0.4) type = 'HUNTER';
    } else if (difficultyFactor > 1.5) {
        if (roll > 0.9) type = 'TANK';
        else if (roll > 0.6) type = 'HUNTER';
    }

    const enemyData = enemyTypes[type] || enemyTypes.DRONE;
    if (!enemyData) return;

    // Spawn from random edge
    let x, y;
    const side = Math.floor(Math.random() * 4);
    switch(side) {
        case 0: x = Math.random() * canvas.width; y = -enemyData.size; break;
        case 1: x = canvas.width + enemyData.size; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + enemyData.size; break;
        case 3: x = -enemyData.size; y = Math.random() * canvas.height; break;
    }

    if (window.poolManager) {
        enemies.push(window.poolManager.createEnemy({
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
}

// Update functions
export function updatePlayer(delta) {
    if (player) player.update(delta, canvas);
}

export function updateEnemies(delta) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const target = player || window._demoPlayer;
        if (!target) continue;
        
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        const distance = Math.hypot(dx, dy);

        if (distance > 0) {
            enemy.x += (dx / distance) * enemy.speed * (delta / 1000);
            enemy.y += (dy / distance) * enemy.speed * (delta / 1000);
        }

        // Check collision with player using quadtree
        if (player && window.quadtreeManager) {
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
                            const kb = window.GAME_CONFIG?.VISUAL?.KNOCKBACK || 40;
                            player.x += Math.cos(angle) * kb;
                            player.y += Math.sin(angle) * kb;
                            
                            createParticles(enemy.x, enemy.y, '#ff4444', 8);
                            if (window.playSfx) window.playSfx('hit');
                        }
                        break;
                    }
                }
            }
        }

        // Remove enemies offscreen
        if (enemy.x < -2000 || enemy.x > canvas.width + 2000 || enemy.y < -2000 || enemy.y > canvas.height + 2000) {
            if (window.poolManager) window.poolManager.releaseEnemy(enemies[i]);
            enemies.splice(i, 1);
        }
    }
}

export function updateWeapons(delta) {
    if (weaponSystem && player) weaponSystem.update(delta, player, enemies, projectiles);
}

export function updateProjectiles(delta) {
    if (window.quadtreeManager) {
        window.quadtreeManager.update(enemies, projectiles, player);
    }
    
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.x += projectile.dx * (delta / 1000);
        projectile.y += projectile.dy * (delta / 1000);
        projectile.life -= delta;

        let collisionFound = false;
        if (window.quadtreeManager) {
            const potentialCollisions = window.quadtreeManager.findCollisions(projectile);
            
            for (const obj of potentialCollisions) {
                if (obj !== projectile && enemies.includes(obj)) {
                    const distance = Math.hypot(projectile.x - obj.x, projectile.y - obj.y);
                    if (distance < projectile.size + obj.size) {
                        const armor = obj.armor || 0;
                        const effectiveDamage = Math.max(0, Math.round(projectile.damage * (1 - armor)));
                        obj.health -= effectiveDamage;
                        createParticles(obj.x, obj.y, projectile.color, 4);
                        if (window.playSfx) window.playSfx('hit');
                        
                        if (obj.health <= 0) {
                            expOrbs.push(window.poolManager.createExpOrb({ x: obj.x, y: obj.y, value: obj.exp, life: 8000 }));
                            createParticles(obj.x, obj.y, '#00ff00', 12);
                            
                            if (Math.random() < 0.18) {
                                lootBoxes.push(window.poolManager.createLootBox({ x: obj.x, y: obj.y, life: 12000, opened: false }));
                            }
                            
                            const enemyIndex = enemies.indexOf(obj);
                            if (enemyIndex !== -1) {
                                window.poolManager.releaseEnemy(enemies[enemyIndex]);
                                enemies.splice(enemyIndex, 1);
                            }
                        }
                        
                        window.poolManager.releaseProjectile(projectiles[i]);
                        projectiles.splice(i, 1);
                        collisionFound = true;
                        break;
                    }
                }
            }
        }
        
        if (collisionFound) continue;

        if (projectile.life <= 0 || projectile.x < -500 || projectile.x > canvas.width + 500 || projectile.y < -500 || projectile.y > canvas.height + 500) {
            window.poolManager.releaseProjectile(projectiles[i]);
            projectiles.splice(i, 1);
        }
    }
}

export function updateExpOrbs(delta) {
    for (let i = expOrbs.length - 1; i >= 0; i--) {
        const orb = expOrbs[i];
        orb.life -= delta;
        if (player) {
            const distance = Math.hypot(player.x - orb.x, player.y - orb.y);
            let attractionRange = Math.max(120, player.speed * 0.6);
            if (player.expMagnet) {
                attractionRange *= 1.5;
            }
            if (distance < attractionRange) {
                const angle = Math.atan2(player.y - orb.y, player.x - orb.x);
                const baseSpeed = 240;
                const speed = baseSpeed + (player.speed * 0.8);
                orb.x += Math.cos(angle) * speed * (delta / 1000);
                orb.y += Math.sin(angle) * speed * (delta / 1000);
                
                if (distance < Math.max(22, player.size + 6)) {
                    const shouldLevelUp = player.addExp(orb.value);
                    window.sessionExp = (window.sessionExp || 0) + orb.value;
                    if (shouldLevelUp) {
                        gameState.levelUpQueue = (gameState.levelUpQueue || 0) + 1;
                        processLevelQueue();
                    }
                    expOrbs.splice(i, 1);
                    if (window.playSfx) window.playSfx('pickup');
                    continue;
                }
            }
        } else {
            orb.x += (Math.random() - 0.5) * 6 * (delta / 16);
            orb.y += (Math.random() - 0.5) * 6 * (delta / 16);
        }
        if (orb.life <= 0) {
            window.poolManager.releaseExpOrb(expOrbs[i]);
            expOrbs.splice(i, 1);
        }
    }
}

export function updateLootBoxes(delta) {
    for (let i = lootBoxes.length - 1; i >= 0; i--) {
        const box = lootBoxes[i];
        box.life -= delta;
        
        if (player && !box.opened) {
            const distance = Math.hypot(player.x - box.x, player.y - box.y);
            if (distance < player.size + 20) {
                openLootBox(i);
                continue;
            }
        }
        
        if (box.life <= 0) {
            window.poolManager.releaseLootBox(lootBoxes[i]);
            lootBoxes.splice(i, 1);
        }
    }
}

function openLootBox(index) {
    const box = lootBoxes[index];
    if (!box || box.opened) return;
    box.opened = true;
    
    gameState.previousPaused = !!gameState.paused;
    gameState.modalPaused = true;
    gameState.paused = true;
    
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
    
    const handleLootSelection = (item) => {
        item.effect();
        modal.style.display = 'none';
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

function processLevelQueue() {
    if (!gameState.levelUpQueue || gameState.levelUpQueue <= 0) return;
    const modal = document.getElementById('levelUpModal');
    const lootModal = document.getElementById('lootModal');
    if ((modal && modal.style.display === 'flex') || (lootModal && lootModal.style.display === 'flex')) return;

    player.levelUp();
    gameState.levelUpQueue = Math.max(0, gameState.levelUpQueue - 1);
    gameState.previousPaused = !!gameState.paused;
    gameState.paused = true;
    gameState.modalPaused = true;
    showLevelUpModal();
}

function showLevelUpModal() {
    const modal = document.getElementById('levelUpModal');
    const options = document.getElementById('upgradeOptions');
    
    const upgrades = [
        {
            name: 'Health Boost',
            description: 'Increase max health by 25',
            effect: () => { player.increaseMaxHealth(25); }
        },
        {
            name: 'Speed Enhancement',
            description: 'Increase movement speed by 30',
            effect: () => { player.increaseSpeed(30); }
        },
        {
            name: 'Weapon Damage +40%',
            description: 'Increase all weapon damage by 40% (stacks)',
            effect: () => { weaponSystem.upgradeDamage(0.4); }
        },
        {
            name: 'Fire Rate +15%',
            description: 'Reduce weapon cooldown by 15%',
            effect: () => { weaponSystem.upgradeFireRate(0.15); }
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
            effect: () => { player.expMagnet = true; }
        },
        {
            name: 'Critical Hits',
            description: '10% chance to deal double damage',
            effect: () => { weaponSystem.criticalChance = 0.1; }
        },
        {
            name: 'Health Regeneration',
            description: 'Regenerate 1 health per second',
            effect: () => { player.healthRegen = 1; }
        }
    ];
    
    // Add weapon unlock options
    const weaponUnlocks = [
        { name: 'spread', config: window.GAME_CONFIG?.WEAPONS?.SPREAD },
        { name: 'laser', config: window.GAME_CONFIG?.WEAPONS?.LASER }
    ];
    
    weaponUnlocks.forEach(weapon => {
        if (weapon.config && player.level >= weapon.config.unlockLevel && 
            !weaponSystem.activeWeapons.includes(weapon.name)) {
            upgrades.push({
                name: `Unlock ${weapon.config.name}`,
                description: weapon.name === 'spread' ? 'Fires 3 projectiles in a spread pattern' : 'High damage, long range laser weapon',
                effect: () => { weaponSystem.unlockWeapon(weapon.name); }
            });
        }
    });
    
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
            gameState.modalPaused = false;
            gameState.paused = !!gameState.previousPaused;
            delete gameState.previousPaused;
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
        particles.push(window.poolManager.createParticle({
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

function gameOver() {
    gameState.running = false;

    const timeElapsed = Math.floor((performance.now() - gameState.startTime) / 1000);
    const minutes = Math.floor(timeElapsed / 60);
    const seconds = timeElapsed % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    const finalLevelNum = player ? player.level : 0;

    saveHighscore();

    const prog = getPerkState();
    let pointsAwarded = 1;
    const sessionExpValue = window.sessionExp || 0;
    if (sessionExpValue >= 150) pointsAwarded = 3;
    else if (sessionExpValue >= 50) pointsAwarded = 2;
    prog.points = (prog.points || 0) + Math.min(pointsAwarded, 3);
    savePerkState(prog);
    window.sessionExp = 0;

    const runPoints = pointsAwarded;
    const content = `
        <h2>GAME OVER</h2>
        <p>You survived for <span id="finalTimeDisplay">${timeString}</span></p>
        <p>Final Level: <span id="finalLevelDisplay">${finalLevelNum}</span></p>
        <p style="margin-top:8px;color:#cfe;">Perk Points earned this run: <strong>${runPoints}</strong></p>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:12px;">
          <button class="start-btn" id="goMain">MAIN MENU</button>
          <button class="start-btn" id="goRestart">RESTART</button>
        </div>
    `;

    let modal = document.getElementById('gameOverModal');
    if (modal) {
        let modalContent = modal.querySelector('.modal-content');
        if (!modalContent) {
            modalContent = document.createElement('div');
            modalContent.className = 'modal-content';
            modal.appendChild(modalContent);
        }
        modalContent.innerHTML = content;
        modal.style.display = 'flex';

        const goMain = modal.querySelector('#goMain');
        const goRestart = modal.querySelector('#goRestart');
        if (goMain) goMain.addEventListener('click', () => { 
            modal.style.display = 'none'; 
            const ss = document.getElementById('startScreen'); 
            if (ss) ss.style.display = 'flex'; 
            if (window.stopDemo) window.stopDemo(); 
            if (window.startDemo) window.startDemo(); 
        });
        if (goRestart) goRestart.addEventListener('click', () => { location.reload(); });
    }
}

export function updateUI() {
    if (!player) return;
    
    const healthPercent = player.getHealthPercent();
    const healthBar = document.getElementById('healthBar');
    const healthText = document.getElementById('healthText');
    if (healthBar) healthBar.style.width = `${healthPercent}%`;
    if (healthText) healthText.textContent = `${Math.max(0, Math.floor(player.health))}/${player.maxHealth}`;
    
    const playerLevel = document.getElementById('playerLevel');
    const expText = document.getElementById('expText');
    if (playerLevel) playerLevel.textContent = player.level;
    if (expText) expText.textContent = `${player.exp}/${player.expToNext}`;
    
    if (gameState.running) {
        const timeElapsed = Math.floor((performance.now() - gameState.startTime) / 1000);
        const minutes = Math.floor(timeElapsed / 60);
        const seconds = timeElapsed % 60;
        const gameTimer = document.getElementById('gameTimer');
        if (gameTimer) gameTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

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
    
    const strengthCount = Object.keys(s.strength || {}).length;
    if (strengthCount > 0) parts.push(`Dmg +${Math.round((Math.pow(1.2, strengthCount)-1)*100)}%`);
    
    const speedCount = Object.keys(s.speed || {}).length;
    if (speedCount > 0) {
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
    const highscore = document.getElementById('highscore');
    if (highscore) highscore.textContent = `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
}

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

function savePerkState(state) { 
    setCookie('neon_perks', state); 
    const perkPoints = document.getElementById('perkPoints');
    if (perkPoints) perkPoints.textContent = (state.points||0); 
}

export function renderPerkTrees() {
    const container = document.getElementById('perkTrees');
    if (!container) return;
    const state = getPerkState();
    container.innerHTML = '';
    const trees = ['speed','strength','defense'];
    
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
        const title = document.createElement('h3'); 
        title.textContent = t.toUpperCase(); 
        box.appendChild(title);

        for (let i=1;i<=4;i++) {
            const node = document.createElement('div');
            node.className = 'perk-node';
            const owned = !!(state.trees[t] && state.trees[t][i]);
            const prevOwned = (i===1) ? true : !!(state.trees[t] && state.trees[t][i-1]);
            if (!prevOwned && !owned) node.classList.add('locked');

            const label = document.createElement('div');
            label.innerHTML = `<strong>Tier ${i}</strong>`;
            
            const right = document.createElement('div');
            right.style.display = 'flex'; 
            right.style.gap = '8px'; 
            right.style.alignItems = 'center';

            const desc = document.createElement('div');
            desc.className = 'info';
            desc.textContent = perkDefs[t][i].desc;
            desc.title = perkDefs[t][i].effect;

            const btn = document.createElement('button');
            btn.textContent = owned ? 'Owned' : 'Buy';
            btn.disabled = owned || !prevOwned || (state.points <= 0);
            btn.dataset.tree = t; 
            btn.dataset.tier = i;
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                const s = getPerkState();
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

export function showProgression() {
    const modal = document.getElementById('progressionModal');
    if (!modal) return;
    const state = getPerkState();
    const perkPoints = document.getElementById('perkPoints');
    if (perkPoints) perkPoints.textContent = state.points || 0;
    renderPerkTrees();
    modal.style.display = 'flex';
}

// Screen shake and particle functions
export function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        const dt = 16;
        particle.x += particle.dx * (dt / 1000);
        particle.y += particle.dy * (dt / 1000);
        particle.dx *= 0.94;
        particle.dy *= 0.94;
        particle.life -= (dt / 16);
        
        if (particle.life <= 0) {
            window.poolManager.releaseParticle(particles[i]);
            particles.splice(i, 1);
        }
    }
}

export function updateScreenShake(delta) {
    if (gameState.screenShake.time > 0) {
        gameState.screenShake.time -= delta;
        gameState.screenShake.intensity *= 0.9;
    } else {
        gameState.screenShake.intensity = 0;
    }
}

// Expose functions globally
window.startGame = startGame;
window.showProgression = showProgression;
window.renderPerkTrees = renderPerkTrees;
window.updateUI = updateUI;
window.updatePlayer = updatePlayer;
window.updateEnemies = updateEnemies;
window.updateWeapons = updateWeapons;
window.updateProjectiles = updateProjectiles;
window.updateExpOrbs = updateExpOrbs;
window.updateLootBoxes = updateLootBoxes;
window.updateParticles = updateParticles;
window.updateScreenShake = updateScreenShake;
window.spawnEnemy = spawnEnemy;
