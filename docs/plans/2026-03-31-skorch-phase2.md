# Skorch Phase 2 - Full Product Plan

**Updated:** March 31, 2026

---

## Status Overview

| Phase | Status | Notes |
|-------|--------|-------|
| 2A: Animations | Partial | Foundation built, announcements done, deal animation TODO |
| 2B: AI | Done | Scoring engine + card counting + opponent awareness + audit fixes |
| 2C: Sound | TODO | |
| 2D: Multiplayer | TODO | Architecture decided (see below) |
| 2E: Backend (Accounts/Stats) | TODO | Architecture decided (see below) |
| 2F: Deploy | TODO | |

---

## Completed Work (This Session)

### Game Engine
- Full vanilla JS rebuild from PHP (cards, deck, prison, game logic)
- All card rules implemented and audited
- V4 card art integrated
- localStorage game persistence
- Burned cards tracking (Skorch removes from game)
- Elude value 1 on empty pile (fixed)
- Only attack cards can stack (fixed)
- Face-up prison strategic play (intentional pickup)
- Undead take goes to prison slot, not hand (fixed)
- Undead swap transfers faceUp status with card (fixed)

### AI
- Scoring-based AI (evaluates every possible move)
- Card counting (tracks played/burned/remaining cards)
- Opponent awareness (tracks known cards from pickups)
- Strategic scoring: block, trap, dump prevention, endgame pressure
- Prison play scoring (same system as hand plays)
- Undead swap scoring (face-down targets, special priority)
- Full audit completed with 19 fixes applied

### UI/UX
- Side-by-side layout (player left, computer right)
- Draggable center piles (discard + buttons + draw, saves position)
- Fixed status bar at viewport bottom
- Turn indicator in header
- Value-to-beat badge on discard pile (when special on top)
- Special card announcements (SKORCH!, SHIELD!, etc.)
- Skorch flame particles
- Win/lose screen
- Enter key to play selected cards
- Green felt table background
- Card edge visibility (dark cards on dark background)
- Processing lock (prevents double-click plays)
- Announcement overlay blocks clicks
- Event listener cleanup on re-render
- Stale timeout cancellation on restart

---

## Phase 2A: Animations (Remaining)

### TODO: Deal Animation
- Animate cards being dealt on game start/restart
- Cards slide to positions one by one
- Prison cards flip to reveal face-up ones

### TODO: Card Play Animation
- Card slides from hand to discard pile
- Pop effect on discard pile when card lands

### TODO: Pickup Animation
- Cards fan out from discard, then collect into hand

---

## Phase 2C: Sound Effects

### Sounds Needed

| Event | Sound |
|-------|-------|
| Play card | Quick snap/slap |
| Draw card | Soft slide |
| Stack cards | Multiple card snap |
| Pick up pile | Shuffling/gathering |
| Skorch burn | Whoosh/fire burst |
| Shield | Metal clang |
| Demoter | Power-down |
| Elude | Quick whoosh |
| Undead | Dark/eerie tone |
| Invalid play | Buzzer |
| Win | Triumphant fanfare |
| Lose | Dramatic loss |

### Implementation
- Web Audio API for low-latency playback
- Mute button in header
- Mute preference saved to localStorage
- Procedural sounds (no external files) OR free SFX from mixkit/freesound

---

## Phase 2D: Multiplayer

### Architecture Decision: Split Hosting

| Component | Host | Tech | Cost |
|-----------|------|------|------|
| Game frontend | SiteGround | Static JS/HTML/CSS | $0 (existing) |
| Accounts, auth, stats | SiteGround | PHP + SQLite | $0 (existing) |
| Multiplayer server | Render.com free tier | Node.js + Socket.io | $0 |

### Why Split
- SiteGround shared hosting does NOT support Node.js or WebSockets
- Render.com free tier: 750 hrs/month, spins down after 15 min inactivity
- Zero cost. If game gets popular, Render paid = $7/month for always-on
- Same approach as Outposts (PHP + SQLite on SiteGround)

### Multiplayer Server (Render.com)

