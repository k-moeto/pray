import express from 'express';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

app.prepare().then(() => {
    const server = express();
    const httpServer = createServer(server);
    const io = new SocketIOServer(httpServer);

    // Candle State
    // Fuel is in SECONDS
    const MAX_FUEL = 3600; // 1 hour

    let gameState = {
        fuel: 1800, // Start with 30 mins
        isAlive: true,
        lastUpdate: Date.now()
    };

    const connectedUsers = new Set<string>();

    io.on('connection', (socket) => {
        connectedUsers.add(socket.id);
        socket.emit('gameState', gameState);

        socket.on('disconnect', () => {
            connectedUsers.delete(socket.id);
        });

        socket.on('feed', () => {
            if (!gameState.isAlive) return;
            // Add fuel
            // Rate limiting could be here, but for now allow spamming (it's prayer)
            // Add 10 seconds per 'feed' packet? Or continuous stream?

            gameState.fuel += 2.0;
            if (gameState.fuel > MAX_FUEL) gameState.fuel = MAX_FUEL;
        });
    });

    // Decay Loop
    setInterval(() => {
        if (!gameState.isAlive) {
            // Check if we want to allow restart? For now, NO. Permadeath.
            // io.emit('gameState', gameState);
            return;
        }

        const now = Date.now();
        const delta = (now - gameState.lastUpdate) / 1000; // Seconds
        gameState.lastUpdate = now;

        gameState.fuel -= delta;

        if (gameState.fuel <= 0) {
            gameState.fuel = 0;
            gameState.isAlive = false;
        }

        io.emit('gameState', gameState);
    }, 100); // 10Hz is enough for a timer

    server.all('*', (req, res) => {
        const parsedUrl = parse(req.url || '', true);
        return handle(req, res, parsedUrl);
    });

    httpServer.listen(port, () => {
        console.log(`> Ready on http://localhost:${port}`);
    });
});
