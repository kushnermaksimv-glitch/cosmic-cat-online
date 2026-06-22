const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Раздаем статические файлы из папки public
app.use(express.static('public'));

// База данных игроков в оперативной памяти сервера
let players = {};

io.on('connection', (socket) => {
    console.log(`Игрок подключился: ${socket.id}`);
    
    // Создаем нового котика со случайным цветом скафандра
    players[socket.id] = {
        x: 100,
        y: 200,
        color: `hsl(${Math.random() * 360}, 85%, 65%)`
    };

    // Отправляем текущих игроков новому подключившемуся
    socket.emit('currentPlayers', players);
    
    // Оповещаем остальных, что зашел новый игрок
    socket.broadcast.emit('newPlayer', { id: socket.id, playerInfo: players[socket.id] });

    // Получаем перемещение от игрока и транслируем остальным
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            socket.broadcast.emit('playerMoved', { id: socket.id, x: players[socket.id].x, y: players[socket.id].y });
        }
    });

    // Обработка отключения игрока
    socket.on('disconnect', () => {
        console.log(`Игрок отключился: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// Render автоматически передаст порт в переменную process.env.PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
