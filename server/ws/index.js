const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createRoom, joinRoom, getRoom, removePlayer, listRooms } = require('./game-room');
const { createGameState, playFromHand, playFromPrison, pickupDiscardPile, drawCard, nextTurn, checkWin, getEffectiveValue, isValidPlay, isValidStack, executeUndeadSwap, executeUndeadTake } = require('./game-engine');

const app = express();
app.use(cors({ origin: ["https://play.skorchthegame.com", "http://localhost:8080"] }));
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: ["https://play.skorchthegame.com", "http://localhost:8080"],
        methods: ["GET", "POST"]
    }
});

// --- Input validation helpers ---
function validateString(val, maxLen = 100) {
    return typeof val === 'string' && val.length <= maxLen;
}
function validateInt(val, min = 0, max = 100) {
    return Number.isInteger(val) && val >= min && val <= max;
}
function validateIndexes(arr) {
    if (!Array.isArray(arr)) return false;
    if (arr.length === 0 || arr.length > 20) return false;
    const seen = new Set();
    for (const i of arr) {
        if (!Number.isInteger(i) || i < 0 || i > 100) return false;
        if (seen.has(i)) return false; // No duplicates
        seen.add(i);
    }
    return true;
}

// --- Rate limiting ---
const socketRates = new Map();
function rateLimit(socketId, limit = 30) {
    const now = Date.now();
    if (!socketRates.has(socketId)) socketRates.set(socketId, []);
    const times = socketRates.get(socketId).filter(t => now - t < 10000); // 10 sec window
    times.push(now);
    socketRates.set(socketId, times);
    return times.length > limit; // true = rate limited
}
// Clean up periodically
setInterval(() => {
    for (const [id, times] of socketRates) {
        if (times.length === 0 || Date.now() - times[times.length - 1] > 60000) {
            socketRates.delete(id);
        }
    }
}, 60000);

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'Skorch multiplayer server running', rooms: listRooms().length });
});

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Create a new game room
    socket.on('create-room', ({ username }) => {
        if (rateLimit(socket.id)) { socket.emit('error', { message: 'Too many requests' }); return; }
        if (!validateString(username, 20)) return;
        const room = createRoom(socket.id, username);
        socket.join(room.code);
        socket.emit('room-created', { code: room.code, playerId: 'player1' });
        console.log(`Room ${room.code} created by ${username}`);
    });

    // Join existing room
    socket.on('join-room', ({ code, username }) => {
        if (rateLimit(socket.id)) { socket.emit('error', { message: 'Too many requests' }); return; }
        if (!validateString(code, 4) || !validateString(username, 20)) return;
        const room = getRoom(code);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        if (room.players.length >= 2) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        joinRoom(code, socket.id, username);
        socket.join(code);
        socket.emit('room-joined', { code, playerId: 'player2' });

        // Start the game
        const state = createGameState(true);
        room.state = state;
        room.started = true;

        // Send each player their view
        const p1Socket = io.sockets.sockets.get(room.players[0].socketId);
        const p2Socket = io.sockets.sockets.get(room.players[1].socketId);

        if (p1Socket) p1Socket.emit('game-start', getPlayerView(state, 'player', room));
        if (p2Socket) p2Socket.emit('game-start', getPlayerView(state, 'computer', room));

        console.log(`Room ${code}: game started`);
    });

    // Player makes a move
    socket.on('play-cards', ({ roomCode, indexes }) => {
        if (rateLimit(socket.id)) { socket.emit('error', { message: 'Too many requests' }); return; }
        if (!validateIndexes(indexes)) { socket.emit('error', { message: 'Invalid move' }); return; }
        const room = getRoom(roomCode);
        if (!room || !room.state) return;

        const who = getPlayerRole(room, socket.id);
        if (!who || room.state.currentTurn !== who) {
            socket.emit('error', { message: 'Not your turn' });
            return;
        }

        const result = playFromHand(room.state, who, indexes);
        if (result.success) {
            if (result.effect !== 'pickup') {
                drawCard(room.state, who);
            }

            // Check win
            if (checkWin(room.state, who)) {
                room.state.gameOver = true;
                room.state.winner = who;
                broadcastState(room);
                io.to(roomCode).emit('game-over', { winner: who });
                return;
            }

            // Handle shield (same player goes again)
            if (result.effect !== 'shield') {
                nextTurn(room.state);
            }
        }

        broadcastState(room);
        io.to(roomCode).emit('move-result', { who, result });
    });

    // Player picks up discard pile
    socket.on('pickup', ({ roomCode }) => {
        if (rateLimit(socket.id)) { socket.emit('error', { message: 'Too many requests' }); return; }
        if (!validateString(roomCode, 4)) return;
        const room = getRoom(roomCode);
        if (!room || !room.state) return;

        const who = getPlayerRole(room, socket.id);
        if (!who || room.state.currentTurn !== who) {
            socket.emit('error', { message: 'Not your turn' });
            return;
        }

        pickupDiscardPile(room.state, who);
        drawCard(room.state, who);
        nextTurn(room.state);

        broadcastState(room);
        io.to(roomCode).emit('move-result', { who, result: { message: 'Picked up discard pile', effect: 'pickup' } });
    });

    // Player plays from prison
    socket.on('play-prison', ({ roomCode, row, index }) => {
        if (rateLimit(socket.id)) { socket.emit('error', { message: 'Too many requests' }); return; }
        if (!['front','back'].includes(row) || !validateInt(index, 0, 4)) return;
        const room = getRoom(roomCode);
        if (!room || !room.state) return;

        const who = getPlayerRole(room, socket.id);
        if (!who || room.state.currentTurn !== who) {
            socket.emit('error', { message: 'Not your turn' });
            return;
        }

        const result = playFromPrison(room.state, who, row, index);
        if (result.success && result.effect !== 'pickup') {
            drawCard(room.state, who);

            if (checkWin(room.state, who)) {
                room.state.gameOver = true;
                room.state.winner = who;
                broadcastState(room);
                io.to(roomCode).emit('game-over', { winner: who });
                return;
            }

            if (result.effect !== 'shield') {
                nextTurn(room.state);
            }
        } else if (result.effect === 'pickup') {
            nextTurn(room.state);
        }

        broadcastState(room);
        io.to(roomCode).emit('move-result', { who, result });
    });

    // Undead swap
    socket.on('undead-swap', ({ roomCode, myCard, theirCard }) => {
        if (rateLimit(socket.id)) { socket.emit('error', { message: 'Too many requests' }); return; }
        const room = getRoom(roomCode);
        if (!room || !room.state) return;
        const who = getPlayerRole(room, socket.id);
        if (!who) return;
        // SECURITY: Verify an Undead card was actually played (check discard pile top)
        const topCard = room.state.discardPile[room.state.discardPile.length - 1];
        if (!topCard || topCard.type !== 'undead') return; // No undead on pile
        // Validate myCard and theirCard are objects with valid row/index
        if (theirCard && (typeof theirCard.row !== 'string' || typeof theirCard.index !== 'number')) return;
        if (myCard && (typeof myCard.row !== 'string' || typeof myCard.index !== 'number')) return;
        if (theirCard && !['front', 'back'].includes(theirCard.row)) return;
        if (myCard && !['front', 'back'].includes(myCard.row)) return;
        if (theirCard && (theirCard.index < 0 || theirCard.index > 4)) return;
        if (myCard && (myCard.index < 0 || myCard.index > 4)) return;
        // Execute swap
        if (myCard) { executeUndeadSwap(room.state, who, myCard, theirCard); }
        else { executeUndeadTake(room.state, who, theirCard); }
        broadcastState(room);
    });

    // Rematch request
    socket.on('rematch', ({ roomCode }) => {
        if (rateLimit(socket.id)) { socket.emit('error', { message: 'Too many requests' }); return; }
        const room = getRoom(roomCode);
        if (!room) return;

        if (!room.rematchVotes) room.rematchVotes = new Set();
        room.rematchVotes.add(socket.id);

        if (room.rematchVotes.size >= 2) {
            // Both players want rematch
            room.state = createGameState(true);
            room.rematchVotes.clear();
            room.started = true;

            const p1Socket = io.sockets.sockets.get(room.players[0].socketId);
            const p2Socket = io.sockets.sockets.get(room.players[1].socketId);
            if (p1Socket) p1Socket.emit('game-start', getPlayerView(room.state, 'player', room));
            if (p2Socket) p2Socket.emit('game-start', getPlayerView(room.state, 'computer', room));
        } else {
            socket.to(roomCode).emit('rematch-requested');
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        const room = removePlayer(socket.id);
        if (room) {
            io.to(room.code).emit('opponent-left');
            console.log(`Player left room ${room.code}`);
        }
        console.log(`Player disconnected: ${socket.id}`);
    });
});

