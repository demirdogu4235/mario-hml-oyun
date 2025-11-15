const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const energyFill = document.getElementById('energyFill');
const loadingScreen = document.getElementById('loadingScreen');
const toggleHudBtn = document.getElementById('toggleHud');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');

const DPR = Math.min(window.devicePixelRatio || 1, 2);
canvas.width *= DPR;
canvas.height *= DPR;
ctx.scale(DPR, DPR);
canvas.style.width = `${canvas.width / DPR}px`;
canvas.style.height = `${canvas.height / DPR}px`;

const WORLD = {
    width: canvas.width / DPR,
    height: canvas.height / DPR,
    gravity: 2400,
    friction: 0.84,
};

const TILE_SIZE = 64;

const COLORS = {
    groundDark: '#131528',
    groundMid: '#1b2141',
    groundLight: '#273162',
    accent: '#ff5a8a',
    accentAlt: '#3bf5ff',
    coin: '#ffd15d',
    coinGlow: 'rgba(255, 209, 93, 0.65)',
    shadow: 'rgba(6, 8, 20, 0.9)',
    skyline: 'rgba(35, 45, 87, 0.8)',
    tileGloss: 'rgba(255, 255, 255, 0.08)'
};

const LEVEL = {
    tiles: [
        '........................................................',
        '........................................................',
        '........................................................',
        '........................................................',
        '.................s......................................',
        '......ss...............ss...............s...............',
        '..............====...................====...............',
        '..........====.................====.....................',
        '###############################################====#####',
    ],
    decorations: [
        { x: 120, height: 140, width: 80 },
        { x: 340, height: 200, width: 120 },
        { x: 680, height: 170, width: 110 },
        { x: 1020, height: 230, width: 140 },
        { x: 1360, height: 185, width: 120 },
    ],
    coins: [
        { x: 460, y: 280 },
        { x: 520, y: 220 },
        { x: 580, y: 280 },
        { x: 940, y: 280 },
        { x: 1000, y: 220 },
        { x: 1060, y: 280 },
        { x: 1320, y: 240 },
        { x: 1380, y: 180 },
        { x: 1440, y: 240 },
    ],
    stars: 64
};

const KEY_BINDINGS = {
    left: ['ArrowLeft', 'a', 'A'],
    right: ['ArrowRight', 'd', 'D'],
    jump: ['ArrowUp', 'w', 'W', ' '],
    sprint: ['Shift'],
    reset: ['r', 'R']
};

const inputState = new Map();

window.addEventListener('keydown', (event) => {
    inputState.set(event.key, true);
});

window.addEventListener('keyup', (event) => {
    inputState.set(event.key, false);
});

class Camera {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.x = 0;
        this.target = null;
    }

    follow(target) {
        this.target = target;
    }

    update() {
        if (!this.target) return;
        const marginX = this.width * 0.35;
        const desiredX = this.target.position.x - marginX;
        this.x += (desiredX - this.x) * 0.08;
        this.x = Math.max(0, Math.min(this.x, LEVEL.tiles[0].length * TILE_SIZE - this.width));
    }
}

class Particle {
    constructor(x, y, vx, vy, life, color, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += WORLD.gravity * 0.35 * dt;
        this.life -= dt;
    }

    draw(ctx, cameraX) {
        const alpha = Math.max(this.life / this.maxLife, 0);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x - cameraX, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    emit({ x, y, spread = 16, count = 6, baseVY = -400, color = COLORS.accent, size = 4 }) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI - Math.PI / 2;
            const speed = 220 + Math.random() * 140;
            this.particles.push(new Particle(
                x + (Math.random() - 0.5) * spread,
                y + (Math.random() - 0.5) * spread,
                Math.cos(angle) * speed,
                baseVY + Math.sin(angle) * speed,
                0.35 + Math.random() * 0.25,
                color,
                size * (0.8 + Math.random() * 0.4)
            ));
        }
    }

    update(dt) {
        this.particles = this.particles.filter((particle) => {
            particle.update(dt);
            return particle.life > 0;
        });
    }

    draw(ctx, cameraX) {
        this.particles.forEach((particle) => particle.draw(ctx, cameraX));
    }
}

