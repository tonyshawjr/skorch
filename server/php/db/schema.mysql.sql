SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME NULL,
    display_name VARCHAR(255) NULL,
    avatar_color VARCHAR(32) NULL,
    avatar_url VARCHAR(512) NULL,
    bio TEXT NULL,
    region VARCHAR(255) NULL,
    play_style VARCHAR(255) NULL,
    age INT NULL,
    social_links TEXT NULL,
    last_active DATETIME NULL,
    birthday VARCHAR(32) NULL,
    first_name VARCHAR(255) NULL,
    last_name VARCHAR(255) NULL,
    city VARCHAR(255) NULL,
    state_region VARCHAR(255) NULL,
    country VARCHAR(255) NULL,
    is_admin INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    games_played INT DEFAULT 0,
    win_streak INT DEFAULT 0,
    best_streak INT DEFAULT 0,
    total_skorches INT DEFAULT 0,
    total_shields INT DEFAULT 0,
    total_undeads INT DEFAULT 0,
    elo_rating INT DEFAULT 1200,
    xp INT DEFAULT 0,
    level INT DEFAULT 1,
    total_skorch_plays INT DEFAULT 0,
    total_shield_plays INT DEFAULT 0,
    total_undead_plays INT DEFAULT 0,
    total_elude_plays INT DEFAULT 0,
    total_chat_messages INT DEFAULT 0,
    last_game_date VARCHAR(32) NULL,
    daily_streak INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player1_id INT NULL,
    player2_id INT NULL,
    winner_id INT NULL,
    game_type VARCHAR(50) DEFAULT 'ai',
    duration_seconds INT DEFAULT 0,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    difficulty VARCHAR(50) NULL,
    FOREIGN KEY (player1_id) REFERENCES users(id),
    FOREIGN KEY (player2_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE friends (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    friend_id INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE badges (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(512) NOT NULL,
    category VARCHAR(64) NOT NULL,
    xp_reward INT DEFAULT 50,
    icon VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_badges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    badge_id VARCHAR(64) NOT NULL,
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, badge_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (badge_id) REFERENCES badges(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE clans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    tag VARCHAR(50) NULL,
    description TEXT NULL,
    color VARCHAR(20) DEFAULT '#b11f24',
    emblem VARCHAR(255) NULL,
    founder_id INT NOT NULL,
    is_open INT DEFAULT 1,
    member_count INT DEFAULT 1,
    season_points INT DEFAULT 0,
    total_points INT DEFAULT 0,
    firestorm_wins INT DEFAULT 0,
    firestorm_losses INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (founder_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE clan_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clan_id INT NOT NULL,
    user_id INT NOT NULL UNIQUE,
    role VARCHAR(20) DEFAULT 'member',
    season_points INT DEFAULT 0,
    total_points INT DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clan_id) REFERENCES clans(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE clan_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clan_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (clan_id, user_id),
    FOREIGN KEY (clan_id) REFERENCES clans(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE firestorms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    challenger_clan_id INT NOT NULL,
    opponent_clan_id INT NULL,
    roster_size INT DEFAULT 5,
    status VARCHAR(20) DEFAULT 'open',
    challenger_score INT DEFAULT 0,
    opponent_score INT DEFAULT 0,
    winner_clan_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME NULL,
    ends_at DATETIME NULL,
    FOREIGN KEY (challenger_clan_id) REFERENCES clans(id),
    FOREIGN KEY (opponent_clan_id) REFERENCES clans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE firestorm_lineups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    firestorm_id INT NOT NULL,
    clan_id INT NOT NULL,
    user_id INT NOT NULL,
    seed INT NOT NULL,
    FOREIGN KEY (firestorm_id) REFERENCES firestorms(id),
    FOREIGN KEY (clan_id) REFERENCES clans(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE firestorm_matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    firestorm_id INT NOT NULL,
    seed INT NOT NULL,
    challenger_user_id INT NULL,
    opponent_user_id INT NULL,
    winner_user_id INT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    match_id INT NULL,
    played_at DATETIME NULL,
    room_code VARCHAR(20) NULL,
    FOREIGN KEY (firestorm_id) REFERENCES firestorms(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE seasons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    champion_clan_id INT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME NULL,
    FOREIGN KEY (champion_clan_id) REFERENCES clans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE clan_season_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    season_id INT NOT NULL,
    clan_id INT NOT NULL,
    final_points INT DEFAULT 0,
    final_rank INT NULL,
    FOREIGN KEY (season_id) REFERENCES seasons(id),
    FOREIGN KEY (clan_id) REFERENCES clans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bug_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    message TEXT NOT NULL,
    page_url VARCHAR(512) NULL,
    screenshot_url VARCHAR(512) NULL,
    status VARCHAR(20) DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE clan_invites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clan_id INT NOT NULL,
    user_id INT NOT NULL,
    invited_by INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (clan_id, user_id),
    FOREIGN KEY (clan_id) REFERENCES clans(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (invited_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
