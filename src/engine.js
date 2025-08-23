import { gameState, canvas, ctx, mouse, enemies, projectiles, particles, expOrbs, lootBoxes, player as playerRef } from './state.js';
import { render } from './render.js';
import { gameLoop } from './updates.js';

// Canvas resize functionality
window.resizeCanvas = function() {
    const container = document.querySelector('.game-container');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    canvas.width = Math.floor(rect.width);
    canvas.height = Math.floor(rect.height);
    
    // Update game state canvas dimensions
    gameState.canvas = { width: canvas.width, height: canvas.height };
};

// Reintroduce missing globals and functionality expected by legacy code
window.getScreenShakeOffset = function() {
    if (!gameState.screenShake || gameState.screenShake.intensity <= 0) return { x: 0, y: 0 };
    const intensity = gameState.screenShake.intensity;
    return { x: (Math.random() - 0.5) * intensity, y: (Math.random() - 0.5) * intensity };
};

// Minimal audio context for playSfx compatibility
try {
    window.audioCtx = window.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    window.sfxGain = window.sfxGain || window.audioCtx.createGain();
    window.sfxGain.connect(window.audioCtx.destination);
    window.sfxGain.gain.value = 0.25;
} catch (e) { /* audio may be blocked */ }

window.playTone = function(freq, duration=0.08, type='sine') {
    if (gameState.muted) return;
    try {
        const o = window.audioCtx.createOscillator();
        const g = window.audioCtx.createGain();
        o.type = type; o.frequency.value = freq; g.gain.value = 0.001;
        o.connect(g); g.connect(window.sfxGain);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.12, window.audioCtx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, window.audioCtx.currentTime + duration);
        o.stop(window.audioCtx.currentTime + duration + 0.02);
    } catch(e) {}
};

window.playSfx = function(name) {
    if (gameState.muted) return;
    switch(name) {
        case 'shoot': window.playTone(900, 0.04, 'square'); break;
        case 'hit': window.playTone(120, 0.12, 'sawtooth'); break;
        case 'pickup': window.playTone(1400, 0.06, 'sine'); break;
        default: window.playTone(800, 0.03, 'sine');
    }
};

// Expose mouse for render module compatibility
window.mouse = mouse;

// Provide lightweight debug overlay used previously
window.showDebug = false;
if (!window.debugOverlay) {
    const debugOverlay = document.createElement('div');
    debugOverlay.id = 'debugOverlay';
    debugOverlay.style.position = 'absolute'; debugOverlay.style.left = '8px'; debugOverlay.style.bottom = '8px';
    debugOverlay.style.padding = '8px 10px'; debugOverlay.style.background = 'rgba(0,0,0,0.6)';
    debugOverlay.style.color = '#fff'; debugOverlay.style.fontFamily = 'monospace'; debugOverlay.style.fontSize = '12px';
    debugOverlay.style.zIndex = 1001; debugOverlay.style.pointerEvents = 'none'; debugOverlay.style.maxWidth = '360px';
    debugOverlay.style.whiteSpace = 'pre-wrap'; debugOverlay.style.display = 'none'; document.body.appendChild(debugOverlay);
    window.debugOverlay = debugOverlay;
}

// Re-expose render and loop for legacy calls
window.render = render;
window.gameLoop = gameLoop;

// Start background demo if main didn't start
window.addEventListener('load', () => {
    // Start the delegated startDemo if present
    if (typeof window.startDemo === 'function') window.startDemo();
});

export default {};
