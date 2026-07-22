CREATE TABLE IF NOT EXISTS clans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    tag TEXT,
    description TEXT,
    color TEXT DEFAULT '#b11f24',
    emblem TEXT,
    founder_id INTEGER NOT NULL,
    is_open INTEGER DEFAULT 1,
    member_count INTEGER DEFAULT 1,
    season_points INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    firestorm_wins INTEGER DEFAULT 0,
    firestorm_losses INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (founder_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS clan_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clan_id INTEGER NOT NULL,
    user_id INTEGER UNIQUE NOT NULL,
    role TEXT DEFAULT 'member',
    season_points INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clan_id) REFERENCES clans(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS clan_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clan_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(clan_id, user_id),
    FOREIGN KEY (clan_id) REFERENCES clans(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS firestorms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenger_clan_id INTEGER NOT NULL,
    opponent_clan_id INTEGER,
    roster_size INTEGER DEFAULT 5,
    status TEXT DEFAULT 'open',
    challenger_score INTEGER DEFAULT 0,
    opponent_score INTEGER DEFAULT 0,
    winner_clan_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    ends_at DATETIME,
    FOREIGN KEY (challenger_clan_id) REFERENCES clans(id),
    FOREIGN KEY (opponent_clan_id) REFERENCES clans(id)
);

CREATE TABLE IF NOT EXISTS firestorm_lineups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firestorm_id INTEGER NOT NULL,
    clan_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    seed INTEGER NOT NULL,
    FOREIGN KEY (firestorm_id) REFERENCES firestorms(id),
    FOREIGN KEY (clan_id) REFERENCES clans(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS firestorm_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firestorm_id INTEGER NOT NULL,
    seed INTEGER NOT NULL,
    challenger_user_id INTEGER,
    opponent_user_id INTEGER,
    winner_user_id INTEGER,
    status TEXT DEFAULT 'pending',
    match_id INTEGER,
    played_at DATETIME,
    FOREIGN KEY (firestorm_id) REFERENCES firestorms(id)
);

CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    champion_clan_id INTEGER,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    FOREIGN KEY (champion_clan_id) REFERENCES clans(id)
);

CREATE TABLE IF NOT EXISTS clan_season_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL,
    clan_id INTEGER NOT NULL,
    final_points INTEGER DEFAULT 0,
    final_rank INTEGER,
    FOREIGN KEY (season_id) REFERENCES seasons(id),
    FOREIGN KEY (clan_id) REFERENCES clans(id)
);

CREATE TABLE IF NOT EXISTS bug_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    message TEXT NOT NULL,
    page_url TEXT,
    screenshot_url TEXT,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