class Sprite {
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }

    drawIdle(ctx, x, y) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = '#0d0f1c';
        ctx.beginPath();
        pathRoundedRect(ctx, -this.width / 2, -this.height, this.width, this.height, 12);
        ctx.fill();
        ctx.fillStyle = '#ffcd6b';
        ctx.fillRect(-this.width / 2 + 8, -this.height + 12, this.width - 16, this.height - 20);
        ctx.fillStyle = COLORS.accent;
        ctx.fillRect(-this.width / 2 + 4, -this.height + 12, this.width - 8, 26);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-this.width / 4, -this.height + 18, this.width / 2, 12);
        ctx.fillStyle = '#ff2d55';
        ctx.fillRect(-this.width / 4, -this.height + 34, this.width / 2, 12);
        ctx.fillStyle = '#1b2141';
        ctx.fillRect(-this.width / 2 + 8, -12, this.width - 16, 12);
        ctx.fillStyle = '#3bf5ff';
        ctx.fillRect(-this.width / 2 + 14, -10, this.width - 28, 8);
        ctx.restore();
    }

    drawRun(ctx, x, y, phase) {
        ctx.save();
        ctx.translate(x, y);
        const bob = Math.sin(phase * 2) * 4;
        ctx.translate(0, bob);
        ctx.fillStyle = '#0d0f1c';
        ctx.beginPath();
        pathRoundedRect(ctx, -this.width / 2, -this.height, this.width, this.height, 12);
        ctx.fill();
        ctx.fillStyle = '#ffcd6b';
        ctx.fillRect(-this.width / 2 + 6, -this.height + 10, this.width - 12, this.height - 18);
        ctx.fillStyle = COLORS.accent;
        ctx.fillRect(-this.width / 2 + 2, -this.height + 12, this.width - 4, 22);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-this.width / 4, -this.height + 18, this.width / 2, 10);
        ctx.fillStyle = '#0d0f1c';
        ctx.fillRect(-this.width / 2 + 6, -16, this.width - 12, 16);
        ctx.fillStyle = '#3bf5ff';
        ctx.fillRect(-this.width / 2 + 12, -14, this.width - 24, 10);

        ctx.fillStyle = '#1b2141';
        const legOffset = Math.sin(phase * 6) * 10;
        ctx.fillRect(-this.width / 2 + 10 + legOffset, -8, 16, 12);
        ctx.fillRect(this.width / 2 - 26 + -legOffset, -8, 16, 12);
        ctx.restore();
    }

    drawJump(ctx, x, y) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = '#0d0f1c';
        ctx.beginPath();
        pathRoundedRect(ctx, -this.width / 2, -this.height, this.width, this.height, 12);
        ctx.fill();
        ctx.fillStyle = COLORS.accent;
        ctx.fillRect(-this.width / 2 + 4, -this.height + 12, this.width - 8, 28);
        ctx.fillStyle = '#ffcd6b';
        ctx.fillRect(-this.width / 2 + 6, -this.height + 16, this.width - 12, this.height - 24);
        ctx.fillStyle = '#3bf5ff';
        ctx.fillRect(-this.width / 2 + 12, -18, this.width - 24, 12);
        ctx.restore();
    }
}

const sprite = new Sprite(48, 64);

class Player {
    constructor(x, y) {
        this.position = { x, y };
        this.velocity = { x: 0, y: 0 };
        this.width = 38;
        this.height = 60;
        this.speed = 560;
        this.jumpStrength = 840;
        this.doubleJumpStrength = 720;
        this.maxJumps = 2;
        this.jumpCount = 0;
        this.onGround = false;
        this.facing = 1;
        this.energy = 1;
        this.animationTime = 0;
    }

    get hitbox() {
        return {
            left: this.position.x - this.width / 2,
            right: this.position.x + this.width / 2,
            top: this.position.y - this.height,
            bottom: this.position.y
        };
    }

    handleInput(dt) {
        const movingLeft = KEY_BINDINGS.left.some((key) => inputState.get(key));
        const movingRight = KEY_BINDINGS.right.some((key) => inputState.get(key));
        const sprinting = KEY_BINDINGS.sprint.some((key) => inputState.get(key));

        const direction = (movingRight ? 1 : 0) - (movingLeft ? 1 : 0);
        this.velocity.x += direction * this.speed * dt * (sprinting ? 1.25 : 1);

        if (direction !== 0) {
            this.facing = direction;
        }

        const hasJump = KEY_BINDINGS.jump.some((key) => inputState.get(key));

        if (hasJump && this.canJump) {
            this.jump();
        }

        if (!hasJump) {
            this.jumpBuffered = false;
        }

        if (sprinting) {
            this.energy = Math.max(0, this.energy - dt * 0.25);
        } else {
            this.energy = Math.min(1, this.energy + dt * 0.35);
        }
    }

