const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let players = {};
let myId = null;
let inLobby = true; // Флаг нахождения в лобби

// Настройки локаций
const LOCATIONS = {
    SPACE: {
        name: "COSMIC REACH 2-3", gravity: 0.35, jumpForce: -8.5, speed: 4,
        bgGradient: ['#09001a', '#150130'], hasStars: true, hasClouds: false,
        platforms: [
            { x: 0, y: 380, width: 250, height: 100, type: 'space_stone' },
            { x: 320, y: 300, width: 200, height: 25, type: 'neon_crystal' },
            { x: 580, y: 220, width: 270, height: 260, type: 'space_stone' }
        ]
    },
    EARTH: {
        name: "GREEN EARTH 1-1", gravity: 0.55, jumpForce: -11, speed: 4.5,
        bgGradient: ['#357abd', '#8fc965'], hasStars: false, hasClouds: true,
        platforms: [
            { x: 0, y: 400, width: 300, height: 80, type: 'earth_grass' },
            { x: 380, y: 310, width: 140, height: 30, type: 'wood' },
            { x: 600, y: 380, width: 250, height: 100, type: 'earth_grass' }
        ]
    }
};

let currentLocKey = 'SPACE';
let currentLoc = LOCATIONS[currentLocKey];

let localPlayer = {
    x: 50, y: 200, vx: 0, vy: 0, width: 32, height: 32, 
    grounded: false, moving: false, direction: 1, animFrame: 0
};

// Таймер для пиксельной анимации бега
setInterval(() => {
    if (localPlayer.moving && localPlayer.grounded) {
        localPlayer.animFrame = (localPlayer.animFrame + 1) % 4; // 4 кадра анимации лапок
    } else {
        localPlayer.animFrame = 0;
    }
}, 100);

// Окружение
const stars = [];
for (let i = 0; i < 50; i++) stars.push({ x: Math.random() * 850, y: Math.random() * 480, size: Math.random() * 2 + 1, alpha: Math.random() });
const clouds = [];
for (let i = 0; i < 4; i++) clouds.push({ x: Math.random() * 850, y: Math.random() * 120, v: Math.random() * 0.15 + 0.05, w: Math.random() * 50 + 50 });

// Управление
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
            e.preventDefault(); if(inLobby) return; keys[prop] = true; 
            if(dir) localPlayer.direction = dir;
        });
        el.addEventListener('touchend', (e) => { e.preventDefault(); keys[prop] = false; });
    };
    touch('btnLeft', 'left', -1);
    touch('btnRight', 'right', 1);
    touch('btnJump', 'up');
}
setupInput();

// Лобби логика
const startBtn = document.getElementById('startBtn');
const playerCountText = document.getElementById('playerCount');
const lobbyOverlay = document.getElementById('lobbyOverlay');

startBtn.addEventListener('click', () => {
    inLobby = false;
    lobbyOverlay.style.display = 'none';
});

// Сетевые события
socket.on('connect', () => { 
    myId = socket.id; 
    startBtn.style.display = 'block';
});

socket.on('currentPlayers', (serverPlayers) => { 
    players = serverPlayers; 
    updateLobbyStatus();
});

socket.on('newPlayer', (data) => { 
    players[data.id] = data.playerInfo; 
    updateLobbyStatus();
});

socket.on('playerMoved', (data) => { 
    if (players[data.id]) { 
        players[data.id].x = data.x; 
        players[data.id].y = data.y; 
        players[data.id].loc = data.loc;
        players[data.id].dir = data.dir;
        players[data.id].frame = data.frame;
        players[data.id].moving = data.moving;
    } 
});

socket.on('playerDisconnected', (id) => { 
    delete players[id]; 
    updateLobbyStatus();
});

function updateLobbyStatus() {
    let count = Object.keys(players).length;
    playerCountText.innerHTML = `Игроков онлайн в сети: <b>${count}</b><br><br>Вы можете бегать вместе на разных картах!`;
}

