# Skorch Phase 2 - Animations, Multiplayer, AI Levels, Sound

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Take the working Skorch game from functional to polished and multiplayer-ready. Animations make it feel like a real card game, difficulty levels make it accessible, multiplayer makes it social, sound makes it immersive.

**Architecture:** Animations via CSS transitions + JS orchestration. Multiplayer via WebSocket (Socket.io on a lightweight Node server OR peer-to-peer via WebRTC for serverless). AI difficulty as strategy presets applied to the existing AI module. Sound via Web Audio API with preloaded audio sprites.

**Priority Order:** Animations → AI Difficulty → Sound → Multiplayer (multiplayer is the biggest lift, save it for last)

---

## Phase 2A: Animations

**Why first:** The game feels flat without card movement. Every play just swaps DOM elements instantly. Animations give feedback and make the game feel real.

---

### Task 11: Animation System Foundation

**Files:**
- Create: `js/ui/animations.js`
- Modify: `css/styles.css` (add animation keyframes + transition classes)

**What to build:**

Core animation utility that the renderer calls before swapping DOM:

```javascript
// js/ui/animations.js

// Animate a card from one position to another
export function animateCard(cardEl, fromRect, toRect, duration = 300)

// Animate a card flip (face-down to face-up)
export function animateFlip(cardEl, duration = 400)

// Animate card being dealt (slide in from deck position)
export function animateDeal(cardEl, deckPosition, delay = 0)

// Animate discard pile burn (cards scatter/fade)
export function animateBurn(discardEl, duration = 500)

// Animate pickup (cards slide from discard to hand)
export function animatePickup(cards, fromRect, toRect, stagger = 50)

// Wait for animation to complete before continuing
export function waitForAnimation(duration)
```

**CSS keyframes needed:**

```css
@keyframes slideIn { from { transform: translateX(-100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes slideOut { from { opacity: 1; } to { transform: translateY(-50px); opacity: 0; } }
@keyframes flipCard { 0% { transform: rotateY(0); } 50% { transform: rotateY(90deg); } 100% { transform: rotateY(0); } }
@keyframes burnCard { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(0) rotate(45deg); opacity: 0; } }
@keyframes shakeCard { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
@keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
```

**Step 1:** Create animations.js with the utility functions using CSS transforms and requestAnimationFrame.

**Step 2:** Add keyframes and `.animating` class to styles.css.

**Step 3:** Commit: `feat: animation system foundation`

---

### Task 12: Wire Animations into Game Flow

**Files:**
- Modify: `js/main.js` (add animation calls between state changes and renders)
- Modify: `js/ui/renderer.js` (add data attributes for card positions)

**Animations to wire:**

| Game Action | Animation |
|-------------|-----------|
| Player plays card(s) | Card slides from hand to discard pile |
| Computer plays card(s) | Card slides from computer area to discard |
| Draw card | Card slides from deck to hand (player) or deck to computer area |
| Pick up discard | Cards fan out then slide to hand |
| Skorch burn | Cards in discard scatter/shrink/fade, flame effect |
| Face-down prison flip | Card rotates Y-axis, reveals face |
| Invalid prison play | Card shakes, then slides to hand with discard pile |
| Shield played | Brief flash/pulse effect |
| Game start deal | Cards slide out one by one to positions |

**Key principle:** State updates happen FIRST, then we animate, THEN we render the new state. The animation is purely visual - it doesn't affect game logic.

**Step 1:** Modify main.js to add `await` delays between state change and update() calls for key actions.

**Step 2:** Add position tracking to renderer (data-card-id attributes so we can find cards for animation).

**Step 3:** Wire specific animations: play card, draw card, Skorch burn.

**Step 4:** Commit: `feat: card animations for play, draw, and burn`

---

### Task 13: Deal Animation (Game Start)

**Files:**
- Modify: `js/main.js`
- Modify: `js/ui/animations.js`

When game starts or restarts, animate the deal:
1. Show empty board
2. Deal prison cards one by one (alternating player/computer, back row then front row)
3. Deal hand cards one by one
4. Flip the first discard card

**Step 1:** Create `animateDealSequence(state, root)` function.

**Step 2:** Call it from `onRestart()` and initial load instead of immediate `update()`.

**Step 3:** Commit: `feat: animated card dealing on game start`

---

## Phase 2B: AI Difficulty Levels

**Why second:** Quick win. The AI module is already modular - difficulty is just tweaking thresholds and strategy choices.

