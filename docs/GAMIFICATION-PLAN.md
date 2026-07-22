# Skorch Gamification Plan

## Master Build Order

1. **Levels + XP system** — Database + API + profile display
2. **Badges** — Database + tracking + profile display
3. **Updated signup flow** — First/last name, birthday, location on registration
4. **Public lobbies on homepage** — Show open rooms anyone can join
5. **Player search** — Simple search bar
6. **Monetization** — Stripe integration + cosmetic shop
7. **Tournaments** — Way down the road

---

## Signup Flow (Phase 3)

When they register, collect:
1. Username (required)
2. Email (required)
3. Password (required)
4. First Name (required)
5. Last Name (required)
6. Birthday (required — gates age verification)
7. City/State/Country (required)

**Display name rule:** Username shows everywhere across the site. Full name only visible on their own profile page.

---

## Technical Build Details

### Phase 1: Database & API Foundation
1. Migration: Add XP, level, badge columns to stats table
2. Create badges table (badge definitions)
3. Create user_badges table (earned badges per user)
4. Create XP/level calculation API endpoint
5. Update match.php to award XP after every game

### Phase 2: XP & Levels (1-100)

**XP Awards:**
| Action | XP |
|--------|-----|
| Win vs AI | +15 |
| Win vs Player | +40 |
| Lose (still played) | +10 |
| Play a Skorch card | +5 |
| Win streak 3+ | +15 bonus |
| First game of the day | +20 bonus |
| Earn a badge | +50-500 |

**Level Curve:**
| Levels | XP Per Level | Cumulative |
|--------|-------------|------------|
| 1-10 | 100 each | 1,000 |
| 11-25 | 250 each | 4,750 |
| 26-50 | 500 each | 17,250 |
| 51-75 | 1,000 each | 42,250 |
| 76-100 | 2,000 each | 92,250 |

### Phase 3: Badges

**Gameplay Badges:**
| ID | Badge | Condition | XP Reward |
|----|-------|-----------|-----------|
| first_blood | First Blood | Win 1 game | 50 |
| hot_streak | Hot Streak | Win 5 in a row | 100 |
| inferno | Inferno | Win 10 in a row | 200 |
| centurion | Centurion | Play 100 games | 150 |
| veteran | Veteran | Play 500 games | 300 |
| skorch_master | Skorch Master | Play 1,000 games | 500 |
| untouchable | Untouchable | Win without picking up pile | 200 |
| prison_break | Prison Break | Win from last prison card | 150 |
| burn_notice | Burn Notice | Play 50 Skorch cards | 100 |
| arsonist | Arsonist | Play 200 Skorch cards | 200 |
| shield_wall | Shield Wall | Play 100 Shield cards | 100 |
| undead_army | Undead Army | Play 100 Undead cards | 100 |
| elude_artist | Elude Artist | Play 100 Elude cards | 100 |
| speed_demon | Speed Demon | Win in under 3 minutes | 150 |

**Social Badges:**
| ID | Badge | Condition | XP Reward |
|----|-------|-----------|-----------|
| friendly | Friendly | Add 1 friend | 50 |
| social_butterfly | Social Butterfly | Have 10 friends | 100 |
| popular | Popular | Have 25 friends | 200 |
| chatty | Chatty | Send 100 chat messages | 100 |
| rival | Rival | Play same person 10 times | 150 |

**Competitive Badges:**
| ID | Badge | Condition | XP Reward |
|----|-------|-----------|-----------|
| elo_rising | Elo Rising | Reach 1300 Elo | 100 |
| elo_elite | Elo Elite | Reach 1400 Elo | 200 |
| elo_legend | Elo Legend | Reach 1500 Elo | 300 |
| giant_slayer | Giant Slayer | Beat someone 200+ Elo above you | 200 |
| king_slayer | King Slayer | Beat the #1 ranked player | 300 |
| the_crown | The Crown | Become Skorch King | 500 |
| defender | Defender | Hold Skorch King 7 days | 300 |

**Loyalty Badges:**
| ID | Badge | Condition | XP Reward |
|----|-------|-----------|-----------|
| day_one | Day One | Create account | 50 |
| weekly_warrior | Weekly Warrior | Play every day for 7 days | 150 |
| monthly_grinder | Monthly Grinder | Play 50 games in one month | 200 |
| og | OG | Account older than 6 months | 200 |

### Phase 4: Profile Updates
1. Show level + XP progress bar on profile
2. Show earned badges grid on profile
3. Show badge count in stats
4. Username everywhere (not display name)
5. Full name only visible on own profile page
6. Location under username on profile

### Phase 5: Registration Update
1. Add first_name, last_name to registration form
2. Add birthday (required)
3. Add city/state/country (required, text input for now)
4. Username remains the public identity everywhere

### Phase 6: Leaderboard Redesign
1. Podium for top 3 (avatar, username, Elo)
2. Clean list for 4+ (rank, avatar, username, level, Elo)
3. Filter tabs if needed

### Phase 7: Awards (Time-Based)
1. Skorch King — highest Elo
2. Most Active — most games this month
3. Hot Hand — highest win streak this week
4. Rising Star — biggest Elo gain this month
5. Show as special banner on profile, rotates monthly

---

## Technical Implementation

### Database Changes
```sql
-- Add to stats table
ALTER TABLE stats ADD COLUMN xp INTEGER DEFAULT 0;
ALTER TABLE stats ADD COLUMN level INTEGER DEFAULT 1;
ALTER TABLE stats ADD COLUMN total_skorch_plays INTEGER DEFAULT 0;
ALTER TABLE stats ADD COLUMN total_shield_plays INTEGER DEFAULT 0;
ALTER TABLE stats ADD COLUMN total_undead_plays INTEGER DEFAULT 0;
ALTER TABLE stats ADD COLUMN total_elude_plays INTEGER DEFAULT 0;
ALTER TABLE stats ADD COLUMN total_chat_messages INTEGER DEFAULT 0;
ALTER TABLE stats ADD COLUMN last_game_date TEXT DEFAULT NULL;
ALTER TABLE stats ADD COLUMN daily_streak INTEGER DEFAULT 0;

-- Add to users table
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;
ALTER TABLE users ADD COLUMN city TEXT;
ALTER TABLE users ADD COLUMN state_region TEXT;
ALTER TABLE users ADD COLUMN country TEXT;

-- New table: badge definitions
CREATE TABLE badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    xp_reward INTEGER DEFAULT 50,
    icon TEXT
);

-- New table: earned badges
CREATE TABLE user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    badge_id TEXT NOT NULL,
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (badge_id) REFERENCES badges(id),
    UNIQUE(user_id, badge_id)
);
```

### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| GET /api/badges.php?user=X | Get user's earned badges |
| GET /api/badges.php?action=all | Get all badge definitions |
| POST /api/check-badges.php | Check & award any newly earned badges (called after match) |
| GET /api/xp.php?user=X | Get XP, level, progress to next level |

### Badge Check Flow
After every match:
1. match.php records the match + updates stats
2. match.php calls badge check logic
3. Badge check compares stats against all badge conditions
4. Any newly earned badges get inserted into user_badges
5. XP from badge rewards gets added to stats.xp
6. Level recalculated from total XP
7. Response includes any new badges earned (for UI notification)
