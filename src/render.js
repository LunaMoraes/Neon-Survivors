import { ctx, canvas, gameState, enemies, projectiles, expOrbs, lootBoxes, particles, player, demoPlayer, mouse } from './state.js';

export function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const shakeOffset = { x: 0, y: 0 };
    // apply screen shake if present
    if (gameState.screenShake && gameState.screenShake.intensity > 0) {
        const intensity = gameState.screenShake.intensity;
        shakeOffset.x = (Math.random() - 0.5) * intensity;
        shakeOffset.y = (Math.random() - 0.5) * intensity;
    }
    ctx.save(); ctx.translate(shakeOffset.x, shakeOffset.y);

    // Background grid
    if (!gameState.lowGraphics) {
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.08)';
        ctx.lineWidth = 1; const gridSize = 50;
        for (let x = 0; x < canvas.width; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
        for (let y = 0; y < canvas.height; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    }

    // Particles
    if (!gameState.lowGraphics) {
        particles.forEach(particle => {
            const alpha = Math.max(0, particle.life / particle.maxLife);
            ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = particle.color;
            ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        });
    }

    // Projectiles
    projectiles.forEach(projectile => {
        ctx.fillStyle = projectile.color;
        if (!gameState.lowGraphics) { ctx.shadowColor = projectile.color; ctx.shadowBlur = 10; }
        ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.size, 0, Math.PI * 2); ctx.fill();
        if (!gameState.lowGraphics) ctx.shadowBlur = 0;
    });

    // Exp orbs
    expOrbs.forEach(orb => {
        const pulse = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(0, 255, 0, ${0.8 + pulse * 0.2})`;
        ctx.shadowColor = '#00ff00'; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(orb.x, orb.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    });

    // Loot boxes
    lootBoxes.forEach(box => {
        if (box.opened) return;
        ctx.save(); ctx.fillStyle = 'rgba(200,180,60,0.95)'; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.rect(box.x - 12, box.y - 12, 24, 24); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#000'; ctx.font = '10px Orbitron, monospace'; ctx.fillText('E', box.x - 5, box.y + 5); ctx.restore();
    });

    // Enemies (simple draw)
    enemies.forEach(enemy => {
        if (enemy.health < enemy.maxHealth) {
            const barWidth = enemy.size * 2; const barHeight = 4; const healthPercent = enemy.health / enemy.maxHealth;
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'; ctx.fillRect(enemy.x - barWidth/2, enemy.y - enemy.size - 10, barWidth, barHeight);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.8)'; ctx.fillRect(enemy.x - barWidth/2, enemy.y - enemy.size - 10, barWidth * healthPercent, barHeight);
        }
        ctx.fillStyle = enemy.color; if (!gameState.lowGraphics) { ctx.shadowColor = enemy.color; ctx.shadowBlur = 8; }
        ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2); ctx.fill(); if (!gameState.lowGraphics) ctx.shadowBlur = 0;
    });

    // Render player
    const currentPlayer = window.player || player;
    if (currentPlayer && gameState.running) {
        const p = currentPlayer;
        ctx.save();
        
        // Debug: add console log to verify player rendering
        // console.log('Rendering player at:', p.x, p.y, 'size:', p.size);
        
        // Player invulnerability flash effect
        if (p.invulnerable) {
            const flashAlpha = Math.sin(Date.now() * 0.02) * 0.5 + 0.5;
            ctx.globalAlpha = 0.3 + flashAlpha * 0.7;
        }
        
        // Enhanced player visual based on level
        const level = p.level || 1;
        const baseSize = p.size;
        const evolutionStage = Math.min(Math.floor(level / 3), 4); // 0-4 evolution stages
        
        // Core player circle with level-based color evolution
        let playerColor = '#00ff88'; // base green
        if (level >= 15) playerColor = '#ff0088'; // pink at high levels
        else if (level >= 10) playerColor = '#0088ff'; // blue at mid levels
        else if (level >= 5) playerColor = '#88ff00'; // yellow-green at low-mid levels
        
        ctx.fillStyle = playerColor;
        if (!gameState.lowGraphics) {
            ctx.shadowColor = playerColor;
            ctx.shadowBlur = 12 + (level * 0.5); // Stronger glow as level increases
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, baseSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Evolution spikes/punk hair based on level
        if (level >= 2) {
            const spikeCount = Math.min(3 + Math.floor(level / 2), 12); // More spikes as level increases
            const spikeLength = 8 + (level * 0.8);
            const spikeWidth = 3 + (level * 0.2);
            
            ctx.fillStyle = playerColor;
            ctx.shadowBlur = 8;
            
            for (let i = 0; i < spikeCount; i++) {
                const angle = (Math.PI * 2 * i) / spikeCount;
                const spikeX = p.x + Math.cos(angle) * (baseSize + 2);
                const spikeY = p.y + Math.sin(angle) * (baseSize + 2);
                const tipX = spikeX + Math.cos(angle) * spikeLength;
                const tipY = spikeY + Math.sin(angle) * spikeLength;
                
                // Draw spike as triangle
                ctx.beginPath();
                ctx.moveTo(spikeX + Math.cos(angle + Math.PI/2) * spikeWidth/2, 
                          spikeY + Math.sin(angle + Math.PI/2) * spikeWidth/2);
                ctx.lineTo(spikeX + Math.cos(angle - Math.PI/2) * spikeWidth/2, 
                          spikeY + Math.sin(angle - Math.PI/2) * spikeWidth/2);
                ctx.lineTo(tipX, tipY);
                ctx.closePath();
                ctx.fill();
            }
        }
        
        // Inner core that gets brighter with level
        if (level >= 3) {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + (level * 0.02)})`;
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, baseSize * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Pulsing energy ring for high levels
        if (level >= 7) {
            const pulseTime = Date.now() * 0.003;
            const pulseSize = baseSize + 5 + Math.sin(pulseTime) * 3;
            const pulseAlpha = 0.3 + Math.sin(pulseTime * 2) * 0.2;
            
            ctx.strokeStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(p.x, p.y, pulseSize, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Particle trail effect for very high levels
        if (level >= 12) {
            const trailCount = 4;
            for (let i = 0; i < trailCount; i++) {
                const trailAngle = (Date.now() * 0.002) + (i * Math.PI * 2 / trailCount);
                const trailRadius = baseSize + 15;
                const trailX = p.x + Math.cos(trailAngle) * trailRadius;
                const trailY = p.y + Math.sin(trailAngle) * trailRadius;
                
                ctx.fillStyle = `rgba(255, 255, 255, 0.6)`;
                ctx.shadowColor = playerColor;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(trailX, trailY, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        if (!gameState.lowGraphics) ctx.shadowBlur = 0;
        ctx.restore();
        
        // Player health bar
        if (p.health < p.maxHealth) {
            const barWidth = p.size * 2.5;
            const barHeight = 6;
            const healthPercent = p.health / p.maxHealth;
            
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.fillRect(p.x - barWidth/2, p.y - p.size - 20, barWidth, barHeight);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.fillRect(p.x - barWidth/2, p.y - p.size - 20, barWidth * healthPercent, barHeight);
        }
    }
    
    // Render demo player
    if (window._demoPlayer && !gameState.running) {
        const dp = window._demoPlayer;
        ctx.fillStyle = dp.color || '#00ff88';
        if (!gameState.lowGraphics) {
            ctx.shadowColor = dp.color || '#00ff88';
            ctx.shadowBlur = 10;
        }
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, dp.size, 0, Math.PI * 2);
        ctx.fill();
        if (!gameState.lowGraphics) ctx.shadowBlur = 0;
    }

    // Mouse reticle
    if (gameState.running && mouse.x !== undefined && mouse.y !== undefined) {
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 20, 0, Math.PI * 2);
        ctx.stroke();
        
        // Crosshair
        ctx.beginPath();
        ctx.moveTo(mouse.x - 8, mouse.y);
        ctx.lineTo(mouse.x + 8, mouse.y);
        ctx.moveTo(mouse.x, mouse.y - 8);
        ctx.lineTo(mouse.x, mouse.y + 8);
        ctx.stroke();
    }

    ctx.restore();
}

export default render;
