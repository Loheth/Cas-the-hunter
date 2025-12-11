// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    initializeGame();
});

// Game Canvas Setup
let canvas;
let ctx;

// Function to resize canvas to fullscreen
function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Regenerate stars to fill new canvas size
    const starCount = Math.floor((canvas.width * canvas.height) / 5000);
    // Only regenerate if count changed or stars array is empty
    if (stars.length === 0 || stars.length !== starCount) {
        stars = [];
        for (let i = 0; i < starCount; i++) {
            stars.push(new Star());
        }
    }
    
    // Reposition player if game is playing
    if (player && gameState === 'playing') {
        player.x = Math.min(player.x, canvas.width - player.width);
        player.y = Math.min(player.y, canvas.height - player.height);
    }
}

// Game State
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let score = 0;
let lives = 3;
let gameSpeed = 1;
let timeRemaining = 120; // 2 minutes in seconds
let timerInterval = null;
let currentDefenseTool = 'antivirus'; // 'antivirus', 'backup', 'firewall'
let gunLocked = false; // Ransomware locks gun
let gunLockTimer = 0; // Timer for gun lock duration
let gameSlowed = false; // Virus slows game
let gameSlowTimer = 0; // Timer for game slowdown duration

// Game Objects (declare early for resize function)
let stars = [];
let player;
let enemies = [];
let bullets = [];
let enemyBullets = [];

function initializeGame() {
    // Get canvas and context
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }
    ctx = canvas.getContext('2d');
    
    // Get UI elements
    startScreen = document.getElementById('startScreen');
    gameOverScreen = document.getElementById('gameOver');
    startBtn = document.getElementById('startBtn');
    restartBtn = document.getElementById('restartBtn');
    scoreDisplay = document.getElementById('score');
    livesDisplay = document.getElementById('lives');
    finalScoreDisplay = document.getElementById('finalScore');
    timerDisplay = document.getElementById('timer');
    bulletColorDisplay = document.getElementById('bulletColor');
    
    // Get new UI elements
    const healthProgress = document.getElementById('healthProgress');
    const healthValue = document.getElementById('healthValue');
    const weaponDisplay = document.getElementById('weaponDisplay');
    const statusMessages = document.getElementById('statusMessages');
    const weaponSlots = document.querySelectorAll('.weapon-slot');
    
    // Store references for updateUI function
    window.healthProgress = healthProgress;
    window.healthValue = healthValue;
    window.weaponDisplay = weaponDisplay;
    window.statusMessages = statusMessages;
    
    // Add weapon selection click handlers (if weapon panel exists)
    if (weaponSlots && weaponSlots.length > 0) {
        weaponSlots.forEach(slot => {
            slot.addEventListener('click', () => {
                const weapon = slot.getAttribute('data-weapon');
                if (weapon === 'antivirus') {
                    currentDefenseTool = 'antivirus';
                } else if (weapon === 'backup') {
                    currentDefenseTool = 'backup';
                } else if (weapon === 'firewall') {
                    currentDefenseTool = 'firewall';
                }
                updateUI();
            });
        });
    }
    
    // Name input modal elements
    const nameInputModal = document.getElementById('nameInputModal');
    const playerNameInput = document.getElementById('playerNameInput');
    const submitNameBtn = document.getElementById('submitNameBtn');
    
    // Handle name submission
    function submitName() {
        let playerName = playerNameInput.value.trim().toUpperCase();
        if (!playerName) {
            playerName = 'ANONYMOUS';
        }
        if (playerName.length > 20) {
            playerName = playerName.substring(0, 20);
        }
        
        // Save score with name
        saveScore(score, playerName);
        updateLeaderboardDisplay(score);
        
        // Hide modal and show game over screen
        nameInputModal.classList.remove('show');
        gameOverScreen.classList.add('show');
        
        // Clear input for next time
        playerNameInput.value = '';
    }
    
    if (submitNameBtn) {
        submitNameBtn.addEventListener('click', submitName);
    }
    
    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitName();
            }
        });
    }
    
    // Attach event listeners
    if (startBtn) {
        startBtn.addEventListener('click', startGame);
    } else {
        console.error('Start button not found!');
    }
    
    if (restartBtn) {
        restartBtn.addEventListener('click', startGame);
    } else {
        console.error('Restart button not found!');
    }
    
    // Set initial size and handle window resize
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Attach canvas mouse move handler
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });
    
    // Initialize stars
    init();
    
    // Initialize leaderboard display
    updateLeaderboardDisplay(0);
}

