const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let players = {};
let myId = null;

// Настройки миров (Локаций)
const LOCATIONS = {
    SPACE: {
        name: "COSMIC REACH 2-3",
        gravity: 0.35,
        jumpForce: -8.5,
        speed: 4,
        bgGradient: ['#0c001f', '#19013a'],
        hasStars: true,
        hasClouds: false,
        platforms: [
            { x: 0, y: 380, width: 250, height: 100, type: 'space_stone' },
            { x: 320, y: 300, width: 200, height: 25, type: 'neon_crystal' },
            { x: 580, y: 220, width: 270, height: 260, type: 'space_stone' }
        ]
    },
    EARTH: {
        name: "GREEN EARTH 1-1",
        gravity: 0.55, // Гравитация сильнее, чем в космосе!
        jumpForce: -11, // Прыгать нужно выше
        speed: 4.5,
        bgGradient: ['#4a90e2', '#b8e986'],
        hasStars: false,
        hasClouds: true,
        platforms: [
            { x: 0, y: 400, width: 300, height: 80, type: 'earth_grass' },
            { x: 380, y: 310, width: 140, height: 30, type: 'wood' },
            { x: 600, y: 380, width: 250, height: 100, type: 'earth_grass' }
        ]
    }
};

let currentLocKey = 'SPACE';
let currentLoc = LOCATIONS[currentLocKey];

// Локальный игрок
let localPlayer = {
    x: 50, y: 200, vx: 0, vy: 0,
    width: 32, height: 32, grounded: false
};

// Генерация декораций (Облака, Звезды)
const stars = [];
for (let i = 0; i < 40; i++) stars.push({ x: Math.random() * 850, y: Math.random() * 480, size: Math.random() * 2 + 1 });
const clouds = [];
for (let i = 0; i < 5; i++) clouds.push({ x: Math.random() * 850, y: Math.random() * 150, v: Math.random() * 0.2 + 0.1, w: Math.random() * 60 + 40 });

// Управление (Клавиатура + Мобилки)
const keys = { left: false, right: false, up: false };

function setupInput() {
    // Клавиатура
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

    // Мобильные кнопки (Тач-события)
    const bindTouch = (id, prop) => {
        const el = document.getElementById(id);
        el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[prop] = true; });
        el.addEventListener('touchend', (e) => { e.preventDefault(); keys[prop] = false; });
    };
    bindTouch('btnLeft', 'left');
    bindTouch('btnRight', 'right');
    bindTouch('btnJump', 'up');
}
setupInput();

// Сетевой код
socket.on('connect', () => { myId = socket.id; });
socket.on('currentPlayers', (serverPlayers) => { players = serverPlayers; });
socket.on('newPlayer', (data) => { players[data.id] = data.playerInfo; });
socket.on('playerMoved', (data) => { if (players[data.id]) { players[data.id].x = data.x; players[data.id].y = data.y; players[data.id].loc = data.loc; } });
socket.on('playerDisconnected', (id) => { delete players[id]; });

function update() {
    // Движение
    if (keys.left) localPlayer.vx = -currentLoc.speed;
    else if (keys.right) localPlayer.vx = currentLoc.speed;
    else localPlayer.vx = 0;

    if (keys.up && localPlayer.grounded) {
        localPlayer.vy = currentLoc.jumpForce;
        localPlayer.grounded = false;
    }

    localPlayer.vy += currentLoc.gravity;
    localPlayer.x += localPlayer.vx;
    localPlayer.y += localPlayer.vy;

    // Столкновение с платформами
    localPlayer.grounded = false;
    currentLoc.platforms.forEach(plat => {
        if (localPlayer.x < plat.x + plat.width &&
            localPlayer.x + localPlayer.width > plat.x &&
            localPlayer.y + localPlayer.height >= plat.y &&
            localPlayer.y + localPlayer.height - localPlayer.vy <= plat.y) {
            
            localPlayer.vy = 0;
            localPlayer.y = plat.y - localPlayer.height;
            localPlayer.grounded = true;
        }
    });

    // Анимация облаков на Земле
    if (currentLoc.hasClouds) {
        clouds.forEach(c => { c.x -= c.v; if (c.x + c.w < 0) c.x = canvas.width; });
    }

    // Смена локаций (Выход за края экрана)
    if (localPlayer.x > canvas.width - localPlayer.width) {
        currentLocKey = (currentLocKey === 'SPACE') ? 'EARTH' : 'SPACE';
        currentLoc = LOCATIONS[currentLocKey];
        localPlayer.x = 10; // Появляемся слева
        localPlayer.y = 100;
    }
    if (localPlayer.x < 0) localPlayer.x = 0;

    // Падение в яму
    if (localPlayer.y > canvas.height) {
        localPlayer.x = 50; localPlayer.y = 100; localPlayer.vy = 0;
    }

    // Отправка данных на сервер (включая имя текущей локации)
    if (myId) {
        socket.emit('playerMovement', { x: localPlayer.x, y: localPlayer.y, loc: currentLocKey });
    }
}

