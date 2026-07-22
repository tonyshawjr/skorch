// js/multiplayer/auth.js - Authentication client

const API_URL = '/server/php/api'; // Adjust for production

let currentUser = null;

export function getUser() { return currentUser; }
export function isLoggedIn() { return currentUser !== null; }

export function startHeartbeat() {
    const ping = () => {
        if (currentUser) fetch(`${API_URL}/ping.php`, { credentials: 'include' }).catch(() => {});
    };
    setInterval(ping, 90000);
    ping();
}

export async function register(username, email, password) {
    const res = await fetch(`${API_URL}/register.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
        credentials: 'include'
    });
    const data = await res.json();
    if (data.success) currentUser = data.user;
    return data;
}

export async function login(username, password) {
    const res = await fetch(`${API_URL}/login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
    });
    const data = await res.json();
    if (data.success) currentUser = data.user;
    return data;
}

export async function logout() {
    await fetch(`${API_URL}/logout.php`, { method: 'POST', credentials: 'include' });
    currentUser = null;
}

export async function getProfile() {
    const res = await fetch(`${API_URL}/profile.php`, { credentials: 'include' });
    const data = await res.json();
    if (!data.error) currentUser = data;
    return data;
}

export async function recordMatch(won, gameType = 'ai', duration = 0, stats = {}, opponentName = null, difficulty = null) {
    return fetch(`${API_URL}/match.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            won,
            game_type: gameType,
            duration,
            skorches: stats.skorches || 0,
            shields: stats.shields || 0,
            undeads: stats.undeads || 0,
            opponent_name: opponentName,
            difficulty
        }),
        credentials: 'include'
    }).then(r => r.json()).catch(() => null);
}

export async function getLeaderboard(sort = 'wins', limit = 20) {
    const res = await fetch(`${API_URL}/leaderboard.php?sort=${sort}&limit=${limit}`);
    return res.json();
}

export async function getHistory(limit = 20) {
    const res = await fetch(`${API_URL}/history.php?limit=${limit}`, { credentials: 'include' });
    return res.json();
}
