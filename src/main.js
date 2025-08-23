import './state.js';
import './render.js';
import './updates.js';
import './ui.js';
import { startDemo, stopDemo } from './demo.js';
import { startGame, showProgression, renderPerkTrees } from './gameLogic.js';
import './engine.js';
import './config.js';
import './player.js';
import './weapons.js';
import './pool.js';
import './quadtree.js';

window.addEventListener('load', () => {
    // call any older init code that may rely on globals
    if (typeof window.resizeCanvas === 'function') window.resizeCanvas();

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
