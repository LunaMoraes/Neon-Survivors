import { gameState, canvas, enemies, projectiles, particles, expOrbs, lootBoxes, player as _playerRef, demoPlayer } from './state.js';
import { updatePlayer, updateEnemies, updateWeapons, updateProjectiles, updateExpOrbs, updateLootBoxes, updateParticles, updateScreenShake, updateUI, spawnEnemy } from './gameLogic.js';
import render from './render.js';

export { updatePlayer, updateEnemies, updateWeapons, updateProjectiles, updateExpOrbs, updateLootBoxes, updateParticles, updateScreenShake };

let difficulty = 1;
export function gameLoop(now) {
    if (!gameState.running) return;
    if (!now) now = performance.now();
    const delta = Math.min(60, now - gameState.lastTime);
    gameState.lastTime = now;

    if (!gameState.paused) {
        gameState.elapsed = now - gameState.startTime;
        const minutes = gameState.elapsed / 60000;
        difficulty = 1 + Math.min(minutes * 0.8, 5);
        const spikeFactor = Math.sin(gameState.elapsed / 30000 * Math.PI) * 0.3;
        const levelFactor = Math.max(0.7, 1 - ((window.player?.level || 0) * 0.02));
        const totalDifficulty = difficulty + spikeFactor;

        const baseSpawnRate = window.GAME_CONFIG.SPAWN.BASE_SPAWN_RATE;
        const difficultyScale = window.GAME_CONFIG.SPAWN.DIFFICULTY_SCALE;
        gameState.spawnAccumulator += delta * (baseSpawnRate + totalDifficulty * difficultyScale) * levelFactor;

        const maxSpawns = Math.min(window.GAME_CONFIG.SPAWN.MAX_SPAWNS_PER_FRAME, Math.floor(gameState.spawnAccumulator / window.GAME_CONFIG.SPAWN.SPAWN_ACCUMULATOR_THRESHOLD));
        for (let s = 0; s < maxSpawns; s++) {
            let enemyDifficulty = totalDifficulty;
            if (minutes > 2) enemyDifficulty *= 1.2;
            if (minutes > 5) enemyDifficulty *= 1.5;
            if (typeof window.spawnEnemy === 'function')             spawnEnemy(enemyDifficulty);
            gameState.spawnAccumulator -= window.GAME_CONFIG.SPAWN.SPAWN_ACCUMULATOR_THRESHOLD;
        }

        // call existing updates where implemented
        updatePlayer(delta);
        updateEnemies(delta);
        updateWeapons(delta);
        updateProjectiles(delta);
        updateExpOrbs(delta);
        updateLootBoxes(delta);
        updateParticles(delta);
        updateScreenShake(delta);
    }

    render();
    updateUI();
    if (typeof window.updateDebugOverlay === 'function') window.updateDebugOverlay();

    requestAnimationFrame(gameLoop);
}

// Expose gameLoop globally for compatibility
window.gameLoop = gameLoop;

export default gameLoop;