// Input Handling
const keys = {};
let mouseX = 0;
let mouseY = 0;

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') {
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Canvas mouse move handler (will be attached in initializeGame)

// UI Elements (will be initialized in initializeGame)
let startScreen;
let gameOverScreen;
let startBtn;
let restartBtn;
let scoreDisplay;
let livesDisplay;
let finalScoreDisplay;
let timerDisplay;
let bulletColorDisplay;

// Star Background
class Star {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2;
        this.speed = Math.random() * 2 + 0.5;
    }

    update() {
        this.y += this.speed * gameSpeed;
        if (this.y > canvas.height) {
            this.y = 0;
            this.x = Math.random() * canvas.width;
        }
    }

    draw() {
        // Subtle green terminal-like stars
        ctx.fillStyle = 'rgba(0, 255, 65, 0.6)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Player Ship
class Player {
    constructor() {
        this.width = 40;
        this.height = 40;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - this.height - 20;
        this.speed = 5;
        this.shootCooldown = 0;
        this.maxCooldown = 15;
    }

    update() {
        // Movement
        if (keys['w'] || keys['arrowup']) {
            this.y = Math.max(0, this.y - this.speed);
        }
        if (keys['s'] || keys['arrowdown']) {
            this.y = Math.min(canvas.height - this.height, this.y + this.speed);
        }
        if (keys['a'] || keys['arrowleft']) {
            this.x = Math.max(0, this.x - this.speed);
        }
        if (keys['d'] || keys['arrowright']) {
            this.x = Math.min(canvas.width - this.width, this.x + this.speed);
        }

        // Defense tool switching (1 = antivirus, 2 = backup, 3 = firewall)
        let toolChanged = false;
        if (keys['1']) {
            if (currentDefenseTool !== 'antivirus') {
                currentDefenseTool = 'antivirus';
                toolChanged = true;
            }
        }
        if (keys['2']) {
            if (currentDefenseTool !== 'backup') {
                currentDefenseTool = 'backup';
                toolChanged = true;
            }
        }
        if (keys['3']) {
            if (currentDefenseTool !== 'firewall') {
                currentDefenseTool = 'firewall';
                toolChanged = true;
            }
        }
        if (toolChanged) {
            updateUI();
        }

        // Shooting (disabled if gun is locked by ransomware)
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        }
        if ((keys[' '] || keys['space']) && this.shootCooldown === 0 && !gunLocked) {
            bullets.push(new Bullet(this.x + this.width / 2, this.y, 'player', currentDefenseTool));
            this.shootCooldown = this.maxCooldown;
        }
    }

    draw() {
        // Defense system (player) - green cybersecurity theme
        ctx.fillStyle = '#00ff41';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height - 10);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.closePath();
        ctx.fill();

        // Glow effect
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ff41';
        ctx.fill();
        ctx.shadowBlur = 0;

        // System indicator
        ctx.fillStyle = '#00ff41';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// Enemy Ship (Malware)
class Enemy {
    constructor(options = {}) {
        // Randomly assign one of three malware types: Virus, Ransomware, or Worm
        // Unless specified in options (for split worms)
        const malwareTypes = ['Virus', 'Ransomware', 'Worm'];
        this.type = options.type || malwareTypes[Math.floor(Math.random() * malwareTypes.length)];
        
        // Track if this is a split worm (smaller size)
        this.isSplit = options.isSplit || false;
        
        // Set properties based on malware type
        if (this.type === 'Virus') {
            // Virus: Red Arrow/Triangle, fastest speed, straight fall
            this.width = 30;
            this.height = 30;
            this.color = '#ff3333';
            this.speed = Math.random() * 1.5 + 2.5; // Fastest: 2.5-4.0
            this.originalSpeed = this.speed;
            this.movementPattern = 'straight';
        } else if (this.type === 'Ransomware') {
            // Ransomware: Yellow large square, slowest speed, straight fall
            this.width = 45;
            this.height = 45;
            this.color = '#ffff00';
            this.speed = Math.random() * 0.5 + 0.8; // Slowest: 0.8-1.3
            this.originalSpeed = this.speed;
            this.movementPattern = 'straight';
            this.flashCounter = 0;
            this.isFlashing = false;
        } else if (this.type === 'Worm') {
            // Worm: Green circular or segmented shape, sine wave movement
            // If split, make smaller and slower
            const baseSize = this.isSplit ? 20 : 35;
            this.width = baseSize;
            this.height = baseSize;
            this.color = '#00ff41';
            // Normal worms: original speed (1.5-2.5), Split worms: slower (0.5-1.0)
            this.speed = this.isSplit ? (Math.random() * 0.5 + 0.5) : (Math.random() * 1 + 1.5);
            this.originalSpeed = this.speed;
            this.movementPattern = 'sine';
            // Smaller amplitude for split worms
            this.amplitude = this.isSplit ? 20 : 30;
            this.time = options.time || 0;
            // Set originalX with some margin for sine wave movement
            const margin = this.amplitude + 10;
            if (options.x !== undefined) {
                // Use provided x position (for split worms)
                this.originalX = options.x;
            } else {
                this.originalX = margin + Math.random() * (canvas.width - this.width - 2 * margin);
            }
        }
        
        // Set position (use provided position for split worms, otherwise random)
        this.x = options.x !== undefined ? options.x : (this.type === 'Worm' ? this.originalX : Math.random() * (canvas.width - this.width));
        this.y = options.y !== undefined ? options.y : -this.height;
        this.shootCooldown = Math.random() * 100 + 50;
        this.maxCooldown = Math.random() * 100 + 100;
    }

    update() {
        // Update movement based on pattern
        if (this.movementPattern === 'straight') {
            this.y += this.speed * gameSpeed;
        } else if (this.movementPattern === 'sine') {
            // Sine wave pattern: x = originalX + Math.sin(time) * amplitude
            this.time += 0.1;
            const newX = this.originalX + Math.sin(this.time) * this.amplitude;
            // Keep within screen bounds
            this.x = Math.max(0, Math.min(newX, canvas.width - this.width));
            this.y += this.speed * gameSpeed;
        }
        
        // Update flash counter for Ransomware
        if (this.type === 'Ransomware') {
            this.flashCounter++;
            // Toggle flash every 5 frames
            if (this.flashCounter % 5 === 0) {
                this.isFlashing = !this.isFlashing;
            }
        }
        
        this.shootCooldown--;

        // Enemy shooting
        if (this.shootCooldown <= 0 && Math.random() < 0.02) {
            enemyBullets.push(new Bullet(this.x + this.width / 2, this.y + this.height, 'enemy'));
            this.shootCooldown = this.maxCooldown;
        }
    }

    draw() {
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        
        // Draw based on malware type
        if (this.type === 'Virus') {
            // Virus: Red Arrow/Triangle (pointing down)
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2, this.y + this.height);
            ctx.lineTo(this.x, this.y);
            ctx.lineTo(this.x + this.width / 2, this.y + 8);
            ctx.lineTo(this.x + this.width, this.y);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'Ransomware') {
            // Ransomware: Yellow large square with flash effect
            let drawColor = this.color;
            if (this.isFlashing) {
                // Flash effect: toggle color or outline
                drawColor = '#ffaa00'; // Lighter yellow when flashing
            }
            ctx.fillStyle = drawColor;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            
            // Flash outline effect
            if (this.isFlashing) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(this.x, this.y, this.width, this.height);
            }
        } else if (this.type === 'Worm') {
            // Worm: Green circular or segmented shape
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Segmented effect (optional visual enhancement)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.shadowBlur = 0;
    }

    increaseSpeed(percentage) {
        // Increase speed by percentage (penalty for wrong weapon hit)
        this.speed = this.originalSpeed * (1 + percentage / 100);
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// Bullet (Defense Tool)
class Bullet {
    constructor(x, y, owner, defenseTool = null) {
        this.x = x;
        this.y = y;
        this.speed = owner === 'player' ? 7 : 5;
        this.owner = owner;
        
        // Set properties based on owner and defense tool
        if (owner === 'player') {
            // Player bullets use the specified defense tool
            this.defenseTool = defenseTool || 'antivirus';
            this.weaknessID = this.getWeaknessID(this.defenseTool);
            
            // Set size and color based on weapon type
            if (this.defenseTool === 'antivirus') {
                // Antivirus: Red small rectangle
                this.width = 4;
                this.height = 8;
                this.color = '#ff3333';
            } else if (this.defenseTool === 'backup') {
                // Backup Utility: Yellow rectangle/square
                this.width = 6;
                this.height = 6;
                this.color = '#ffff00';
            } else if (this.defenseTool === 'firewall') {
                // Firewall: Green thin line (laser)
                this.width = 2;
                this.height = 15;
                this.color = '#00ff41';
            }
        } else {
            // Enemy bullets remain red
            this.defenseTool = null;
            this.weaknessID = null;
            this.width = 4;
            this.height = 10;
            this.color = '#ff3333';
        }
    }

    getWeaknessID(tool) {
        // Map weapon to its weakness (enemy type it can destroy)
        const weaknessMap = {
            'antivirus': 'Virus',
            'backup': 'Ransomware',
            'firewall': 'Worm'
        };
        return weaknessMap[tool] || null;
    }

    update() {
        if (this.owner === 'player') {
            this.y -= this.speed * gameSpeed;
        } else {
            this.y += this.speed * gameSpeed;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        
        // Draw based on weapon type
        if (this.defenseTool === 'firewall') {
            // Firewall: Thin line (laser effect)
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x, this.y + this.height);
            ctx.stroke();
        } else {
            // Antivirus and Backup: Rectangle/square
            ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
        }
        
        ctx.shadowBlur = 0;
    }

    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    isOffScreen() {
        return this.y < 0 || this.y > canvas.height;
    }
}

// Collision Detection
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Stars are initialized in resizeCanvas() function

// Game Functions
function startGame() {
    gameState = 'playing';
    score = 0;
    lives = 3;
    gameSpeed = 1;
    timeRemaining = 120; // Reset to 2 minutes
    currentDefenseTool = 'antivirus'; // Reset to antivirus
    gunLocked = false;
    gunLockTimer = 0;
    gameSlowed = false;
    gameSlowTimer = 0;
    
    player = new Player();
    enemies = [];
    bullets = [];
    enemyBullets = [];
    
    startScreen.classList.add('hidden');
    gameOverScreen.classList.remove('show');
    
    // Clear any existing timer
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // Start countdown timer
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            gameOver();
        }
    }, 1000);
    
    updateUI();
    updateTimerDisplay();
    gameLoop();
}