    get canJump() {
        if (this.jumpBuffered) return false;
        if (this.onGround) return true;
        return this.jumpCount < this.maxJumps;
    }

    jump() {
        this.velocity.y = -(this.jumpCount === 0 ? this.jumpStrength : this.doubleJumpStrength);
        this.jumpCount++;
        this.onGround = false;
        this.jumpBuffered = true;
        particles.emit({
            x: this.position.x,
            y: this.position.y,
            spread: 20,
            count: 12,
            baseVY: -600,
            color: COLORS.accentAlt,
            size: 3.5
        });
    }

    applyPhysics(dt) {
        this.velocity.x *= Math.pow(WORLD.friction, dt * 60);
        this.velocity.y += WORLD.gravity * dt;

        const sprinting = KEY_BINDINGS.sprint.some((key) => inputState.get(key));
        const maxSpeed = sprinting ? 420 : 320;
        this.velocity.x = Math.max(-maxSpeed, Math.min(maxSpeed, this.velocity.x));
    }

    resolveCollisions(axis, dt) {
        const { left, right, top, bottom } = this.hitbox;
        const startX = Math.floor(left / TILE_SIZE);
        const endX = Math.floor(right / TILE_SIZE);
        const startY = Math.floor(top / TILE_SIZE);
        const endY = Math.floor(bottom / TILE_SIZE);

        let corrected = false;

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const tile = getTile(x, y);
                if (!tile || tile === '.') continue;
                const tileRect = {
                    left: x * TILE_SIZE,
                    right: x * TILE_SIZE + TILE_SIZE,
                    top: y * TILE_SIZE,
                    bottom: y * TILE_SIZE + TILE_SIZE
                };

                if (tile === '=' || tile === 's') {
                    tileRect.left += 10;
                    tileRect.right -= 10;
                    tileRect.top = y * TILE_SIZE + 16;
                    tileRect.bottom = tileRect.top + TILE_SIZE / 3;
                }

                if (!rectanglesOverlap(this.hitbox, tileRect)) continue;

                if (axis === 'x') {
                    if (this.velocity.x > 0) {
                        this.position.x = tileRect.left - this.width / 2;
                    } else if (this.velocity.x < 0) {
                        this.position.x = tileRect.right + this.width / 2;
                    }
                    this.velocity.x = 0;
                    corrected = true;
                } else {
                    if (this.velocity.y > 0) {
                        this.position.y = tileRect.top;
                        this.velocity.y = 0;
                        this.onGround = true;
                        this.jumpCount = 0;
                    } else if (this.velocity.y < 0) {
                        this.position.y = tileRect.bottom + this.height;
                        this.velocity.y = 0;
                    }
                    corrected = true;
                }
            }
        }

        return corrected;
    }

    update(dt) {
        this.onGround = false;
        this.handleInput(dt);
        this.applyPhysics(dt);

        this.position.x += this.velocity.x * dt;
        this.resolveCollisions('x', dt);

        this.position.y += this.velocity.y * dt;
        const collidedY = this.resolveCollisions('y', dt);
        if (!collidedY) {
            this.onGround = false;
        }

        this.animationTime += dt;
    }

    draw(ctx, cameraX) {
        const drawX = this.position.x - cameraX;
        const drawY = this.position.y;
        if (this.onGround) {
            const moving = Math.abs(this.velocity.x) > 15;
            if (moving) {
                sprite.drawRun(ctx, drawX, drawY, this.animationTime);
            } else {
                sprite.drawIdle(ctx, drawX, drawY);
            }
        } else {
            sprite.drawJump(ctx, drawX, drawY);
        }

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(drawX, drawY - 30, 10, drawX, drawY - 30, 120);
        glow.addColorStop(0, 'rgba(59, 245, 255, 0.25)');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(drawX - 120, drawY - 150, 240, 220);
        ctx.restore();
    }
}

class Coin {
    constructor(x, y) {
        this.baseX = x;
        this.baseY = y;
        this.radius = 18;
        this.collected = false;
        this.time = Math.random() * Math.PI * 2;
    }

    get hitbox() {
        return {
            left: this.baseX - this.radius,
            right: this.baseX + this.radius,
            top: this.baseY - this.radius,
            bottom: this.baseY + this.radius,
        };
    }

    update(dt) {
        this.time += dt * 2.4;
    }

