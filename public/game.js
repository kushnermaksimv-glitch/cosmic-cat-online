const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let players = {};
let myId = null;
let inLobby = true;

// Настройка спрайт-листа
const spriteSheet = new Image();
spriteSheet.src = 'spritesheet.png'; 

// Автоматическая прорисовка Pixel Art текстур внутри кода
spriteSheet.onerror = () => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 128; tempCanvas.height = 64;
    const tCtx = tempCanvas.getContext('2d');
    const p = (x, y, color) => { tCtx.fillStyle = color; tCtx.fillRect(x * 2, y * 2, 2, 2); };

    // Кадр кота 0 (Стоит)
    tCtx.fillStyle = '#ff9f43'; tCtx.fillRect(2, 4, 12, 11);
    tCtx.fillStyle = '#fff'; tCtx.fillRect(2, 9, 12, 1);
    tCtx.fillStyle = '#555'; tCtx.fillRect(0, 6, 2, 6);
    tCtx.fillStyle = '#ff9f43'; tCtx.fillRect(2, 2, 3, 2); tCtx.fillRect(11, 2, 3, 2);
    tCtx.fillStyle = '#ffb6c1'; tCtx.fillRect(3, 3, 1, 1); tCtx.fillRect(12, 3, 1, 1);
    tCtx.fillStyle = '#00d2d3'; tCtx.fillRect(6, 5, 8, 6);
    tCtx.fillStyle = '#fff'; tCtx.fillRect(7, 6, 2, 2);
    tCtx.fillStyle = '#333'; tCtx.fillRect(3, 15, 3, 1); tCtx.fillRect(10, 15, 3, 1);

    // Кадр кота 1 (Шаг 1)
    tCtx.drawImage(tempCanvas, 0, 0, 32, 30, 32, 0, 32, 30);
    tCtx.fillStyle = '#333'; tCtx.fillRect(32 + 2, 30, 3, 1); tCtx.fillRect(32 + 11, 29, 3, 1);

    // Кадр кота 2 (Шаг 2)
    tCtx.drawImage(tempCanvas, 0, 0, 32, 30, 64, 0, 32, 30);
    tCtx.fillStyle = '#333'; tCtx.fillRect(64 + 5, 29, 3, 1); tCtx.fillRect(64 + 8, 30, 3, 1);

    // Текстура Блока Земли и Травы
    tCtx.fillStyle = '#5c4033'; tCtx.fillRect(96, 0, 32, 32);
    tCtx.fillStyle = '#1e824c'; tCtx.fillRect(96, 0, 32, 6);
    tCtx.fillStyle = '#2ecc71'; tCtx.fillRect(96, 0, 32, 3);
    p(48 + 2, 4, '#2ecc71'); p(48 + 7, 4, '#2ecc71'); p(48 + 5, 2, '#f1c40f');

    // Текстура Блока Космоса (Кирпич)
    tCtx.fillStyle = '#1c122c'; tCtx.fillRect(0, 32, 32, 32);
    tCtx.fillStyle = '#4c336c'; tCtx.fillRect(0, 32, 32, 4);
    tCtx.fillStyle = '#11081f'; tCtx.fillRect(0, 44, 32, 2); tCtx.fillRect(0, 56, 32, 2);
    tCtx.fillRect(10, 32, 2, 12); tCtx.fillRect(22, 44, 2, 12);
    tCtx.fillStyle = '#00ffcc'; tCtx.fillRect(4, 48, 4, 4);

    // Текстура Неонового блока
    tCtx.fillStyle = '#0d021f'; tCtx.fillRect(32, 32, 32, 32);
    tCtx.fillStyle = '#b624ff'; tCtx.fillRect(32, 32, 32, 4);
    tCtx.fillStyle = '#ffffff'; tCtx.fillRect(38, 33, 20, 2);
    tCtx.fillStyle = '#220847'; tCtx.fillRect(36, 40, 2, 20); tCtx.fillRect(46, 40, 2, 20);

    // Текстура Дерева
    tCtx.fillStyle = '#a0522d'; tCtx.fillRect(64, 32, 32, 32);
    tCtx.fillStyle = '#8b4513'; tCtx.fillRect(64, 38, 32, 2); tCtx.fillRect(64, 48, 32, 2);
    tCtx.fillStyle = '#708090'; tCtx.fillRect(66, 34, 3, 3); tCtx.fillRect(91, 34, 3, 3);

    spriteSheet.src = tempCanvas.toDataURL();
};

