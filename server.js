const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = {};

io.on('connection', (socket) => {
    console.log(`Игрок подключился к лобби: ${socket.id}`);
    
    players[socket.id] = {
        x: 50, y: 200, loc: 'SPACE', dir: 1, frame: 0, moving: false,
        color: `hsl(${Math.random() * 360}, 85%, 65%)`
    };

    io.emit('currentPlayers', players);

    socket.on('playerMovement', (m) => {
        if (players[socket.id]) {
            players[socket.id].x = m.x; players[socket.id].y = m.y;
            players[socket.id].loc = m.loc; players[socket.id].dir = m.dir;
            players[socket.id].frame = m.frame; players[socket.id].moving = m.moving;
            
            socket.broadcast.emit('playerMoved', { 
                id: socket.id, x: m.x, y: m.y, loc: m.loc, 
                dir: m.dir, frame: m.frame, moving: m.moving 
            });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер лобби запущен на порту: ${PORT}`));
