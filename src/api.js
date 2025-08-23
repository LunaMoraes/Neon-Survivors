// Centralized module API facade
import './config.js';
import './engine.js';
import * as state from './state.js';
import render from './render.js';
import gameLoop, * as updates from './updates.js';
import * as gameLogic from './gameLogic.js';
import * as ui from './ui.js';
import poolManager from './pool.js';
import quadtreeManager from './quadtree.js';
import Player, { Player as PlayerClass } from './player.js';
import GAME_CONFIG from './config.js';
import WeaponSystem from './weapons.js';
import demo from './demo.js';

// Build a compact Game API surface for consistent imports
export const Game = {
    // State and canvas
    state: state.gameState,
    canvas: state.canvas,
    ctx: state.ctx,

    // Core systems
    render: render,
    gameLoop: gameLoop,
    startGame: gameLogic.startGame,
    spawnEnemy: gameLogic.spawnEnemy,
    showProgression: gameLogic.showProgression,
    renderPerkTrees: gameLogic.renderPerkTrees,
    updateUI: gameLogic.updateUI,

    // Managers & factories
    pool: poolManager,
    quadtree: quadtreeManager,

    // Classes
    Player: PlayerClass || Player,
    WeaponSystem: WeaponSystem,

    // Demo
    startDemo: demo.startDemo,
    stopDemo: demo.stopDemo,

    // config
    config: (window.GAME_CONFIG || GAME_CONFIG)
};

// Backwards-compatible minimal window facade
if (typeof window !== 'undefined') {
    window.Game = window.Game || Game;
    // Do not overwrite existing globals if present
    window.startGame = window.startGame || Game.startGame;
    window.render = window.render || Game.render;
    window.gameLoop = window.gameLoop || Game.gameLoop;
    window.poolManager = window.poolManager || Game.pool;
    window.quadtreeManager = window.quadtreeManager || Game.quadtree;
}

export default Game;