const LOCATIONS = {
    SPACE: {
        name: "COSMIC REACH 2-3", gravity: 0.35, jumpForce: -8.5, speed: 4,
        bgGradient: ['#09001a', '#150130'], hasStars: true,
        platforms: [
            { x: 0, y: 380, width: 250, height: 100, spriteX: 0, spriteY: 32 },
            { x: 320, y: 300, width: 200, height: 32, spriteX: 32, spriteY: 32 },
            { x: 580, y: 220, width: 270, height: 260, spriteX: 0, spriteY: 32 }
        ]
    },
    EARTH: {
        name: "GREEN EARTH 1-1", gravity: 0.55, jumpForce: -11, speed: 4.5,
        bgGradient: ['#357abd', '#8fc965'], hasStars: false,
        platforms: [
            { x: 0, y: 400, width: 300, height: 80, spriteX: 96, spriteY: 0 },
            { x: 380, y: 310, width: 140, height: 32, spriteX: 64, spriteY: 32 },
            { x: 600, y: 380, width: 250, height: 100, spriteX: 96, spriteY: 0 }
        ]
    }
};

let currentLocKey = 'SPACE';
let currentLoc = LOCATIONS[currentLocKey];

let localPlayer = {
    x: 50, y: 200, vx: 0, vy: 0, width: 32, height: 32, 
    grounded: false, moving: false, direction: 1, animFrame: 0
};

// Расчет кадров анимации лап при беге
setInterval(() => {
    if (localPlayer.moving && localPlayer.grounded) {
        localPlayer.animFrame = localPlayer.animFrame === 1 ? 2 : 1;
    } else {
        localPlayer.animFrame = 0;
    }
}, 120);

const stars = [];
for (let i = 0; i < 40; i++) stars.push({ x: Math.random() * 850, y: Math.random() * 480, size: Math.random() * 2 });

const keys = { left: false, right: false, up: false };

function setupInput() {
    window.addEventListener('keydown', (e) => {
        if(inLobby) return;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') { keys.left = true; localPlayer.direction = -1; }
        if (e.code === 'KeyD' || e.code === 'ArrowRight') { keys.right = true; localPlayer.direction = 1; }
        if (e.code === 'KeyW' || e.code === 'Space' || e.code === 'ArrowUp') keys.up = true;
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
        if (e.code === 'KeyW' || e.code === 'Space' || e.code === 'ArrowUp') keys.up = false;
    });

    const touch = (id, prop, dir) => {
        const el = document.getElementById(id);
        el.addEventListener('touchstart', (e) => { 
            e.preventDefault(); if(inLobby) return; keys[prop] = true; if(dir) localPlayer.direction = dir;
        });
        el.addEventListener('touchend', (e) => { e.preventDefault(); keys[prop] = false; });
    };
    touch('btnLeft', 'left', -1); touch('btnRight', 'right', 1); touch('btnJump', 'up');
}
setupInput();

const startBtn = document.getElementById('startBtn');
const lobbyOverlay = document.getElementById('lobbyOverlay');
const playerCountText = document.getElementById('playerCount');

startBtn.addEventListener('click', () => { inLobby = false; lobbyOverlay.style.display = 'none'; });

socket.on('connect', () => { myId = socket.id; startBtn.style.display = 'block'; });
socket.on('currentPlayers', (serverPlayers) => { players = serverPlayers; updateHUD(); });
socket.on('newPlayer', (data) => { players[data.id] = data.playerInfo; updateHUD(); });
socket.on('playerMoved', (data) => { 
    if (players[data.id]) { 
        players[data.id].x = data.x; players[data.id].y = data.y; players[data.id].loc = data.loc;
        players[data.id].dir = data.dir; players[data.id].frame = data.frame; players[data.id].moving = data.moving;
    } 
});
socket.on('playerDisconnected', (id) => { delete players[id]; updateHUD(); });

function updateHUD() {
    let count = Object.keys(players).length;
    playerCountText.innerHTML = `Игроков онлайн на сервере: <b>${count}</b><br><br>Нажми кнопку ниже для входа в мир.`;
}