function updateUI() {
    // Update score display (top right)
    if (scoreDisplay) {
        scoreDisplay.textContent = score;
    }
    
    // Update health bar (top left)
    // Convert lives (3, 2, 1) to percentage (100%, 66%, 33%)
    const healthPercent = Math.max(0, Math.round((lives / 3) * 100));
    const healthHP = Math.max(0, Math.round((lives / 3) * 100));
    
    if (window.healthProgress) {
        window.healthProgress.style.width = `${healthPercent}%`;
    }
    if (window.healthValue) {
        window.healthValue.textContent = `${healthHP} HP`;
    }
    
    // Update hidden lives display for compatibility
    if (livesDisplay) {
        livesDisplay.textContent = `${healthPercent}%`;
    }
    
    // Update final score display
    if (finalScoreDisplay) {
        finalScoreDisplay.textContent = score;
    }
    
    // Update weapon display (top right)
    if (window.weaponDisplay) {
        const toolNames = {
            'antivirus': 'ANTIVIRUS [1]',
            'backup': 'BACKUP [2]',
            'firewall': 'FIREWALL [3]'
        };
        window.weaponDisplay.textContent = toolNames[currentDefenseTool] || 'ANTIVIRUS [1]';
        // Set color class based on current defense tool
        window.weaponDisplay.className = 'weapon-display ' + currentDefenseTool;
    }
    
    // Update status messages (top middle)
    if (window.statusMessages) {
        window.statusMessages.innerHTML = ''; // Clear existing messages
        
        if (gunLocked) {
            const remainingTime = Math.ceil(gunLockTimer / 60); // Convert frames to seconds
            const message = document.createElement('div');
            message.className = 'status-message gun-locked';
            message.textContent = `GUN LOCKED! ${remainingTime}s`;
            window.statusMessages.appendChild(message);
        }
        
        if (gameSlowed) {
            const remainingTime = Math.ceil(gameSlowTimer / 60); // Convert frames to seconds
            const message = document.createElement('div');
            message.className = 'status-message system-slowed';
            message.textContent = `SYSTEM SLOWED! ${remainingTime}s`;
            window.statusMessages.appendChild(message);
        }
    }
    
    // Update weapon selection panel active state (if weapon panel exists)
    const weaponSlots = document.querySelectorAll('.weapon-slot');
    if (weaponSlots && weaponSlots.length > 0) {
        weaponSlots.forEach(slot => {
            const weapon = slot.getAttribute('data-weapon');
            if (weapon === currentDefenseTool) {
                slot.classList.add('active');
            } else {
                slot.classList.remove('active');
            }
        });
    }
    
    // Update defense tool display (hidden element for compatibility)
    if (bulletColorDisplay) {
        const toolNames = {
            'antivirus': 'ANTIVIRUS',
            'backup': 'BACKUP UTILITY',
            'firewall': 'FIREWALL'
        };
        bulletColorDisplay.textContent = toolNames[currentDefenseTool] || 'ANTIVIRUS';
        // Set color based on current defense tool (matching bullet colors)
        if (currentDefenseTool === 'antivirus') {
            bulletColorDisplay.style.color = '#ff3333'; // Red
        } else if (currentDefenseTool === 'backup') {
            bulletColorDisplay.style.color = '#ffff00'; // Yellow
        } else if (currentDefenseTool === 'firewall') {
            bulletColorDisplay.style.color = '#00ff41'; // Green
        }
    }
}