    draw(ctx, cameraX) {
        if (this.collected) return;
        const floatOffset = Math.sin(this.time) * 12;
        const x = this.baseX - cameraX;
        const y = this.baseY + floatOffset;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(this.time * 1.8) * 0.4);
        ctx.scale(1 + Math.sin(this.time * 1.3) * 0.05, 1);

        const gradient = ctx.createLinearGradient(-this.radius, 0, this.radius, 0);
        gradient.addColorStop(0, '#fff6c5');
        gradient.addColorStop(0.4, COLORS.coin);
        gradient.addColorStop(0.6, '#f4b842');
        gradient.addColorStop(1, '#fff6c5');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius, this.radius * 0.82, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.stroke();

        ctx.restore();

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 64);
        glow.addColorStop(0, COLORS.coinGlow);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(x - 64, y - 64, 128, 128);
        ctx.restore();
    }
}

function rectanglesOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function pathRoundedRect(ctx, x, y, width, height, radius = 8) {
    const r = Math.min(radius, width / 2, height / 2);
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, width, height, r);
        return;
    }

    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
}

function getTile(x, y) {
    if (y < 0 || y >= LEVEL.tiles.length) return '.';
    if (x < 0 || x >= LEVEL.tiles[0].length) return '.';
    return LEVEL.tiles[y].charAt(x);
}

function drawTile(ctx, tile, x, y, cameraX) {
    const drawX = x * TILE_SIZE - cameraX;
    const drawY = y * TILE_SIZE;

    const gradient = ctx.createLinearGradient(drawX, drawY, drawX, drawY + TILE_SIZE);
    gradient.addColorStop(0, COLORS.groundLight);
    gradient.addColorStop(0.35, COLORS.groundMid);
    gradient.addColorStop(1, COLORS.groundDark);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    pathRoundedRect(ctx, drawX + 2, drawY + 2, TILE_SIZE - 4, TILE_SIZE - 4, 12);
    ctx.fill();

    ctx.fillStyle = COLORS.tileGloss;
    ctx.fillRect(drawX + 6, drawY + 4, TILE_SIZE - 12, 6);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(drawX + 10, drawY + TILE_SIZE - 12, TILE_SIZE - 20, 8);
}