// Улучшенный графический движок (Пиксель-арт рендер)
function drawTexture(plat) {
    if (plat.type === 'space_stone') {
        ctx.fillStyle = '#211333'; ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        ctx.fillStyle = '#412d59'; ctx.fillRect(plat.x, plat.y, plat.width, 8); // Текстура верха
        // Точки/Камни
        ctx.fillStyle = '#170c24';
        for(let i=15; i<plat.width; i+=40) ctx.fillRect(plat.x + i, plat.y + 20, 10, 10);
    } 
    else if (plat.type === 'neon_crystal') {
        ctx.fillStyle = '#110324'; ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        ctx.fillStyle = '#b624ff'; ctx.fillRect(plat.x, plat.y, plat.width, 4); // Светящийся неон
        ctx.shadowBlur = 10; ctx.shadowColor = '#b624ff'; // Эффект свечения
        ctx.fillStyle = '#df8eff'; ctx.fillRect(plat.x + 20, plat.y+1, plat.width-40, 2);
        ctx.shadowBlur = 0; // Сброс тени
    }
    else if (plat.type === 'earth_grass') {
        ctx.fillStyle = '#654321'; ctx.fillRect(plat.x, plat.y, plat.width, plat.height); // Земля
        ctx.fillStyle = '#27ae60'; ctx.fillRect(plat.x, plat.y, plat.width, 12); // Трава
        ctx.fillStyle = '#2ecc71'; // Пиксельные травинки
        for(let i=5; i<plat.width; i+=16) ctx.fillRect(plat.x + i, plat.y + 4, 4, 8);
    }
    else if (plat.type === 'wood') {
        ctx.fillStyle = '#d35400'; ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        ctx.fillStyle = '#e67e22'; ctx.fillRect(plat.x, plat.y, plat.width, 4);
    }
}

function drawPlayer(x, y, color, isMe) {
    // Прорисованный шлем котика
    ctx.fillStyle = color; ctx.fillRect(x, y, 32, 32); // Скафандр
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(x+2, y+18, 6, 8); // Реактивный ранец сзади
    
    if (keys.up && isMe && localPlayer.vy > 0) { // Огонь из ранца при прыжке
        ctx.fillStyle = '#f1c40f'; ctx.fillRect(x+2, y+26, 6, 8);
        ctx.fillStyle = '#e74c3c'; ctx.fillRect(x+4, y+26, 2, 4);
    }

    ctx.fillStyle = '#00d2d3'; ctx.fillRect(x + 10, y + 4, 18, 14); // Стекло шлема
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 12, y + 6, 4, 4); // Блик на стекле

    // Ушки
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + 8, y - 6); ctx.lineTo(x + 12, y);
    ctx.moveTo(x + 32, y); ctx.lineTo(x + 24, y - 6); ctx.lineTo(x + 20, y);
    ctx.fill();
}

function draw() {
    // Задний фон локации
    let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, currentLoc.bgGradient[0]);
    grad.addColorStop(1, currentLoc.bgGradient[1]);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Отрисовка окружения
    if (currentLoc.hasStars) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        stars.forEach(s => ctx.fillRect(s.x, s.y, s.size, s.size));
    }
    if (currentLoc.hasClouds) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        clouds.forEach(c => ctx.fillRect(c.x, c.y, c.w, 20));
    }

    // Отрисовка платформ
    currentLoc.platforms.forEach(plat => drawTexture(plat));

    // Отрисовка сетевых игроков (Рисуем только тех, кто в одной локации с нами)
    Object.keys(players).forEach(id => {
        let isMe = id === myId;
        let p = players[id];
        let pLoc = isMe ? currentLocKey : p.loc;

        if (pLoc === currentLocKey) {
            let x = isMe ? localPlayer.x : p.x;
            let y = isMe ? localPlayer.y : p.y;
            let color = isMe ? '#ff9f43' : (p.color || '#fff');
            drawPlayer(x, y, color, isMe);
        }
    });

    // Красивый HUD (Интерфейс)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Courier New"';
    ctx.fillText(`LOCATION: ${currentLoc.name}`, 25, 30);
    ctx.fillText(`ONLINE USERS: ${Object.keys(players).length}`, 25, 50);
    
    ctx.fillStyle = '#ff9f43';
    ctx.fillText("ПЕРЕЙДИ ПРАВЫЙ КРАЙ ДЛЯ СМЕНЫ МИРА →", canvas.width - 320, 30);
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}
loop();
