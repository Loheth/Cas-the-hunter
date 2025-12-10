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
let timeRemaining = 60; // 1 minute in seconds
let timerInterval = null;
let currentBulletColor = 'red'; // 'red', 'blue', 'yellow'

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

        // Bullet color switching (1 = red, 2 = blue, 3 = yellow)
        let colorChanged = false;
        if (keys['1']) {
            if (currentBulletColor !== 'red') {
                currentBulletColor = 'red';
                colorChanged = true;
            }
        }
        if (keys['2']) {
            if (currentBulletColor !== 'blue') {
                currentBulletColor = 'blue';
                colorChanged = true;
            }
        }
        if (keys['3']) {
            if (currentBulletColor !== 'yellow') {
                currentBulletColor = 'yellow';
                colorChanged = true;
            }
        }
        if (colorChanged) {
            updateUI();
        }

        // Shooting
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        }
        if ((keys[' '] || keys['space']) && this.shootCooldown === 0) {
            bullets.push(new Bullet(this.x + this.width / 2, this.y, 'player', currentBulletColor));
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

// Enemy Ship
class Enemy {
    constructor() {
        this.width = 35;
        this.height = 35;
        this.x = Math.random() * (canvas.width - this.width);
        this.y = -this.height;
        this.speed = Math.random() * 2 + 1;
        this.shootCooldown = Math.random() * 100 + 50;
        this.maxCooldown = Math.random() * 100 + 100;
        // Randomly assign one of three colors: red, blue, or yellow
        const colorTypes = ['red', 'blue', 'yellow'];
        this.colorType = colorTypes[Math.floor(Math.random() * colorTypes.length)];
        
        // Set color based on type
        if (this.colorType === 'red') {
            this.color = '#ff3333';
        } else if (this.colorType === 'blue') {
            this.color = '#3366ff';
        } else if (this.colorType === 'yellow') {
            this.color = '#ffdd00';
        }
    }

    update() {
        this.y += this.speed * gameSpeed;
        this.shootCooldown--;

        // Enemy shooting
        if (this.shootCooldown <= 0 && Math.random() < 0.02) {
            enemyBullets.push(new Bullet(this.x + this.width / 2, this.y + this.height, 'enemy'));
            this.shootCooldown = this.maxCooldown;
        }
    }

    draw() {
        // Enemy ship body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y + this.height);
        ctx.lineTo(this.x, this.y);
        ctx.lineTo(this.x + this.width / 2, this.y + 10);
        ctx.lineTo(this.x + this.width, this.y);
        ctx.closePath();
        ctx.fill();

        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
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

// Bullet
class Bullet {
    constructor(x, y, owner, colorType = null) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 10;
        this.speed = owner === 'player' ? 7 : 5;
        this.owner = owner;
        
        // Set color based on owner and color type
        if (owner === 'player') {
            // Player bullets use the specified color type
            this.colorType = colorType || 'red';
            if (this.colorType === 'red') {
                this.color = '#ff3333';
            } else if (this.colorType === 'blue') {
                this.color = '#3366ff';
            } else if (this.colorType === 'yellow') {
                this.color = '#ffdd00';
            }
        } else {
            // Enemy bullets remain red
            this.colorType = null;
            this.color = '#ff3333';
        }
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
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
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
    timeRemaining = 60; // Reset to 1 minute
    currentBulletColor = 'red'; // Reset to red
    
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
    scoreDisplay.textContent = score;
    // Convert lives (3, 2, 1) to percentage (100%, 66%, 33%)
    const integrityPercent = Math.max(0, Math.round((lives / 3) * 100));
    livesDisplay.textContent = `${integrityPercent}%`;
    finalScoreDisplay.textContent = score;
    
    // Update bullet color display
    if (bulletColorDisplay) {
        bulletColorDisplay.textContent = currentBulletColor.toUpperCase();
        // Set color based on current bullet color
        if (currentBulletColor === 'red') {
            bulletColorDisplay.style.color = '#ff3333';
        } else if (currentBulletColor === 'blue') {
            bulletColorDisplay.style.color = '#3366ff';
        } else if (currentBulletColor === 'yellow') {
            bulletColorDisplay.style.color = '#ffdd00';
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

        // Check collision with player bullets (only matching colors kill enemies)
        bullets.forEach((bullet, bulletIndex) => {
            if (checkCollision(enemy.getBounds(), bullet.getBounds())) {
                // Only destroy enemy if bullet color matches enemy color
                if (bullet.colorType === enemy.colorType) {
                    enemies.splice(enemyIndex, 1);
                    bullets.splice(bulletIndex, 1);
                    score += 10;
                    updateUI();
                } else {
                    // Remove bullet but don't destroy enemy if colors don't match
                    bullets.splice(bulletIndex, 1);
                }
            }
        });

        // Check collision with player
        if (checkCollision(player.getBounds(), enemy.getBounds())) {
            lives--;
            enemies.splice(enemyIndex, 1);
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

    // Increase game speed over time
    gameSpeed = 1 + score / 1000;
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
    const leaderboardData = localStorage.getItem('traceTheHunterLeaderboard');
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
    
    localStorage.setItem('traceTheHunterLeaderboard', JSON.stringify(leaderboard));
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

