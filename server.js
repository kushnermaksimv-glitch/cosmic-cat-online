const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = {};

io.on('connection', (socket) => {
    console.log(`Игрок вошел: ${socket.id}`);
    
    players[socket.id] = {
        x: 50,
        y: 200,
        loc: 'SPACE', // Стартовый мир
        color: `hsl(${Math.random() * 360}, 85%, 60%)`
    };

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', { id: socket.id, playerInfo: players[socket.id] });

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].loc = movementData.loc; // Обновляем мир игрока
            socket.broadcast.emit('playerMoved', { id: socket.id, x: players[socket.id].x, y: players[socket.id].y, loc: players[socket.id].loc });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Игрок вышел: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер активен на порту: ${PORT}`));