function update() {
    if (inLobby) return;

    if (keys.left) localPlayer.vx = -currentLoc.speed;
    else if (keys.right) localPlayer.vx = currentLoc.speed;
    else localPlayer.vx = 0;

    localPlayer.moving = (localPlayer.vx !== 0);

    if (keys.up && localPlayer.grounded) { localPlayer.vy = currentLoc.jumpForce; localPlayer.grounded = false; }

    localPlayer.vy += currentLoc.gravity;
    localPlayer.x += localPlayer.vx; localPlayer.y += localPlayer.vy;

    localPlayer.grounded = false;
    currentLoc.platforms.forEach(plat => {
        if (localPlayer.x < plat.x + plat.width && localPlayer.x + localPlayer.width > plat.x &&
            localPlayer.y + localPlayer.height >= plat.y && localPlayer.y + localPlayer.height - localPlayer.vy <= plat.y) {
            localPlayer.vy = 0; localPlayer.y = plat.y - localPlayer.height; localPlayer.grounded = true;
        }
    });

    // Смена локации при переходе правого края экрана
    if (localPlayer.x > canvas.width - localPlayer.width) {
        currentLocKey = (currentLocKey === 'SPACE') ? 'EARTH' : 'SPACE';
        currentLoc = LOCATIONS[currentLocKey];
        localPlayer.x = 10; localPlayer.y = 100;
    }
    if (localPlayer.x < 0) localPlayer.x = 0;
    if (localPlayer.y > canvas.height) { localPlayer.x = 50; localPlayer.y = 100; localPlayer.vy = 0; }

    if (myId) {
        socket.emit('playerMovement', { 
            x: localPlayer.x, y: localPlayer.y, loc: currentLocKey,
            dir: localPlayer.direction, frame: localPlayer.animFrame, moving: localPlayer.moving 
        });
    }
}

function drawPlatformSprites(plat) {
    for (let tx = plat.x; tx < plat.x + plat.width; tx += 32) {
        for (let ty = plat.y; ty < plat.y + plat.height; ty += 32) {
            let drawW = Math.min(32, plat.x + plat.width - tx);
            let drawH = Math.min(32, plat.y + plat.height - ty);
            ctx.drawImage(spriteSheet, plat.spriteX, plat.spriteY, drawW, drawH, tx, ty, drawW, drawH);
        }
    }
}

function drawPlayerSprite(x, y, dir, frame, color) {
    ctx.save();
    ctx.translate(x + 16, y + 16);
    ctx.scale(dir, 1);

    // Слой реактивного огня при зажатом прыжке
    if (keys.up && localPlayer.vy !== 0) {
        ctx.fillStyle = '#ff3300'; ctx.fillRect(-22, 6, 6, 4);
    }

    // Вырезаем нужный кадр котика
    ctx.drawImage(spriteSheet, frame * 32, 0, 32, 32, -16, -16, 32, 32);

    // Цветовой фильтр поверх скафандра, чтобы различать игроков
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(-16, -16, 32, 32);
    
    ctx.restore();
}

function draw() {
    let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, currentLoc.bgGradient[0]); grad.addColorStop(1, currentLoc.bgGradient[1]);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (currentLoc.hasStars) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        stars.forEach(s => ctx.fillRect(s.x, s.y, s.size, s.size));
    }

    currentLoc.platforms.forEach(plat => drawPlatformSprites(plat));

    Object.keys(players).forEach(id => {
        let isMe = id === myId;
        let p = players[id];
        if ((isMe ? currentLocKey : p.loc) === currentLocKey) {
            let px = isMe ? localPlayer.x : p.x;
            let py = isMe ? localPlayer.y : p.y;
            let pDir = isMe ? localPlayer.direction : (p.dir || 1);
            let pFrame = isMe ? localPlayer.animFrame : (p.frame || 0);
            let pColor = isMe ? 'transparent' : (p.color || '#fff');

            drawPlayerSprite(px, py, pDir, pFrame, pColor);
        }
    });

    // Интерфейс
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Courier New"';
    ctx.fillText(`LOCATION: ${currentLoc.name}`, 25, 30);
    ctx.fillText(`PLAYERS ON SERVER: ${Object.keys(players).length}`, 25, 50);
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();