---

### Task 14: Difficulty System

**Files:**
- Modify: `js/ai/computer.js`
- Modify: `js/ui/renderer.js` (difficulty selector in header)
- Modify: `js/main.js` (store/load difficulty preference)

**Three levels:**

| Level | Strategy | Description |
|-------|----------|-------------|
| **Easy** | Plays randomly from valid cards. No stacking. Never uses specials strategically. | For learning the game |
| **Medium** | Current AI behavior. Plays lowest valid, stacks when smart, uses specials when no attacks. | Fair challenge |
| **Hard** | Card counting (tracks what's been played). Probability-based decisions. Saves high cards. Bluffs with specials. Targets opponent's weaknesses. | Competitive |

**Step 1:** Add difficulty enum and a `getDifficulty()` / `setDifficulty()` that stores in localStorage.

**Step 2:** Create `easyTurn(state)` - randomly picks a valid card, no stacking logic.

**Step 3:** Rename current `computerTurn` to `mediumTurn`.

**Step 4:** Create `hardTurn(state)` - adds:
- Card counting: track all played cards, calculate probability of what's left in deck
- Save high cards: don't play 10s and 9s unless necessary
- Strategic specials: play Shield when opponent has 1-2 cards, play Demoter then immediately follow with a low card
- Stack optimization: hold matching cards to stack later rather than playing singles
- Prison awareness: factor in visible prison cards for both players

**Step 5:** Add difficulty selector dropdown/buttons to the header in renderer.

**Step 6:** Wire difficulty selection to localStorage and AI routing.

**Step 7:** Commit: `feat: easy/medium/hard AI difficulty levels`

---

## Phase 2C: Sound Effects

**Why third:** Adds polish and feel. No gameplay impact.

---

### Task 15: Sound System

**Files:**
- Create: `js/ui/sound.js`
- Create: `assets/sounds/` directory
- Modify: `js/main.js` (trigger sounds on game events)
- Modify: `js/ui/renderer.js` (mute button in header)

**Sounds needed:**

| Event | Sound | Description |
|-------|-------|-------------|
| Play card | `card-play.mp3` | Quick snap/slap |
| Draw card | `card-draw.mp3` | Soft slide |
| Stack cards | `card-stack.mp3` | Multiple card snap |
| Pick up pile | `card-pickup.mp3` | Shuffling/gathering sound |
| Skorch burn | `fire-burn.mp3` | Whoosh/fire burst |
| Shield | `shield-clang.mp3` | Metal shield clang |
| Demoter | `demoter-reset.mp3` | Power-down sound |
| Elude | `elude-whoosh.mp3` | Quick dodge/whoosh |
| Undead | `undead-groan.mp3` | Dark/eerie tone |
| Invalid play | `error-buzz.mp3` | Buzzer/wrong sound |
| Win | `victory.mp3` | Triumphant fanfare |
| Lose | `defeat.mp3` | Sad trombone or dramatic loss |
| Turn start | `turn-ding.mp3` | Subtle notification |

**Sound system design:**

```javascript
// js/ui/sound.js
const sounds = {};
let muted = false;

export function initSound()      // Preload all audio files
export function play(name)       // Play a sound by name
export function toggleMute()     // Toggle mute on/off
export function isMuted()        // Check mute state
```

**Step 1:** Create sound.js module with preload, play, and mute functions. Use Web Audio API for low-latency playback.

**Step 2:** Source or generate sound effects. Options:
- Free SFX sites (freesound.org, mixkit.co)
- Generate with Web Audio API (procedural sounds - no files needed)
- AI-generated sound effects

**Step 3:** Add mute/unmute button to header (speaker icon).

**Step 4:** Wire sound triggers in main.js for each game event.

**Step 5:** Store mute preference in localStorage.

**Step 6:** Commit: `feat: sound effects system with mute toggle`

---

## Phase 2D: Multiplayer

**Why last:** Biggest lift. Requires server infrastructure, networking, game state synchronization, lobby system.

---

### Task 16: Multiplayer Architecture Decision

**Two options:**

**Option A: WebSocket Server (Socket.io + Node.js)**
- Dedicated server hosts game state
- Players connect via WebSocket
- Server is authority (prevents cheating)
- Requires hosting (Render, Railway, Fly.io - free tiers available)
- Better for competitive play

**Option B: Peer-to-Peer (PeerJS / WebRTC)**
- No server needed (just a signaling server for connection setup)
- One player hosts, other joins via code
- Game state lives on host's browser
- Deployable entirely on Netlify (serverless)
- Simpler but host has advantage (can inspect state)

**Recommendation:** Option A (WebSocket) for a real game. Option B for quick prototype.

---

### Task 17: Multiplayer Server

**Files:**
- Create: `server/` directory
- Create: `server/index.js` (Express + Socket.io)
- Create: `server/game-room.js` (game state management per room)
- Create: `server/package.json`

**Server responsibilities:**
- Create/join game rooms (room code system)
- Hold authoritative game state per room
- Validate all moves server-side
- Broadcast state updates to both players
- Handle disconnection/reconnection
- Turn timer (optional - prevent AFK)

**Room flow:**
1. Player 1 creates room → gets 4-letter code (e.g., "FIRE")
2. Player 2 enters code → joins room
3. Server deals cards, sends each player their view
4. Players send moves, server validates and broadcasts
5. Game continues until win condition

**Step 1:** Set up Node.js project with Express + Socket.io.

**Step 2:** Create room management (create, join, leave, timeout).

**Step 3:** Port game engine to run server-side (same logic, Node.js compatible).

**Step 4:** Commit: `feat: multiplayer server with room management`

---

### Task 18: Multiplayer Client

**Files:**
- Create: `js/multiplayer/client.js` (Socket.io client)
- Create: `js/multiplayer/lobby.js` (room create/join UI)
- Modify: `js/ui/renderer.js` (show opponent's visible state)
- Modify: `js/main.js` (multiplayer mode switch)

**What each player sees:**
- Their own hand (face up)
- Opponent's hand count (face down cards, number visible)
- Both prisons (face-up cards visible, face-down cards hidden)
- Discard pile (top card)
- Draw pile (count)
- Whose turn it is

**What each player CANNOT see:**
- Opponent's hand cards
- Face-down prison cards (either player's)
- Deck contents

**Client flow:**

```javascript
// Lobby screen
showLobby()
  → createRoom() → show room code, wait for opponent
  → joinRoom(code) → connect to existing room

// Game screen (same as single player but moves go to server)
onCardSelect()  → same UI behavior
onPlaySelected() → send move to server instead of local engine
onPickup()       → send pickup action to server
onPrisonClick()  → send prison play to server

// Server sends back:
'state-update'   → re-render with new state
'invalid-move'   → show error, don't change state
'game-over'      → show win/lose screen
'opponent-left'  → show disconnection message
```

**Step 1:** Create lobby UI (create room / enter code).

**Step 2:** Create Socket.io client module.

**Step 3:** Add multiplayer mode to main.js (switches between local engine and server for move processing).

**Step 4:** Update renderer to handle "opponent view" (limited info).

**Step 5:** Commit: `feat: multiplayer client with lobby and game sync`

---

### Task 19: Multiplayer Polish

**Files:**
- Modify: various

**Features:**
- Rematch button after game ends
- Chat / emoji reactions during game
- Turn timer (30 seconds per turn, auto-pickup on timeout)
- Connection status indicator
- Reconnection handling (rejoin if you refresh)
- Spectator mode (optional)

**Step 1:** Add rematch flow (both players must agree).

**Step 2:** Add turn timer with visual countdown.

**Step 3:** Add connection status indicator.

**Step 4:** Commit: `feat: multiplayer polish - rematch, timer, connection status`

---

## Phase 2E: Deploy

### Task 20: Deploy to Netlify

**Single player (static):**
- Drag Skorch JS folder to Netlify
- Works immediately - no build step needed

**Multiplayer server:**
- Deploy server to Render / Railway / Fly.io (free tier)
- Update client to point to server URL
- Set CORS for Netlify domain

**Step 1:** Deploy static game to Netlify.

**Step 2:** If multiplayer is built, deploy server separately.

**Step 3:** Connect client to server URL.

**Step 4:** Test end-to-end.

---

## Summary

| Phase | Tasks | Estimated Time | Priority |
|-------|-------|---------------|----------|
| **2A: Animations** | 11-13 | 2-3 hours | High - makes it feel real |
| **2B: AI Difficulty** | 14 | 1-2 hours | Medium - accessibility |
| **2C: Sound** | 15 | 1-2 hours | Medium - polish |
| **2D: Multiplayer** | 16-19 | 6-10 hours | High - but biggest lift |
| **2E: Deploy** | 20 | 30 min | Do anytime |

**Total estimated: 11-18 hours across all phases**
