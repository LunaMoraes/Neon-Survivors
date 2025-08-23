// Quadtree implementation for spatial partitioning
class Quadtree {
    constructor(bounds, maxObjects = 10, maxLevels = 5, level = 0) {
        this.bounds = bounds; // { x, y, width, height }
        this.maxObjects = maxObjects;
        this.maxLevels = maxLevels;
        this.level = level;
        this.objects = [];
        this.nodes = [];
    }
    
    // Split the node into 4 subnodes
    split() {
        const nextLevel = this.level + 1;
        const subWidth = this.bounds.width / 2;
        const subHeight = this.bounds.height / 2;
        const x = this.bounds.x;
        const y = this.bounds.y;
        
        this.nodes[0] = new Quadtree({ x: x + subWidth, y: y, width: subWidth, height: subHeight }, this.maxObjects, this.maxLevels, nextLevel);
        this.nodes[1] = new Quadtree({ x: x, y: y, width: subWidth, height: subHeight }, this.maxObjects, this.maxLevels, nextLevel);
        this.nodes[2] = new Quadtree({ x: x, y: y + subHeight, width: subWidth, height: subHeight }, this.maxObjects, this.maxLevels, nextLevel);
        this.nodes[3] = new Quadtree({ x: x + subWidth, y: y + subHeight, width: subWidth, height: subHeight }, this.maxObjects, this.maxLevels, nextLevel);
    }
    
    // Determine which node the object belongs to
    getIndex(obj) {
        const verticalMidpoint = this.bounds.x + (this.bounds.width / 2);
        const horizontalMidpoint = this.bounds.y + (this.bounds.height / 2);
        
        const top = obj.y - obj.size < horizontalMidpoint;
        const bottom = obj.y + obj.size > horizontalMidpoint;
        const left = obj.x - obj.size < verticalMidpoint;
        const right = obj.x + obj.size > verticalMidpoint;
        
        let index = -1;
        
        if (top && left) index = 1;
        else if (top && right) index = 0;
        else if (bottom && left) index = 2;
        else if (bottom && right) index = 3;
        
        return index;
    }
    
    // Insert object into the quadtree
    insert(obj) {
        if (this.nodes.length) {
            const index = this.getIndex(obj);
            if (index !== -1) {
                this.nodes[index].insert(obj);
                return;
            }
        }
        
        this.objects.push(obj);
        
        if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
            if (!this.nodes.length) {
                this.split();
            }
            
            let i = 0;
            while (i < this.objects.length) {
                const index = this.getIndex(this.objects[i]);
                if (index !== -1) {
                    this.nodes[index].insert(this.objects.splice(i, 1)[0]);
                } else {
                    i++;
                }
            }
        }
    }
    
    // Retrieve all objects that could collide with the given object
    retrieve(obj) {
        const returnObjects = this.objects.slice();
        
        if (this.nodes.length) {
            const index = this.getIndex(obj);
            if (index !== -1) {
                returnObjects.push(...this.nodes[index].retrieve(obj));
            } else {
                // Object crosses boundaries, check all nodes
                for (const node of this.nodes) {
                    returnObjects.push(...node.retrieve(obj));
                }
            }
        }
        
        return returnObjects;
    }
    
    // Clear the quadtree
    clear() {
        this.objects = [];
        for (const node of this.nodes) {
            node.clear();
        }
        this.nodes = [];
    }
}

// Global quadtree instance
let quadtree = null;

// Initialize quadtree with canvas bounds
function initQuadtree(canvas) {
    quadtree = new Quadtree({
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height
    }, 8, 6);
}

// Update quadtree with current game objects
function updateQuadtree(enemies, projectiles, player) {
    if (!quadtree) return;
    
    quadtree.clear();
    
    // Insert all enemies
    for (const enemy of enemies) {
        quadtree.insert(enemy);
    }
    
    // Insert all projectiles
    for (const projectile of projectiles) {
        quadtree.insert(projectile);
    }
    
    // Insert player
    quadtree.insert(player);
}

// Find potential collisions for an object
function findPotentialCollisions(obj) {
    if (!quadtree) return [];
    return quadtree.retrieve(obj);
}

// Debug: Visualize quadtree (for development)
function debugDrawQuadtree(ctx, tree) {
    if (!tree) return;
    
    ctx.strokeStyle = 'rgba(255, 0, 136, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(tree.bounds.x, tree.bounds.y, tree.bounds.width, tree.bounds.height);
    
    // Draw object counts
    ctx.fillStyle = 'rgba(255, 0, 136, 0.6)';
    ctx.font = '8px Arial';
    ctx.fillText(tree.objects.length.toString(), tree.bounds.x + 2, tree.bounds.y + 10);
    
    // Recursively draw child nodes
    for (const node of tree.nodes) {
        debugDrawQuadtree(ctx, node);
    }
}

// Export for global use
const quadtreeManager = {
    init: initQuadtree,
    update: updateQuadtree,
    findCollisions: findPotentialCollisions,
    debugDraw: (ctxArg) => debugDrawQuadtree(ctxArg || (typeof window !== 'undefined' && window.ctx) || null, quadtree)
};

if (typeof window !== 'undefined') {
    window.quadtreeManager = window.quadtreeManager || quadtreeManager;
}

export default quadtreeManager;
