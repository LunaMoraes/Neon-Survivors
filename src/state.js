// Shared state for the game (ES module)
export const gameState = {
    running: false,
    paused: false,
    modalPaused: false,
    levelUpQueue: 0,
    muted: false,
    startTime: 0,
    lastTime: 0,
    elapsed: 0,
    spawnAccumulator: 0,
    lowGraphics: false,
    screenShake: { intensity: 0, duration: 0, time: 0 }
};

import quadtreeManager from './quadtree.js';

export const canvas = document.getElementById('gameCanvas');
export const ctx = canvas.getContext('2d');
// Reticle / mouse state
export let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
// create a reticle element used by the UI/rendering
const reticle = document.createElement('div');
reticle.className = 'reticle';
document.body.appendChild(reticle);

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    reticle.style.left = `${e.clientX}px`;
    reticle.style.top = `${e.clientY}px`;
});
canvas.addEventListener('click', () => {
    // Try to resume audio context on first interaction if present
    if (window.audioCtx && window.audioCtx.state === 'suspended') {
        window.audioCtx.resume().catch(() => {});
    }
});

export let player = null;
export let weaponSystem = null;
export let sessionExp = 0;
export let demoRunning = false;
export let demoInterval = null;
export let demoTickId = null;
export let demoRaf = null;
export let demoPlayer = null;

export const enemies = [];
export const projectiles = [];
export const particles = [];
export const expOrbs = [];
export const lootBoxes = [];

export let keys = {};

export function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (quadtreeManager) quadtreeManager.init(canvas);
}

// initial resize
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Helpers to manage demo player from other modules (keeps exported binding live)
export function setDemoPlayer(obj) { demoPlayer = obj; if (typeof window !== 'undefined' && window._demoPlayer === undefined) window._demoPlayer = obj; }
export function clearDemoPlayer() { if (typeof window !== 'undefined' && window._demoPlayer === demoPlayer) delete window._demoPlayer; demoPlayer = null; }

// Helper to manage main player from other modules
export function setPlayer(obj) { player = obj; if (typeof window !== 'undefined' && window.player === undefined) window.player = obj; }
export function clearPlayer() { if (typeof window !== 'undefined' && window.player === player) delete window.player; player = null; }