function updateTimerDisplay() {
    if (!timerDisplay) return;
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Change color when time is running low
    if (timeRemaining <= 10) {
        timerDisplay.style.color = '#ff3333';
    } else {
        timerDisplay.style.color = '#ffffff';
    }
}

function spawnEnemy() {
    if (Math.random() < 0.02) {
        enemies.push(new Enemy());
    }
}

function updateGame() {
    // Update malware effect timers
    if (gunLockTimer > 0) {
        gunLockTimer--;
        if (gunLockTimer <= 0) {
            gunLocked = false;
        }
    }
    
    if (gameSlowTimer > 0) {
        gameSlowTimer--;
        if (gameSlowTimer <= 0) {
            gameSlowed = false;
        }
    }
    
    // Update stars
    stars.forEach(star => star.update());

    // Update player
    player.update();

    // Spawn enemies
    spawnEnemy();

    // Update enemies
    enemies.forEach((enemy, enemyIndex) => {
        enemy.update();

        // Remove enemies that are off screen
        if (enemy.y > canvas.height) {
            enemies.splice(enemyIndex, 1);
        }

        // Check collision with player bullets
        bullets.forEach((bullet, bulletIndex) => {
            if (checkCollision(enemy.getBounds(), bullet.getBounds())) {
                // Check if bullet's weaknessID matches enemy's type
                // Antivirus -> Virus, Backup Utility -> Ransomware, Firewall -> Worm
                if (bullet.weaknessID === enemy.type) {
                    // Correct weapon
                    if (enemy.type === 'Worm' && !enemy.isSplit) {
                        // Worm splits into smaller worms instead of being destroyed
                        const splitCount = 2; // Split into 2 smaller worms
                        const splitX = enemy.x;
                        const splitY = enemy.y;
                        
                        // Create smaller worms
                        for (let i = 0; i < splitCount; i++) {
                            // Spread them horizontally
                            const offsetX = (i - (splitCount - 1) / 2) * 30;
                            const newX = Math.max(0, Math.min(splitX + offsetX, canvas.width - 20));
                            
                            enemies.push(new Enemy({
                                type: 'Worm',
                                isSplit: true,
                                x: newX,
                                y: splitY,
                                time: enemy.time // Continue sine wave pattern
                            }));
                        }
                        
                        // Remove original worm and bullet
                        enemies.splice(enemyIndex, 1);
                        bullets.splice(bulletIndex, 1);
                        score += 10;
                        updateUI();
                    } else {
                        // Other enemies or already-split worms: Destroy both, grant score
                        enemies.splice(enemyIndex, 1);
                        bullets.splice(bulletIndex, 1);
                        score += 10;
                        updateUI();
                    }
                } else {
                    // Wrong weapon: Destroy bullet, increase enemy speed, apply flash for Ransomware
                    bullets.splice(bulletIndex, 1);
                    
                    // Apply speed penalty based on enemy type
                    if (enemy.type === 'Virus') {
                        enemy.increaseSpeed(50); // Speed +50%
                    } else if (enemy.type === 'Ransomware') {
                        enemy.increaseSpeed(30); // Speed +30%
                        // Flash effect is already handled in enemy.update() and draw()
                    } else if (enemy.type === 'Worm') {
                        enemy.increaseSpeed(40); // Speed +40%
                    }
                }
            }
        });

        // Check collision with player
        if (checkCollision(player.getBounds(), enemy.getBounds())) {
            lives--;
            enemies.splice(enemyIndex, 1);
            
            // Apply malware-specific consequences
            if (enemy.type === 'Virus') {
                // Virus slows down the game
                gameSlowed = true;
                gameSlowTimer = 180; // 3 seconds at 60fps (180 frames)
            } else if (enemy.type === 'Ransomware') {
                // Ransomware locks gun for 3 seconds
                gunLocked = true;
                gunLockTimer = 180; // 3 seconds at 60fps (180 frames)
            }
            // Worm doesn't have special consequences (just damage)
            
            updateUI();
            if (lives <= 0) {
                gameOver();
            }
        }
    });

    // Update player bullets
    bullets.forEach((bullet, index) => {
        bullet.update();
        if (bullet.isOffScreen()) {
            bullets.splice(index, 1);
        }
    });

    // Update enemy bullets
    enemyBullets.forEach((bullet, index) => {
        bullet.update();
        if (bullet.isOffScreen()) {
            enemyBullets.splice(index, 1);
        }

        // Check collision with player
        if (checkCollision(player.getBounds(), bullet.getBounds())) {
            enemyBullets.splice(index, 1);
            lives--;
            updateUI();
            if (lives <= 0) {
                gameOver();
            }
        }
    });

    // Increase game speed over time, but apply slowdown if virus hit
    let baseSpeed = 1 + score / 1000;
    if (gameSlowed) {
        gameSpeed = baseSpeed * 0.5; // Slow down to 50% speed
    } else {
        gameSpeed = baseSpeed;
    }
}

