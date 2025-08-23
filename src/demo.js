import { canvas, enemies, projectiles, setDemoPlayer, clearDemoPlayer, demoPlayer } from './state.js';
import poolManager from './pool.js';

// We'll manage demo-specific state on window.state to avoid circular exports
export function startDemo() {
    if (window._demoRunning) return;
    window._demoRunning = true;

    // create a lightweight demo player
    setDemoPlayer({ x: canvas.width / 2, y: canvas.height / 2, size: 20, color: '#00ff88', invulnerable: false, level: 1 });

    // seed a few enemies immediately
    const pm = poolManager;
    if (pm) {
        for (let i = 0; i < 4; i++) {
            const side = Math.floor(Math.random() * 4);
            let x, y;
            const size = 16 + Math.random() * 12;
            switch(side) {
                case 0: x = Math.random() * canvas.width; y = -size; break;
                case 1: x = canvas.width + size; y = Math.random() * canvas.height; break;
                case 2: x = Math.random() * canvas.width; y = canvas.height + size; break;
                default: x = -size; y = Math.random() * canvas.height; break;
            }
            enemies.push(pm.createEnemy({ x, y, type: 'DRONE', size, speed: 40 + Math.random()*40, health: 20, damage: 6, color: '#ff4466', exp: 2, maxHealth: 20 }));
        }
    }

    // spawn more often so demo is visible
    window._demoInterval = setInterval(() => {
        if (!window._demoRunning) return;
        const pm = poolManager;
        if (!pm) return;
        const side = Math.floor(Math.random() * 4);
        let x, y; const size = 12 + Math.random() * 18;
        switch(side) {
            case 0: x = Math.random() * canvas.width; y = -size; break;
            case 1: x = canvas.width + size; y = Math.random() * canvas.height; break;
            case 2: x = Math.random() * canvas.width; y = canvas.height + size; break;
            default: x = -size; y = Math.random() * canvas.height; break;
        }
        enemies.push(pm.createEnemy({ x, y, type: 'DRONE', size, speed: 40 + Math.random()*60, health: 18 + Math.floor(Math.random()*20), damage: 6, color: '#ff8844', exp: 2, maxHealth: 18 }));
    }, 700);

    // demo tick: move enemies toward demo player and age projectiles
    window._demoTickId = setInterval(() => {
        if (!window._demoRunning) return;
        const dp = demoPlayer;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            if (!dp) continue;
            const dx = dp.x - e.x; const dy = dp.y - e.y; const d = Math.hypot(dx,dy) || 1;
            e.x += (dx/d) * (e.speed * 0.6) * (16/1000);
            e.y += (dy/d) * (e.speed * 0.6) * (16/1000);
            // remove if far off
            if (e.x < -2000 || e.x > canvas.width + 2000 || e.y < -2000 || e.y > canvas.height + 2000) {
                poolManager.releaseEnemy(e);
                enemies.splice(i,1);
            }
        }
        for (let i = projectiles.length - 1; i >= 0; i--) {
            projectiles[i].life -= 50;
            if (projectiles[i].life <= 0) {
                poolManager.releaseProjectile(projectiles[i]);
                projectiles.splice(i,1);
            }
        }
    }, 80);

    // demo RAF for continuous render when no game running
    function demoLoop() {
        if (!window._demoRunning || window.gameState?.running) { window._demoRaf = null; return; }
    // draw via shared render
    if (typeof window.render === 'function') window.render();
        window._demoRaf = requestAnimationFrame(demoLoop);
    }
    if (!window._demoRaf) window._demoRaf = requestAnimationFrame(demoLoop);
}

export function stopDemo() {
    window._demoRunning = false;
    if (window._demoInterval) { clearInterval(window._demoInterval); window._demoInterval = null; }
    if (window._demoTickId) { clearInterval(window._demoTickId); window._demoTickId = null; }
    if (window._demoRaf) { cancelAnimationFrame(window._demoRaf); window._demoRaf = null; }
    clearDemoPlayer();
}

export default { startDemo, stopDemo };