function update() {
    if (inLobby) return;

    if (keys.left) localPlayer.vx = -currentLoc.speed;
    else if (keys.right) localPlayer.vx = currentLoc.speed;
    else localPlayer.vx = 0;

    localPlayer.moving = (localPlayer.vx !== 0);

    if (keys.up && localPlayer.grounded) {
        localPlayer.vy = currentLoc.jumpForce;
        localPlayer.grounded = false;
    }

    localPlayer.vy += currentLoc.gravity;
    localPlayer.x += localPlayer.vx;
    localPlayer.y += localPlayer.vy;

    // Коллизии платформ
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

    if (currentLoc.hasClouds) {
        clouds.forEach(c => { c.x -= c.v; if (c.x + c.w < 0) c.x = canvas.width; });
    }

    // Смена локаций
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

// ВЫСОКОДЕТАЛИЗИРОВАННЫЙ ПИКСЕЛЬНЫЙ РЕНДЕР ТЕКСТУР БЕЗ КАРТИНОК
function drawPixelTexture(plat) {
    const pSize = 4; // Размер одного "пикселя" текстуры для ретро-эффекта
    ctx.save();
    
    if (plat.type === 'space_stone') {
        // Базовый темный камень древних руин
        ctx.fillStyle = '#1c122c'; ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        // Рисунок кирпичной кладки пикселями
        ctx.fillStyle = '#2d1f42';
        for (let y = plat.y + 8; y < plat.y + plat.height; y += 16) {
            for (let x = plat.x; x < plat.x + plat.width; x += 32) {
                ctx.fillRect(x + (y % 32 === 0 ? 8 : 0), y, 28, 12);
            }
        }
        // Светящиеся древние руны / мох на камнях
        ctx.fillStyle = '#00ffcc';
        for(let i = 20; i < plat.width - 20; i += 60) {
            ctx.fillRect(plat.x + i, plat.y + 16, pSize, pSize * 2);
            ctx.fillRect(plat.x + i + pSize, plat.y + 20, pSize * 2, pSize);
        }
        // Фиолетовая кайма верха платформы
        ctx.fillStyle = '#4c336c'; ctx.fillRect(plat.x, plat.y, plat.width, 8);
        ctx.fillStyle = '#7a57a3'; ctx.fillRect(plat.x, plat.y, plat.width, pSize);
    } 
    else if (plat.type === 'neon_crystal') {
        // Металлическая кибер-платформа
        ctx.fillStyle = '#0d021f'; ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        // Неоновая сетка подложки
        ctx.fillStyle = '#220847';
        for (let i = plat.x + 8; i < plat.x + plat.width; i += 16) {
            ctx.fillRect(i, plat.y + 8, pSize, plat.height - 12);
        }
        // Яркая неоновая лазерная линия верха со свечением
        ctx.shadowBlur = 12; ctx.shadowColor = '#b624ff';
        ctx.fillStyle = '#b624ff'; ctx.fillRect(plat.x, plat.y, plat.width, pSize);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(plat.x + 15, plat.y + 1, plat.width - 30, 2);
        ctx.shadowBlur = 0;
    }
    else if (plat.type === 'earth_grass') {
        // Земляной слой
        ctx.fillStyle = '#5c4033'; ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        // Тёмные вкрапления камней в почве
        ctx.fillStyle = '#3d2b22';
        for (let i = 12; i < plat.width; i += 32) {
            ctx.fillRect(plat.x + i, plat.y + 24, pSize * 2, pSize);
            ctx.fillRect(plat.x + i + pSize, plat.y + 40, pSize, pSize * 2);
        }
        // Пиксельный ковер сочной травы
        ctx.fillStyle = '#1e824c'; ctx.fillRect(plat.x, plat.y, plat.width, 12);
        ctx.fillStyle = '#2ecc71'; // Светлые пиксели травы
        for (let i = 2; i < plat.width; i += 8) {
            ctx.fillRect(plat.x + i, plat.y + 4, pSize, pSize * 2);
            ctx.fillRect(plat.x + i + pSize, plat.y, pSize, pSize);
        }
        // Маленькие редкие желтые цветы на траве
        ctx.fillStyle = '#f1c40f';
        for (let i = 40; i < plat.width - 20; i += 90) ctx.fillRect(plat.x + i, plat.y - 2, pSize, pSize);
    }
    else if (plat.type === 'wood') {
        // Деревянная подвесная доска
        ctx.fillStyle = '#a0522d'; ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        // Кольца дерева/текстурные полосы
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(plat.x, plat.y + 8, plat.width, pSize);
        ctx.fillRect(plat.x, plat.y + 18, plat.width, pSize);
        // Заклепки по бокам платформы
        ctx.fillStyle = '#708090';
        ctx.fillRect(plat.x + 4, plat.y + 10, pSize, pSize);
        ctx.fillRect(plat.x + plat.width - 8, plat.y + 10, pSize, pSize);
    }
    
    ctx.restore();
}

// ДЕТАЛИЗИРОВАННЫЙ КОТИК С АНИМАЦИЕЙ ЛАПОК
function drawAnimatedCat(x, y, color, isMe, dir, frame, moving) {
    ctx.save();
    // Эффект зеркального поворота кота влево/вправо
    ctx.translate(x + 16, y + 16);
    ctx.scale(dir, 1);

    // 1. Космический ранец за спиной
    ctx.fillStyle = '#555'; ctx.fillRect(-20, 2, 6, 12);
    ctx.fillStyle = '#888'; ctx.fillRect(-20, 4, 2, 8);
    
    // Эффект реактивного пламени
    if (keys.up && isMe && localPlayer.vy !== 0) {
        ctx.fillStyle = '#ff3300'; ctx.fillRect(-26, 6, 6, 4);
        ctx.fillStyle = '#ffcc00'; ctx.fillRect(-24, 7, 4, 2);
    }

    // 2. Скафандр (тело) котика
    ctx.fillStyle = color; ctx.fillRect(-16, -12, 28, 26);
    
    // Полоски скафандра (детализация)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-16, 2, 28, 3);

    // 3. Большой шлем и иллюминатор
    ctx.fillStyle = 'rgba(0, 210, 211, 0.85)'; ctx.fillRect(-2, -8, 12, 14);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, -6, 3, 3); // Блик стекла

    // 4. Ушки кошачьего шлема
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-16, -12); ctx.lineTo(-12, -18); ctx.lineTo(-6, -12);
    ctx.moveTo(4, -12); ctx.lineTo(8, -18); ctx.lineTo(12, -12);
    ctx.fill();
    // Розовая серединка ушей
    ctx.fillStyle = '#ffb6c1'; ctx.fillRect(-13, -15, 2, 3); ctx.fillRect(7, -15, 2, 3);

    // 5. АНИМАЦИЯ БЕГА (ЛАПКИ)
    ctx.fillStyle = '#333'; // Цвет космических ботинок на лапах
    if (moving && localPlayer.grounded) {
        // Смена позиции лап в зависимости от кадра
        if (frame === 0) {
            ctx.fillRect(-12, 14, 5, 4);  // Передняя лапа опущена
            ctx.fillRect(2, 14, 5, 4);   // Задняя лапа опущена
        } else if (frame === 1) {
            ctx.fillRect(-15, 12, 5, 4);  // Шаг вперед
            ctx.fillRect(5, 14, 5, 4);
        } else if (frame === 2) {
            ctx.fillRect(-12, 14, 5, 4);
            ctx.fillRect(2, 14, 5, 4);
        } else if (frame === 3) {
            ctx.fillRect(-9, 14, 5, 4);
            ctx.fillRect(-1, 12, 5, 4);   // Задняя лапа приподнята
        }
    } else {
        // Кот просто стоит или летит в прыжке
        ctx.fillRect(-12, 14, 5, 4);
        ctx.fillRect(2, 14, 5, 4);
    }

    ctx.restore();
}