// --- HELPERS ---

function getPlayerRole(room, socketId) {
    if (room.players[0]?.socketId === socketId) return 'player';
    if (room.players[1]?.socketId === socketId) return 'computer'; // player2 uses 'computer' slot in state
    return null;
}

function getPlayerView(state, who, room) {
    const opponent = who === 'player' ? 'computer' : 'player';
    const myIndex = who === 'player' ? 0 : 1;
    const oppIndex = who === 'player' ? 1 : 0;
    // Map currentTurn relative to this player
    // If state says 'player' and who is 'player' → it's my turn
    // If state says 'computer' and who is 'computer' → it's my turn
    const isMyTurn = state.currentTurn === who;
    // Map winner relative to this player
    const didIWin = state.winner === who;
    return {
        myHand: state[who].hand,
        myPrison: state[who].prison,
        opponentHandCount: state[opponent].hand.length,
        opponentPrison: maskPrison(state[opponent].prison),
        discardPile: state.discardPile,
        deckCount: state.deck.length,
        currentTurn: isMyTurn ? 'player' : 'computer',
        effectiveValue: getEffectiveValue(state),
        gameOver: state.gameOver,
        winner: state.winner ? (didIWin ? 'player' : 'computer') : null,
        turnCount: state.turnCount,
        myName: room?.players[myIndex]?.username || 'You',
        opponentName: room?.players[oppIndex]?.username || 'Opponent'
    };
}

function maskPrison(prison) {
    // Show face-up cards, hide face-down
    const masked = { front: [], back: [] };
    for (const row of ['front', 'back']) {
        for (const slot of prison[row]) {
            if (slot.card === null) {
                masked[row].push({ card: null, faceUp: false });
            } else if (slot.faceUp) {
                masked[row].push({ card: slot.card, faceUp: true });
            } else {
                masked[row].push({ card: { type: 'unknown' }, faceUp: false });
            }
        }
    }
    return masked;
}

function broadcastState(room) {
    if (!room.players[0] || !room.players[1]) return;
    const p1Socket = io.sockets.sockets.get(room.players[0].socketId);
    const p2Socket = io.sockets.sockets.get(room.players[1].socketId);
    if (p1Socket) p1Socket.emit('state-update', getPlayerView(room.state, 'player', room));
    if (p2Socket) p2Socket.emit('state-update', getPlayerView(room.state, 'computer', room));
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Skorch multiplayer server running on port ${PORT}`);
});
