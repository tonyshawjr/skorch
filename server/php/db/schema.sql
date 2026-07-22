CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    win_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    total_skorches INTEGER DEFAULT 0,
    total_shields INTEGER DEFAULT 0,
    total_undeads INTEGER DEFAULT 0,
    elo_rating INTEGER DEFAULT 1200,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1_id INTEGER,
    player2_id INTEGER,
    winner_id INTEGER,
    game_type TEXT DEFAULT 'ai',
    duration_seconds INTEGER DEFAULT 0,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player1_id) REFERENCES users(id),
    FOREIGN KEY (player2_id) REFERENCES users(id)
);