function drawPlatform(ctx, x, y, cameraX) {
    const drawX = x * TILE_SIZE - cameraX;
    const drawY = y * TILE_SIZE;
    const width = TILE_SIZE;
    const height = TILE_SIZE / 3;

    const gradient = ctx.createLinearGradient(drawX, drawY, drawX, drawY + height);
    gradient.addColorStop(0, COLORS.accentAlt);
    gradient.addColorStop(1, '#182447');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    pathRoundedRect(ctx, drawX + 10, drawY + 16, width - 20, height, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(drawX + 16, drawY + 18, width - 32, 6);
}

function drawSkyline(ctx, cameraX) {
    ctx.save();
    ctx.translate(-cameraX * 0.25, 0);
    ctx.fillStyle = COLORS.skyline;

    LEVEL.decorations.forEach((building, index) => {
        const parallaxX = building.x;
        const base = WORLD.height - TILE_SIZE * 1.5;
        ctx.fillRect(parallaxX, base - building.height, building.width, building.height);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        for (let i = 0; i < Math.floor(building.height / 24); i++) {
            const windowY = base - building.height + 12 + i * 24;
            for (let j = 0; j < Math.floor(building.width / 22); j++) {
                if ((i + j + index) % 3 === 0) {
                    ctx.fillRect(parallaxX + 6 + j * 22, windowY, 12, 18);
                }
            }
        }
        ctx.fillStyle = COLORS.skyline;
    });
    ctx.restore();
}

function drawStars(ctx, stars, elapsed, cameraX) {
    ctx.save();
    ctx.translate(-cameraX * 0.15, 0);
    ctx.fillStyle = '#ffffff';
    stars.forEach((star, index) => {
        const twinkle = Math.sin(elapsed * 2 + index) * 0.5 + 0.5;
        ctx.globalAlpha = 0.4 + twinkle * 0.6;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size + twinkle * 1.5, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
    ctx.globalAlpha = 1;
}

function drawBackgroundGradient(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    gradient.addColorStop(0, '#171c4f');
    gradient.addColorStop(0.4, '#090d24');
    gradient.addColorStop(1, '#05060f');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
}

function createStars(count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
        stars.push({
            x: Math.random() * LEVEL.tiles[0].length * TILE_SIZE,
            y: Math.random() * WORLD.height * 0.65,
            size: Math.random() * 1.6 + 0.4,
        });
    }
    return stars;
}

function detectCoinCollection(player, coins) {
    coins.forEach((coin) => {
        if (coin.collected) return;
        if (rectanglesOverlap(player.hitbox, coin.hitbox)) {
            coin.collected = true;
            gameState.score += 200;
            particles.emit({
                x: coin.baseX,
                y: coin.baseY,
                spread: 30,
                count: 14,
                baseVY: -420,
                color: COLORS.coin,
                size: 3
            });
        }
    });
}

const stars = createStars(LEVEL.stars);
const coins = LEVEL.coins.map(({ x, y }) => new Coin(x, y));
const player = new Player(160, WORLD.height - TILE_SIZE * 2);
const camera = new Camera(WORLD.width, WORLD.height);
const particles = new ParticleSystem();
camera.follow(player);

const gameState = {
    startTime: performance.now(),
    elapsed: 0,
    paused: false,
    score: 0,
    lastUpdate: performance.now(),
};

let hudHidden = false;

function resetGame() {
    player.position.x = 160;
    player.position.y = WORLD.height - TILE_SIZE * 2;
    player.velocity.x = 0;
    player.velocity.y = 0;
    player.energy = 1;
    player.jumpCount = 0;
    player.onGround = false;
    coins.forEach((coin) => (coin.collected = false));
    gameState.score = 0;
    gameState.startTime = performance.now();
}

function updateUI() {
    scoreEl.textContent = gameState.score.toString().padStart(4, '0');
    timerEl.textContent = (gameState.elapsed / 1000).toFixed(1);
    energyFill.style.transform = `scaleX(${player.energy.toFixed(2)})`;
}

function update(dt) {
    player.update(dt);
    detectCoinCollection(player, coins);
    coins.forEach((coin) => coin.update(dt));
    particles.update(dt);
    camera.update();
}

function draw() {
    drawBackgroundGradient(ctx);
    drawStars(ctx, stars, gameState.elapsed / 1000, camera.x);
    drawSkyline(ctx, camera.x);

    ctx.save();
    ctx.translate(0, -12);
    for (let y = 0; y < LEVEL.tiles.length; y++) {
        for (let x = 0; x < LEVEL.tiles[y].length; x++) {
            const tile = LEVEL.tiles[y].charAt(x);
            if (tile === '#') {
                drawTile(ctx, tile, x, y, camera.x);
            } else if (tile === '=') {
                drawPlatform(ctx, x, y, camera.x);
            } else if (tile === 's') {
                drawPlatform(ctx, x, y, camera.x);
            }
        }
    }
    ctx.restore();

    coins.forEach((coin) => coin.draw(ctx, camera.x));
    player.draw(ctx, camera.x);
    particles.draw(ctx, camera.x);

    drawForegroundGlow();
}

function drawForegroundGlow() {
    const gradient = ctx.createLinearGradient(0, WORLD.height - 120, 0, WORLD.height);
    gradient.addColorStop(0, 'rgba(59, 245, 255, 0)');
    gradient.addColorStop(1, 'rgba(59, 245, 255, 0.22)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, WORLD.height - 120, WORLD.width, 120);
}

function loop(timestamp) {
    if (!gameState.paused) {
        const delta = (timestamp - gameState.lastUpdate) / 1000;
        gameState.elapsed = timestamp - gameState.startTime;
        update(Math.min(delta, 0.033));
        updateUI();
        draw();
    }

    gameState.lastUpdate = timestamp;
    requestAnimationFrame(loop);
}

function togglePause(pause) {
    gameState.paused = pause;
    if (pause) {
        pauseBtn.classList.add('btn--primary');
        resumeBtn.classList.remove('btn--primary');
    } else {
        resumeBtn.classList.add('btn--primary');
        pauseBtn.classList.remove('btn--primary');
    }
}

KEY_BINDINGS.reset.forEach((key) => {
    window.addEventListener('keydown', (event) => {
        if (event.key === key) {
            resetGame();
        }
    });
});

toggleHudBtn.addEventListener('click', () => {
    hudHidden = !hudHidden;
    document.querySelector('.header__meta').style.display = hudHidden ? 'none' : 'flex';
});

pauseBtn.addEventListener('click', () => togglePause(true));
resumeBtn.addEventListener('click', () => togglePause(false));

window.addEventListener('blur', () => togglePause(true));
window.addEventListener('focus', () => togglePause(false));

setTimeout(() => {
    loadingScreen.style.display = 'none';
}, 2600);

requestAnimationFrame(loop);
