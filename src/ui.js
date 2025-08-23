import { gameState } from './state.js';

export function gameOverUI() {
    if (typeof window.gameOver === 'function' && window.gameOver !== gameOverUI) {
        // if original implementation exists, call it
        return window.gameOver();
    }
}

export function updateUI() {
    if (typeof window.updateUI === 'function') return window.updateUI();
}

export function renderPerkTrees() {
    if (typeof window.renderPerkTrees === 'function') return window.renderPerkTrees();
}

export function showProgression() {
    if (typeof window.showProgression === 'function') return window.showProgression();
}

export default { gameOverUI, updateUI, renderPerkTrees, showProgression };