function drawGame() {
    // Clear canvas with subtle fade for motion trails
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw stars
    stars.forEach(star => star.draw());

    // Draw player
    player.draw();

    // Draw enemies
    enemies.forEach(enemy => enemy.draw());

    // Draw bullets
    bullets.forEach(bullet => bullet.draw());
    enemyBullets.forEach(bullet => bullet.draw());
    
}

// Leaderboard Functions
function getLeaderboard() {
    const leaderboardData = localStorage.getItem('casTheHunterLeaderboard');
    if (leaderboardData) {
        return JSON.parse(leaderboardData);
    }
    return [];
}

function saveScore(newScore, playerName = 'ANONYMOUS') {
    let leaderboard = getLeaderboard();
    leaderboard.push({
        score: newScore,
        name: playerName,
        date: new Date().toISOString()
    });
    
    // Sort by score (descending) and keep top 5
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 5);
    
    localStorage.setItem('casTheHunterLeaderboard', JSON.stringify(leaderboard));
    return leaderboard;
}

function updateLeaderboardDisplay(currentScore) {
    const leaderboard = getLeaderboard();
    const leaderboardElement = document.getElementById('leaderboard');
    if (!leaderboardElement) return;
    
    const entries = leaderboardElement.querySelectorAll('.leaderboard-entry');
    
    // Clear previous new-score class
    entries.forEach(entry => entry.classList.remove('new-score'));
    
    // Find if current score is in leaderboard (check after save)
    const currentScoreIndex = leaderboard.findIndex(s => s.score === currentScore);
    
    // Update each entry
    entries.forEach((entry, index) => {
        const playerName = entry.querySelector('.player-name');
        const scoreValue = entry.querySelector('.score-value');
        
        if (leaderboard[index]) {
            playerName.textContent = leaderboard[index].name || 'ANONYMOUS';
            scoreValue.textContent = leaderboard[index].score.toLocaleString();
            
            // Highlight if this is the current score (only highlight once, at its position)
            if (currentScore > 0 && currentScoreIndex === index) {
                entry.classList.add('new-score');
            }
        } else {
            playerName.textContent = '---';
            scoreValue.textContent = '---';
        }
    });
}

function gameOver() {
    gameState = 'gameOver';
    
    // Clear timer if it's still running
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // Show name input modal first
    const nameInputModal = document.getElementById('nameInputModal');
    const playerNameInput = document.getElementById('playerNameInput');
    
    if (nameInputModal) {
        nameInputModal.classList.add('show');
        // Focus input after a short delay to ensure modal is visible
        setTimeout(() => {
            if (playerNameInput) {
                playerNameInput.focus();
            }
        }, 100);
    } else {
        // Fallback if modal doesn't exist - save as anonymous
        saveScore(score, 'ANONYMOUS');
        updateLeaderboardDisplay(score);
        gameOverScreen.classList.add('show');
    }
}

function gameLoop() {
    if (gameState === 'playing') {
        updateGame();
        drawGame();
        updateUI(); // Update UI every frame to show status messages
        requestAnimationFrame(gameLoop);
    }
}

// Initial draw
function init() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    stars.forEach(star => star.draw());
}

init();
