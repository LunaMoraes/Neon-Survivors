// Compatibility shim: small trimmed game.js that delegates to src/ modules
(async function(){
    try {
        const stateMod = await import('./src/state.js');
        const renderMod = await import('./src/render.js');
        const updatesMod = await import('./src/updates.js');
        const uiMod = await import('./src/ui.js');
        const demoMod = await import('./src/demo.js');
        // expose commonly-used globals for legacy code that expects them on window
        window.gameState = stateMod.gameState;
        window.canvas = stateMod.canvas;
        window.ctx = stateMod.ctx;
        window.enemies = stateMod.enemies;
        window.projectiles = stateMod.projectiles;
        window.particles = stateMod.particles;
        window.expOrbs = stateMod.expOrbs;
        window.lootBoxes = stateMod.lootBoxes;
        window.player = stateMod.player;
        window.demoPlayer = stateMod.demoPlayer;

        // Delegate core functions to module implementations where available
        window.render = renderMod.render;
        window.gameLoop = updatesMod.gameLoop;
        window.updateUI = uiMod.updateUI;
        window.renderPerkTrees = uiMod.renderPerkTrees;
        window.showProgression = uiMod.showProgression;
        window.startDemo = demoMod.startDemo;
        window.stopDemo = demoMod.stopDemo;

        console.info('game.js trimmed: delegating to src/ modules.');
    } catch (err) {
        console.error('Failed to load src/ modules from trimmed game.js:', err);
    }
})();