function draw() {
    // Неоновый фон
    let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, currentLoc.bgGradient[0]); grad.addColorStop(1, currentLoc.bgGradient[1]);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (currentLoc.hasStars) {
        stars.forEach(s => {
            ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
            ctx.fillRect(s.x, s.y, s.size, s.size);
        });
    }
    if (currentLoc.hasClouds) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        clouds.forEach(c => ctx.fillRect(c.x, c.y, c.w, 16));
    }

    // Рендер текстур платформ
    currentLoc.platforms.forEach(plat => drawPixelTexture(plat));

    // Рендер игроков
    Object.keys(players).forEach(id => {
        let isMe = id === myId;
        let p = players[id];
        let pLoc = isMe ? currentLocKey : p.loc;

        if (pLoc === currentLocKey) {
            let x = isMe ? localPlayer.x : p.x;
            let y = isMe ? localPlayer.y : p.y;
            let color = isMe ? '#ff9f43' : (p.color || '#fff');
            let dir = isMe ? localPlayer.direction : (p.dir || 1);
            let frame = isMe ? localPlayer.animFrame : (p.frame || 0);
            let moving = isMe ? localPlayer.moving : p.moving;

            drawAnimatedCat(x, y, color, isMe, dir, frame, moving);
        }
    });

    // Отрисовка интерфейса (HUD)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Courier New"';
    ctx.fillText(`LOCATION: ${currentLoc.name}`, 25, 30);
    ctx.fillText(`WORLD USERS: ${Object.keys(players).length}`, 25, 50);
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}
loop();