**Room System:**
- Player 1 creates room → gets 4-letter code (e.g., "FIRE")
- Player 2 enters code → joins room
- Server holds authoritative game state
- Validates all moves server-side
- Broadcasts state updates to both players

**What Each Player Sees:**
- Their own hand (face up)
- Opponent's hand COUNT (face down)
- Both prisons (face-up visible, face-down hidden)
- Discard pile (top card)
- Draw pile (count)
- Whose turn it is

**Server Responsibilities:**
- Create/join game rooms
- Hold authoritative game state per room
- Validate all moves
- Broadcast state updates
- Handle disconnection/reconnection
- Turn timer (30 sec, auto-pickup on timeout)

### Multiplayer Client
- Socket.io client connects to Render server
- Same game UI, but moves sent to server instead of local engine
- Lobby screen: create room / enter code
- Connection status indicator

### Multiplayer Polish
- Rematch button
- Turn timer with visual countdown
- Reconnection handling
- Chat / emoji reactions (optional)

---

## Phase 2E: Backend (Accounts & Stats)

### Hosted on SiteGround (PHP + SQLite)

**Database Schema:**
```sql
-- Users
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Game Stats
CREATE TABLE stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    win_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    total_skorches INTEGER DEFAULT 0,
    total_shields INTEGER DEFAULT 0,
    total_undeads INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Match History
CREATE TABLE matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1_id INTEGER,
    player2_id INTEGER,
    winner_id INTEGER,
    game_type TEXT DEFAULT 'ai',  -- 'ai' or 'pvp'
    duration_seconds INTEGER,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player1_id) REFERENCES users(id),
    FOREIGN KEY (player2_id) REFERENCES users(id)
);

-- Leaderboard (derived from stats, queried live)
```

**API Endpoints (PHP):**
```
POST /api/register     - Create account
POST /api/login        - Login (returns session token)
GET  /api/profile      - Get user profile + stats
GET  /api/leaderboard  - Top players by wins/streak
POST /api/match        - Record match result
GET  /api/history      - Match history for user
```

**Auth:**
- PHP sessions or JWT tokens
- Password hashing with bcrypt
- Remember me cookie (optional)

---

## Phase 2F: Deploy

### Step 1: Deploy game to SiteGround
- Upload Skorch JS folder to SiteGround
- Works immediately (static files)
- Point domain: skorchthegame.com/play or play.skorchthegame.com

### Step 2: Deploy backend to SiteGround
- Upload PHP files
- Create SQLite database
- Test auth + stats endpoints

### Step 3: Deploy multiplayer server to Render
- Push Node.js server to GitHub
- Connect Render to repo (auto-deploy)
- Update game client with Render WebSocket URL
- Set CORS for SiteGround domain

### Step 4: Test end-to-end
- Register account on SiteGround
- Play AI game → stats recorded
- Create multiplayer room → join from another browser
- Play PvP game → stats recorded for both players
- Check leaderboard

---

## Priority Order

1. **Sound effects** - Quick win, adds polish
2. **Remaining animations** - Deal, play, pickup
3. **Backend (accounts/stats)** - PHP + SQLite on SiteGround
4. **Deploy single-player** - Get it live on skorchthegame.com
5. **Multiplayer server** - Node.js + Socket.io on Render
6. **Multiplayer client** - Lobby, room codes, game sync
7. **Multiplayer polish** - Rematch, timer, reconnection

---

## Known Issues (From Audit)

### Engine
- Undead replayability: card stays in discard, can be picked up and replayed. Verify if intentional.
- Shield turn skip not enforced in engine (relies on caller). Works but fragile.
- Draw enforcement not in engine (relies on caller).

### AI (Ongoing Tuning)
- Conservation still slightly dominant in some scenarios
- No partial stack generation (play 2 of 3 matching cards)
- No draw-quality estimation
- Prison play scoring could be stronger

### UI
- Computer hand capped at 8 visual cards (cosmetic)
- Draggable position persists across restart
- Player Undead doesn't show announcement overlay (modal serves as feedback)
