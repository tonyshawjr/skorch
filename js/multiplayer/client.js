// js/multiplayer/client.js - Socket.io multiplayer client

let socket = null;
let roomCode = null;
let playerId = null;
let onStateUpdate = null;
let onGameStart = null;
let onGameOver = null;
let onError = null;
let onOpponentLeft = null;
let onRematchRequested = null;
let onRoomCreated = null;
let onRoomJoined = null;

const SERVER_URL = 'https://skorch-multiplayer.onrender.com';

export function connect(handlers) {
    onStateUpdate = handlers.onStateUpdate;
    onGameStart = handlers.onGameStart;
    onGameOver = handlers.onGameOver;
    onError = handlers.onError;
    onOpponentLeft = handlers.onOpponentLeft;
    onRematchRequested = handlers.onRematchRequested;
    onRoomCreated = handlers.onRoomCreated;
    onRoomJoined = handlers.onRoomJoined;

    return new Promise((resolve, reject) => {
        // Load Socket.io from CDN
        if (!window.io) {
            const script = document.createElement('script');
            script.src = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
            script.onload = () => { initSocket().then(resolve).catch(reject); };
            script.onerror = () => reject(new Error('Failed to load Socket.io'));
            document.head.appendChild(script);
        } else {
            initSocket().then(resolve).catch(reject);
        }
    });
}

function initSocket() {
    return new Promise((resolve, reject) => {
        socket = window.io(SERVER_URL, {
            transports: ['websocket', 'polling'],
            timeout: 10000
        });

        socket.on('connect', () => {
            console.log('Connected to multiplayer server');
            resolve();
        });

        socket.on('connect_error', (err) => {
            console.error('Connection error:', err);
            reject(err);
        });

        socket.on('disconnect', () => console.log('Disconnected'));
        socket.on('room-created', (data) => { roomCode = data.code; playerId = data.playerId; if (onRoomCreated) onRoomCreated(data); });
        socket.on('room-joined', (data) => { roomCode = data.code; playerId = data.playerId; if (onRoomJoined) onRoomJoined(data); });
        socket.on('game-start', (view) => { if (onGameStart) onGameStart(view); });
        socket.on('state-update', (view) => { if (onStateUpdate) onStateUpdate(view); });
        socket.on('game-over', (data) => { if (onGameOver) onGameOver(data); });
        socket.on('move-result', () => {});
        socket.on('opponent-left', () => { if (onOpponentLeft) onOpponentLeft(); });
        socket.on('rematch-requested', () => { if (onRematchRequested) onRematchRequested(); });
        socket.on('error', (data) => { if (onError) onError(data.message); });

        setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });
}

export function createRoom(username) {
    if (socket) socket.emit('create-room', { username });
}

export function joinRoom(code, username) {
    if (socket) socket.emit('join-room', { code: code.toUpperCase(), username });
}

export function playCards(indexes) {
    if (socket) socket.emit('play-cards', { roomCode, indexes });
}

export function pickup() {
    if (socket) socket.emit('pickup', { roomCode });
}

export function playPrison(row, index) {
    if (socket) socket.emit('play-prison', { roomCode, row, index });
}

export function undeadSwap(myCard, theirCard) {
    if (socket) socket.emit('undead-swap', { roomCode, myCard, theirCard });
}

export function requestRematch() {
    if (socket) socket.emit('rematch', { roomCode });
}

export function disconnect() {
    if (socket) socket.disconnect();
    socket = null;
    roomCode = null;
    playerId = null;
}

export function getRoomCode() { return roomCode; }
export function getPlayerId() { return playerId; }
export function isConnected() { return socket?.connected || false; }
