const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let players = {};
let myId = null;

// Настройки локального игрока (твоего котика)
let localPlayer = {
    x: 120,
    y: 200,
    vx: 0,
    vy: 0,
    width: 32,
    height: 32,
    grounded: false
};

const GRAVITY = 0.35;
const JUMP_FORCE = -8.5;
const SPEED = 3.8;

// Генерация платформ (как на скриншоте)
const platforms = [
    { x: 30, y: 380, width: 220, height: 100, type: 'stone' },
    { x: 300, y: 320, width: 180, height: 25, type: 'neon' },
    { x: 550, y: 240, width: 260, height: 240, type: 'stone' }
];

// Звездный фон (псевдогенерация)
const stars = [];
for (let i = 0; i < 40; i++) {
    stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 2 });
}

// Слушатель клавиатуры
const keys = { left: false, right: false, up: false };

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
    if (e.code === 'KeyW' || e.code === 'Space' || e.code === 'ArrowUp') keys.up = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
    if (e.code === 'KeyW' || e.code === 'Space' || e.code === 'ArrowUp') keys.up = false;
});

// Сетевые события Socket.io
socket.on('connect', () => { myId = socket.id; });
socket.on('currentPlayers', (serverPlayers) => { players = serverPlayers; });
socket.on('newPlayer', (data) => { players[data.id] = data.playerInfo; });
socket.on('playerMoved', (data) => { if (players[data.id]) { players[data.id].x = data.x; players[data.id].y = data.y; } });
socket.on('playerDisconnected', (id) => { delete players[id]; });

function update() {
    // Движение по оси X
    if (keys.left) localPlayer.vx = -SPEED;
    else if (keys.right) localPlayer.vx = SPEED;
    else localPlayer.vx = 0;

    // Прыжок по оси Y
    if (keys.up && localPlayer.grounded) {
        localPlayer.vy = JUMP_FORCE;
        localPlayer.grounded = false;
    }

    // Применение гравитации
    localPlayer.vy += GRAVITY;
    localPlayer.x += localPlayer.vx;
    localPlayer.y += localPlayer.vy;

    // Проверка столкновений с платформами (сверху вниз)
    localPlayer.grounded = false;
    platforms.forEach(plat => {
        if (localPlayer.x < plat.x + plat.width &&
            localPlayer.x + localPlayer.width > plat.x &&
            localPlayer.y + localPlayer.height >= plat.y &&
            localPlayer.y + localPlayer.height - localPlayer.vy <= plat.y) {
            
            localPlayer.vy = 0;
            localPlayer.y = plat.y - localPlayer.height;
            localPlayer.grounded = true;
        }
    });

    // Ограничения границ экрана
    if (localPlayer.x < 0) localPlayer.x = 0;
    if (localPlayer.x > canvas.width - localPlayer.width) localPlayer.x = canvas.width - localPlayer.width;
    
    // Если упали в бездну — респавн
    if (localPlayer.y > canvas.height) {
        localPlayer.x = 120;
        localPlayer.y = 100;
        localPlayer.vy = 0;
    }

    // Отправляем свои новые координаты на сервер
    if (myId) {
        socket.emit('playerMovement', { x: localPlayer.x, y: localPlayer.y });
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Рисуем звезды
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    stars.forEach(star => ctx.fillRect(star.x, star.y, star.size, star.size));

    // 2. Рисуем платформы
    platforms.forEach(plat => {
        if (plat.type === 'stone') {
            ctx.fillStyle = '#25153a';
            ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
            ctx.fillStyle = '#49326d'; // Каменная текстура сверху
            ctx.fillRect(plat.x, plat.y, plat.width, 8);
        } else {
            ctx.fillStyle = '#1e0638';
            ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
            ctx.fillStyle = '#b624ff'; // Неоновая фиолетовая подсветка
            ctx.fillRect(plat.x, plat.y, plat.width, 5);
        }
    });

    // 3. Рисуем игроков (себя и других)
    Object.keys(players).forEach(id => {
        let isMe = id === myId;
        let x = isMe ? localPlayer.x : players[id].x;
        let y = isMe ? localPlayer.y : players[id].y;
        let color = isMe ? '#ff9f43' : (players[id].color || '#fff');

        // Рисуем тело-скафандр котика
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 32, 32);

        // Иллюминатор шлема
        ctx.fillStyle = '#00d2d3';
        ctx.fillRect(x + 8, y + 4, 20, 16);

        // Кошачьи ушки на шлеме
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + 8, y - 8); ctx.lineTo(x + 12, y);
        ctx.moveTo(x + 32, y); ctx.lineTo(x + 24, y - 8); ctx.lineTo(x + 20, y);
        ctx.fill();
    });

    // 4. Интерфейс (Стилизован под скриншот)
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px "Courier New"';
    ctx.fillText("LIVES    HEALTH", 25, 30);
    ctx.fillText("🐱🐱🐱   ♥♥♥♥", 25, 50);
    
    ctx.fillText("SCORE    12,450", 250, 30);
    ctx.fillText("LEVEL    COSMIC REACH 2-3", 250, 50);

    ctx.fillStyle = '#ff9f43';
    ctx.fillText("PRESS [A/D] MOVE  [W/SPACE] JUMP", 240, canvas.height - 20);
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
