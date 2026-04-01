// Game room management

const rooms = new Map();

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
    let code;
    do {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
    } while (rooms.has(code));
    return code;
}

function createRoom(socketId, username) {
    const code = generateCode();
    const room = {
        code,
        players: [{ socketId, username }],
        state: null,
        started: false,
        createdAt: Date.now(),
        rematchVotes: new Set()
    };
    rooms.set(code, room);

    // Clean up old rooms (older than 2 hours)
    for (const [key, r] of rooms) {
        if (Date.now() - r.createdAt > 2 * 60 * 60 * 1000) {
            rooms.delete(key);
        }
    }

    return room;
}

function joinRoom(code, socketId, username) {
    const room = rooms.get(code.toUpperCase());
    if (!room) return null;
    // Cancel any pending delete timer
    if (room.deleteTimer) {
        clearTimeout(room.deleteTimer);
        room.deleteTimer = null;
    }
    room.players.push({ socketId, username });
    return room;
}

function getRoom(code) {
    return rooms.get(code?.toUpperCase()) || null;
}

function removePlayer(socketId) {
    for (const [code, room] of rooms) {
        const idx = room.players.findIndex(p => p.socketId === socketId);
        if (idx !== -1) {
            if (room.started && room.state && !room.state.gameOver) {
                // Game in progress - mark as disconnected, allow 2 min to reconnect
                room.players[idx].socketId = null;
                room.players[idx].disconnectedAt = Date.now();
                // Don't remove from room - rejoin-room will update socketId
            } else {
                room.players.splice(idx, 1);
                if (room.players.length === 0) {
                    room.deleteTimer = setTimeout(() => {
                        rooms.delete(code);
                    }, 5 * 60 * 1000);
                }
            }
            return room;
        }
    }
    return null;
}

function listRooms() {
    return Array.from(rooms.values()).map(r => ({
        code: r.code,
        players: r.players.length,
        started: r.started
    }));
}

module.exports = { createRoom, joinRoom, getRoom, removePlayer, listRooms };
