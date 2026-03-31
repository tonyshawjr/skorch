# Skorch JS - Complete Game Rebuild

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild Skorch as a pure client-side JavaScript card game with AI opponent, using existing card art, deployable to Netlify with zero server dependencies.

**Architecture:** Vanilla JS with ES modules. Game engine (pure logic, no DOM) separated from UI renderer (DOM manipulation + CSS animations). AI engine as standalone module. State managed via a single GameState object passed between modules. Event-driven UI updates.

**Tech Stack:** Vanilla JavaScript (ES modules), HTML5, CSS3 (animations/transitions), no build tools (native browser ES modules), existing PNG card assets.

---

## Project Structure

```
Skorch JS/
├── index.html              # Single page entry
├── css/
│   └── styles.css          # All game styles
├── js/
│   ├── main.js             # Entry point, wires everything together
│   ├── engine/
│   │   ├── deck.js         # Deck generation, shuffle
│   │   ├── game.js         # Core game state + rules
│   │   ├── cards.js        # Card types, validation, effects
│   │   └── prison.js       # Prison mechanics
│   ├── ai/
│   │   └── computer.js     # AI opponent logic
│   └── ui/
│       ├── renderer.js     # DOM rendering
│       ├── animations.js   # Card animations
│       └── events.js       # Click handlers, selection
├── assets/
│   ├── cards/              # Copied from existing project
│   │   ├── 1.png ... 10.png
│   │   ├── Card-Back.png
│   │   ├── Elude.png
│   │   ├── Shield.png
│   │   ├── demoter.png
│   │   ├── Skorch.png
│   │   └── undead.png
│   ├── logo-red.png
│   └── Logo-x2.png
├── tests/
│   └── engine.test.html    # In-browser test runner
└── docs/
    └── plans/
        └── 2026-03-31-skorch-js-rebuild.md
```

---

## Task 1: Project Scaffold + Card Assets

**Files:**
- Create: `index.html`
- Create: `css/styles.css`
- Create: `js/main.js`
- Copy: `assets/` (from existing project)

**Step 1: Copy card assets from existing project**

```bash
cp -r "/Users/tonyshaw/Documents/Little Big Planet/Skorch copy/assets" "/Users/tonyshaw/Documents/Little Big Planet/Skorch JS/assets"
```

**Step 2: Create index.html scaffold**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Skorch - A Strategic Card Game</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="css/styles.css" rel="stylesheet">
</head>
<body>
    <div id="game-root"></div>
    <script type="module" src="js/main.js"></script>
</body>
</html>
```

**Step 3: Create empty main.js entry point**

```javascript
// js/main.js - Skorch Game Entry Point
console.log('Skorch loaded');
```

**Step 4: Create base styles.css with CSS variables**

```css
/* css/styles.css */
:root {
    --skorch-red: #EB2228;
    --skorch-dark: #242424;
    --skorch-darker: #161718;
    --skorch-light: #FFFFFF;
    --skorch-gray: #EFEFEF;
    --skorch-green: #10b981;
    --skorch-yellow: #eab308;
    --skorch-blue: #3b82f6;

    --card-width: 100px;
    --card-height: 140px;
    --card-radius: 10px;
    --card-overlap: -30px;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    background: var(--skorch-dark);
    color: var(--skorch-light);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    min-height: 100vh;
    margin: 0;
    line-height: 1.5;
}
```

**Step 5: Open in browser to verify scaffold loads**

```bash
open "/Users/tonyshaw/Documents/Little Big Planet/Skorch JS/index.html"
```

**Step 6: Commit**

```bash
cd "/Users/tonyshaw/Documents/Little Big Planet/Skorch JS"
git init && git add -A && git commit -m "feat: project scaffold with card assets"
```

---

## Task 2: Card Data Model + Deck Generation

**Files:**
- Create: `js/engine/cards.js`
- Create: `js/engine/deck.js`

**Step 1: Create cards.js - Card types and constants**

```javascript
// js/engine/cards.js

export const CardType = {
    ATTACK: 'attack',
    ELUDE: 'elude',
    SHIELD: 'shield',
    DEMOTER: 'demoter',
    SKORCH: 'skorch',
    UNDEAD: 'undead'
};

export const SPECIAL_TYPES = [
    CardType.ELUDE,
    CardType.SHIELD,
    CardType.DEMOTER,
    CardType.SKORCH,
    CardType.UNDEAD
];

/**
 * Create a card object.
 * @param {string} type - CardType value
 * @param {number|null} value - Attack value (1-10) or null for specials
 * @returns {object} Card object
 */
export function createCard(type, value = null) {
    return {
        id: crypto.randomUUID(),
        type,
        value,
        name: type === CardType.ATTACK ? `Attack ${value}` : type.charAt(0).toUpperCase() + type.slice(1),
        isSpecial: type !== CardType.ATTACK
    };
}

/**
 * Get the image filename for a card.
 * @param {object} card
 * @returns {string} filename in assets/cards/
 */
export function getCardImage(card) {
    if (card.type === CardType.ATTACK) return `${card.value}.png`;
    const imageMap = {
        [CardType.ELUDE]: 'Elude.png',
        [CardType.SHIELD]: 'Shield.png',
        [CardType.DEMOTER]: 'demoter.png',
        [CardType.SKORCH]: 'Skorch.png',
        [CardType.UNDEAD]: 'undead.png'
    };
    return imageMap[card.type] || 'Card-Back.png';
}
```

**Step 2: Create deck.js - Deck generation and shuffle**

```javascript
// js/engine/deck.js
import { CardType, createCard } from './cards.js';

/**
 * Generate a full 77-card Skorch deck.
 * - 60 Attack cards (ranks 1-10, 6 copies each)
 * - 4 Elude, 4 Shield, 4 Demoter, 4 Skorch
 * - 1 Undead
 */
export function generateDeck() {
    const deck = [];

    // Attack cards: 1-10, 6 of each
    for (let rank = 1; rank <= 10; rank++) {
        for (let i = 0; i < 6; i++) {
            deck.push(createCard(CardType.ATTACK, rank));
        }
    }

    // Special cards
    const specials = [
        { type: CardType.ELUDE, count: 4 },
        { type: CardType.SHIELD, count: 4 },
        { type: CardType.DEMOTER, count: 4 },
        { type: CardType.SKORCH, count: 4 },
        { type: CardType.UNDEAD, count: 1 }
    ];

    for (const { type, count } of specials) {
        for (let i = 0; i < count; i++) {
            deck.push(createCard(type, null));
        }
    }

    return deck;
}

/**
 * Fisher-Yates shuffle (in-place).
 * @param {Array} deck
 * @returns {Array} same array, shuffled
 */
export function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}
```

**Step 3: Verify in browser console**

Add to main.js temporarily:
```javascript
import { generateDeck, shuffleDeck } from './engine/deck.js';
const deck = shuffleDeck(generateDeck());
console.log(`Deck: ${deck.length} cards`);
console.log('Attack cards:', deck.filter(c => c.type === 'attack').length);
console.log('Special cards:', deck.filter(c => c.isSpecial).length);
```

Expected output: `Deck: 77 cards`, `Attack cards: 60`, `Special cards: 17`

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: card data model and deck generation"
```

---

## Task 3: Prison System

**Files:**
- Create: `js/engine/prison.js`

**Step 1: Create prison.js**

```javascript
// js/engine/prison.js

/**
 * Prison layout per official rules:
 * Back row (dealt first):  DOWN, UP, DOWN, UP, DOWN  (5 cards)
 * Front row (dealt second): UP, DOWN, UP, DOWN, UP   (5 cards)
 *
 * Cards in back row are "locked" until the corresponding front row card is removed.
 * Players must empty their hand before playing prison cards.
 */

const BACK_PATTERN =  [false, true, false, true, false];
const FRONT_PATTERN = [true, false, true, false, true];

/**
 * Create a prison for one player by dealing 10 cards from the deck.
 * @param {Array} deck - deck array (cards will be removed from end)
 * @returns {object} prison with front[] and back[] arrays of {card, faceUp}
 */
export function createPrison(deck) {
    const prison = { front: [], back: [] };

    // Back row dealt first (5 cards)
    for (let i = 0; i < 5; i++) {
        prison.back.push({
            card: deck.pop(),
            faceUp: BACK_PATTERN[i]
        });
    }

    // Front row dealt second (5 cards)
    for (let i = 0; i < 5; i++) {
        prison.front.push({
            card: deck.pop(),
            faceUp: FRONT_PATTERN[i]
        });
    }

    return prison;
}

/**
 * Check if a prison card at (row, index) is playable.
 * Rules:
 * - Front row cards are playable if they have a card
 * - Back row cards are playable ONLY if the front card at same index is null
 * - Face-down cards CAN be played (risky - may cause pickup)
 *
 * @param {object} prison
 * @param {'front'|'back'} row
 * @param {number} index
 * @returns {boolean}
 */
export function isPrisonCardAccessible(prison, row, index) {
    const slot = prison[row][index];
    if (!slot || slot.card === null) return false;

    // Back row: front card must be gone
    if (row === 'back') {
        if (prison.front[index] && prison.front[index].card !== null) {
            return false;
        }
    }

    return true;
}

/**
 * Remove a card from prison at (row, index).
 * @returns {object|null} the card removed, or null
 */
export function removePrisonCard(prison, row, index) {
    const slot = prison[row][index];
    if (!slot || slot.card === null) return null;
    const card = slot.card;
    slot.card = null;
    return card;
}

/**
 * Check if entire prison is empty (no cards remain).
 */
export function isPrisonEmpty(prison) {
    for (const slot of prison.front) {
        if (slot.card !== null) return false;
    }
    for (const slot of prison.back) {
        if (slot.card !== null) return false;
    }
    return true;
}

/**
 * Get all unlocked face-up cards (for Undead swap).
 * Returns array of {row, index, card}
 */
export function getUnlockedCards(prison) {
    const unlocked = [];

    // Front row face-up cards
    for (let i = 0; i < prison.front.length; i++) {
        const slot = prison.front[i];
        if (slot.card !== null && slot.faceUp) {
            unlocked.push({ row: 'front', index: i, card: slot.card });
        }
    }

    // Back row face-up cards (only if front is cleared)
    for (let i = 0; i < prison.back.length; i++) {
        const slot = prison.back[i];
        if (slot.card !== null && slot.faceUp) {
            if (prison.front[i] && prison.front[i].card === null) {
                unlocked.push({ row: 'back', index: i, card: slot.card });
            }
        }
    }

    return unlocked;
}

/**
 * Swap two prison cards between two prisons (for Undead).
 */
export function swapPrisonCards(prisonA, rowA, indexA, prisonB, rowB, indexB) {
    const temp = prisonA[rowA][indexA].card;
    prisonA[rowA][indexA].card = prisonB[rowB][indexB].card;
    prisonB[rowB][indexB].card = temp;
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: prison system with lock/unlock mechanics"
```

---

## Task 4: Core Game Engine

**Files:**
- Create: `js/engine/game.js`

This is the big one. All game rules, turn management, card validation, special effects.

**Step 1: Create game.js**

```javascript
// js/engine/game.js
import { CardType } from './cards.js';
import { generateDeck, shuffleDeck } from './deck.js';
import { createPrison, isPrisonCardAccessible, removePrisonCard, isPrisonEmpty, getUnlockedCards, swapPrisonCards } from './prison.js';

/**
 * Create a fresh game state.
 * @returns {object} complete game state
 */
export function createGameState() {
    const deck = shuffleDeck(generateDeck());

    // Deal prisons (10 cards each = 20 cards)
    const playerPrison = createPrison(deck);
    const computerPrison = createPrison(deck);

    // Deal hands (5 cards each = 10 cards)
    const playerHand = [];
    const computerHand = [];
    for (let i = 0; i < 5; i++) {
        playerHand.push(deck.pop());
        computerHand.push(deck.pop());
    }

    // Flip first card for discard pile
    // Official rule: if special card is flipped, it determines first player
    let firstCard = deck.pop();
    let firstPlayer = 'player';

    if (firstCard.isSpecial) {
        // Special card determines first player (per official rules)
        // Put it back, reshuffle, try again for a clean start
        // OR: we could implement the special-card-first-player rule
        // For simplicity: special card goes to discard, computer goes first
        firstPlayer = 'computer';
    }

    return {
        deck,
        discardPile: [firstCard],
        player: {
            hand: playerHand,
            prison: playerPrison
        },
        computer: {
            hand: computerHand,
            prison: computerPrison
        },
        currentTurn: firstPlayer,
        turnCount: 1,
        gameOver: false,
        winner: null,
        status: firstPlayer === 'player'
            ? "Game started! It's your turn."
            : "Game started! Special card flipped - computer goes first.",
        log: []
    };
}

// ============================================
// CARD VALIDATION
// ============================================

/**
 * Get the effective value to beat on the discard pile.
 * Looks through the pile from top to find the last attack card value.
 * After Demoter or Skorch: returns 0 (any card playable).
 * After Elude: maintains the previous attack value.
 */
export function getEffectiveValue(state) {
    if (state.discardPile.length === 0) return 0;

    const topCard = state.discardPile[state.discardPile.length - 1];

    // Demoter resets value - any card can be played
    if (topCard.type === CardType.DEMOTER) return 0;

    // Skorch burns pile - any card can be played
    if (topCard.type === CardType.SKORCH) return 0;

    // Walk backwards to find last attack card value
    for (let i = state.discardPile.length - 1; i >= 0; i--) {
        if (state.discardPile[i].type === CardType.ATTACK) {
            return state.discardPile[i].value;
        }
    }

    return 0;
}

/**
 * Check if a card can legally be played.
 * @param {object} card - the card to play
 * @param {object} state - current game state
 * @returns {boolean}
 */
export function isValidPlay(card, state) {
    // Special cards can always be played
    if (card.isSpecial) return true;

    // Empty discard pile: anything goes
    if (state.discardPile.length === 0) return true;

    // After Demoter or Skorch: anything goes
    const topCard = state.discardPile[state.discardPile.length - 1];
    if (topCard.type === CardType.DEMOTER || topCard.type === CardType.SKORCH) return true;

    // Attack cards: must equal or exceed effective value
    if (card.type === CardType.ATTACK) {
        return card.value >= getEffectiveValue(state);
    }

    return false;
}

/**
 * Validate a stack of cards can be played together.
 * All cards must be same type and value (for attack cards).
 */
export function isValidStack(cards) {
    if (cards.length === 0) return false;
    if (cards.length === 1) return true;

    const first = cards[0];
    return cards.every(c =>
        c.type === first.type &&
        (c.type !== CardType.ATTACK || c.value === first.value)
    );
}

// ============================================
// GAME ACTIONS
// ============================================

/**
 * Play card(s) from a player's hand.
 * @param {object} state - game state (mutated)
 * @param {string} who - 'player' or 'computer'
 * @param {number[]} handIndexes - indexes in the hand to play (sorted ascending)
 * @returns {object} { success, message, effect }
 */
export function playFromHand(state, who, handIndexes) {
    const player = state[who];
    const cards = handIndexes.map(i => player.hand[i]).filter(Boolean);

    if (cards.length === 0) return { success: false, message: 'No valid cards selected.' };
    if (!isValidStack(cards)) return { success: false, message: 'All cards must be the same type and value.' };
    if (!isValidPlay(cards[0], state)) {
        // Invalid play: pick up discard pile
        player.hand = player.hand.concat(state.discardPile);
        state.discardPile = [];
        return { success: true, message: 'Invalid play! You picked up the discard pile.', effect: 'pickup' };
    }

    // Remove cards from hand (reverse order to maintain indexes)
    const sortedDesc = [...handIndexes].sort((a, b) => b - a);
    for (const idx of sortedDesc) {
        player.hand.splice(idx, 1);
    }

    // Add to discard pile
    state.discardPile.push(...cards);

    // Process special effects
    const effect = processSpecialEffect(state, who, cards[0]);

    const cardName = cards[0].type === CardType.ATTACK
        ? `Attack ${cards[0].value}`
        : cards[0].name;

    return {
        success: true,
        message: `${cards.length > 1 ? cards.length + 'x ' : ''}${cardName} played.${effect.message}`,
        effect: effect.type
    };
}

/**
 * Play a card from prison.
 * @param {object} state
 * @param {string} who
 * @param {'front'|'back'} row
 * @param {number} index
 * @returns {object} { success, message, effect }
 */
export function playFromPrison(state, who, row, index) {
    const player = state[who];

    // Must have empty hand
    if (player.hand.length > 0) {
        return { success: false, message: 'Must play all hand cards first.' };
    }

    // Check accessibility
    if (!isPrisonCardAccessible(player.prison, row, index)) {
        return { success: false, message: 'That card is not accessible.' };
    }

    const slot = player.prison[row][index];
    const card = slot.card;
    const wasFaceDown = !slot.faceUp;

    // Face-down: always attempt (may cause pickup)
    if (wasFaceDown) {
        // Reveal it
        slot.faceUp = true;

        if (!isValidPlay(card, state)) {
            // Invalid: pick up discard pile + this card
            player.hand = player.hand.concat(state.discardPile);
            player.hand.push(card);
            state.discardPile = [];
            slot.card = null;
            return {
                success: true,
                message: `Flipped ${card.name} - invalid! Picked up the discard pile.`,
                effect: 'pickup'
            };
        }
    } else {
        // Face-up: validate normally
        if (!isValidPlay(card, state)) {
            return { success: false, message: 'That card cannot be played right now.' };
        }
    }

    // Play the card
    slot.card = null;
    state.discardPile.push(card);

    const effect = processSpecialEffect(state, who, card);

    return {
        success: true,
        message: `${wasFaceDown ? '(Face-down) ' : ''}${card.name} played from prison.${effect.message}`,
        effect: effect.type
    };
}

/**
 * Pick up the entire discard pile into hand.
 */
export function pickupDiscardPile(state, who) {
    const player = state[who];
    player.hand = player.hand.concat(state.discardPile);
    state.discardPile = [];
    return { success: true, message: 'Picked up the discard pile.' };
}

/**
 * Draw one card from the deck.
 */
export function drawCard(state, who) {
    if (state.deck.length === 0) return null;
    const card = state.deck.pop();
    state[who].hand.push(card);
    return card;
}

// ============================================
// SPECIAL CARD EFFECTS
// ============================================

/**
 * Process the effect of a special card.
 * @returns {object} { type, message }
 */
function processSpecialEffect(state, who, card) {
    switch (card.type) {
        case CardType.SKORCH:
            // Burn the discard pile - keep only the Skorch card
            state.discardPile = [card];
            return { type: 'skorch', message: ' Skorch! Discard pile burned.' };

        case CardType.SHIELD:
            // In 2-player: opponent's turn is skipped (current player goes again)
            return { type: 'shield', message: ' Shield! Opponent\'s turn skipped.' };

        case CardType.DEMOTER:
            // Next player can play any card (value resets to 0)
            return { type: 'demoter', message: ' Demoter! Any card can be played next.' };

        case CardType.ELUDE:
            // Matches current value without copying special effects
            // Value to beat stays the same as before
            return { type: 'elude', message: ` Elude! Value to beat remains ${getEffectiveValue(state)}.` };

        case CardType.UNDEAD:
            // Swap unlocked prison cards between players
            return { type: 'undead', message: ' Undead! Choose cards to swap.' };

        default:
            return { type: 'none', message: '' };
    }
}

// ============================================
// UNDEAD SWAP
// ============================================

/**
 * Execute an Undead swap between two players' prison cards.
 * @param {object} state
 * @param {string} who - who played the Undead card
 * @param {object} myCard - {row, index} of the card to give
 * @param {object} theirCard - {row, index} of the card to take
 */
export function executeUndeadSwap(state, who, myCard, theirCard) {
    const opponent = who === 'player' ? 'computer' : 'player';
    const myPrison = state[who].prison;
    const theirPrison = state[opponent].prison;

    swapPrisonCards(myPrison, myCard.row, myCard.index, theirPrison, theirCard.row, theirCard.index);

    return { success: true, message: 'Undead swap complete!' };
}

/**
 * Execute Undead when player has no unlocked cards (just take one).
 */
export function executeUndeadTake(state, who, theirCard) {
    const opponent = who === 'player' ? 'computer' : 'player';
    const theirPrison = state[opponent].prison;
    const card = removePrisonCard(theirPrison, theirCard.row, theirCard.index);
    if (card) {
        state[who].hand.push(card);
    }
    return { success: true, message: `Took ${card?.name || 'a card'} from opponent's prison.` };
}

// ============================================
// TURN MANAGEMENT
// ============================================

/**
 * Advance to next turn. Call after a successful play + draw.
 */
export function nextTurn(state) {
    state.currentTurn = state.currentTurn === 'player' ? 'computer' : 'player';
    state.turnCount++;
}

/**
 * Check win condition: hand empty + prison empty.
 */
export function checkWin(state, who) {
    const player = state[who];
    if (player.hand.length > 0) return false;
    return isPrisonEmpty(player.prison);
}

/**
 * Get playable cards from a hand given the current state.
 * Returns array of { index, card } for cards that can be legally played.
 */
export function getPlayableHandCards(state, who) {
    const hand = state[who].hand;
    const playable = [];
    for (let i = 0; i < hand.length; i++) {
        if (isValidPlay(hand[i], state)) {
            playable.push({ index: i, card: hand[i] });
        }
    }
    return playable;
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: core game engine with full rule set"
```

---

## Task 5: Computer AI

**Files:**
- Create: `js/ai/computer.js`

**Step 1: Create computer.js**

The AI should:
- Track what's been played (card counting)
- Play lowest valid attack card by default (conserve high cards)
- Stack same-value cards when possible
- Use special cards strategically (not wastefully)
- Handle prison plays when hand is empty

```javascript
// js/ai/computer.js
import { CardType } from '../engine/cards.js';
import { isValidPlay, getEffectiveValue, playFromHand, playFromPrison, pickupDiscardPile, drawCard, nextTurn, checkWin, getPlayableHandCards, executeUndeadSwap } from '../engine/game.js';
import { isPrisonCardAccessible, getUnlockedCards } from '../engine/prison.js';

/**
 * Execute the computer's turn.
 * @param {object} state - game state (will be mutated)
 * @returns {object} { message, thoughts } describing what happened
 */
export function computerTurn(state) {
    const thoughts = [];
    const hand = state.computer.hand;
    const effectiveValue = getEffectiveValue(state);

    thoughts.push(`Value to beat: ${effectiveValue}`);
    thoughts.push(`Hand size: ${hand.length}`);
    thoughts.push(`Deck remaining: ${state.deck.length}`);

    // If hand is empty, play from prison
    if (hand.length === 0) {
        return computerPlayPrison(state, thoughts);
    }

    // Categorize playable cards
    const playable = getPlayableHandCards(state, 'computer');
    const attacks = playable.filter(p => p.card.type === CardType.ATTACK);
    const specials = playable.filter(p => p.card.isSpecial);

    thoughts.push(`Playable: ${attacks.length} attack, ${specials.length} special`);

    if (playable.length === 0) {
        // No valid plays - must pick up
        thoughts.push('No valid plays. Picking up discard pile.');
        const result = pickupDiscardPile(state, 'computer');
        drawCard(state, 'computer');
        nextTurn(state);
        return { message: result.message, thoughts: thoughts.join('\n') };
    }

    // === STRATEGY DECISION ===

    // 1. Check if we should use a special card
    const specialPlay = evaluateSpecialCards(state, specials, attacks, thoughts);
    if (specialPlay) {
        const result = playFromHand(state, 'computer', [specialPlay.index]);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n') };
    }

    // 2. Try to stack same-value attack cards
    const stackPlay = findBestStack(state, attacks, thoughts);
    if (stackPlay) {
        const result = playFromHand(state, 'computer', stackPlay);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n') };
    }

    // 3. Play lowest valid attack card (conserve high cards)
    if (attacks.length > 0) {
        const sorted = [...attacks].sort((a, b) => a.card.value - b.card.value);
        const lowest = sorted[0];
        thoughts.push(`Playing lowest: Attack ${lowest.card.value}`);
        const result = playFromHand(state, 'computer', [lowest.index]);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n') };
    }

    // 4. Fallback: play any special card
    if (specials.length > 0) {
        thoughts.push(`Fallback: playing ${specials[0].card.name}`);
        const result = playFromHand(state, 'computer', [specials[0].index]);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n') };
    }

    // Should never reach here
    thoughts.push('No moves available (unexpected).');
    nextTurn(state);
    return { message: 'Computer passed.', thoughts: thoughts.join('\n') };
}

/**
 * Handle post-play actions: draw card, check win, handle Shield, advance turn.
 */
function handlePostPlay(state, result, thoughts) {
    if (result.effect === 'shield') {
        // Shield: skip opponent, computer goes again
        thoughts.push('Shield played - taking another turn.');
        drawCard(state, 'computer');
        // Don't call nextTurn - computer goes again
        // But we need to trigger another computer turn (handled by caller)
        return;
    }

    if (result.effect === 'undead') {
        // Computer auto-handles Undead swap
        handleComputerUndead(state, thoughts);
    }

    drawCard(state, 'computer');

    if (checkWin(state, 'computer')) {
        state.gameOver = true;
        state.winner = 'computer';
        state.status = 'Computer wins!';
        thoughts.push('COMPUTER WINS!');
        return;
    }

    nextTurn(state);
}

/**
 * Evaluate whether a special card should be played.
 * Returns the card to play or null.
 */
function evaluateSpecialCards(state, specials, attacks, thoughts) {
    const discardSize = state.discardPile.length;
    const effectiveValue = getEffectiveValue(state);
    const playerHandSize = state.player.hand.length;
    const noAttacks = attacks.length === 0;

    for (const s of specials) {
        switch (s.card.type) {
            case CardType.SKORCH:
                // Play Skorch when discard pile is large (5+) or no other options
                if (discardSize >= 5 || (noAttacks && discardSize >= 3)) {
                    thoughts.push(`Playing Skorch (${discardSize} cards in pile)`);
                    return s;
                }
                break;

            case CardType.DEMOTER:
                // Play Demoter when value is high and we have low cards
                if (noAttacks && effectiveValue >= 5) {
                    thoughts.push(`Playing Demoter (value ${effectiveValue} too high)`);
                    return s;
                }
                break;

            case CardType.SHIELD:
                // Play Shield when player is close to winning or we have no attacks
                if (playerHandSize <= 2 || (noAttacks && effectiveValue >= 7)) {
                    thoughts.push(`Playing Shield (player has ${playerHandSize} cards)`);
                    return s;
                }
                break;

            case CardType.ELUDE:
                // Play Elude when we can't play attacks and value is moderate+
                if (noAttacks && effectiveValue >= 4) {
                    thoughts.push(`Playing Elude (can't beat ${effectiveValue})`);
                    return s;
                }
                break;

            case CardType.UNDEAD:
                // Play Undead if opponent has good visible prison cards
                const theirUnlocked = getUnlockedCards(state.player.prison);
                const hasHighCards = theirUnlocked.some(u =>
                    u.card.type === CardType.ATTACK && u.card.value >= 7
                );
                if (hasHighCards || (noAttacks && theirUnlocked.length > 0)) {
                    thoughts.push('Playing Undead (opponent has valuable prison cards)');
                    return s;
                }
                break;
        }
    }

    return null;
}

/**
 * Find the best stack of same-value cards to play.
 * Returns array of indexes or null.
 */
function findBestStack(state, attacks, thoughts) {
    // Group by value
    const groups = {};
    for (const a of attacks) {
        const v = a.card.value;
        if (!groups[v]) groups[v] = [];
        groups[v].push(a);
    }

    // Find groups with 2+ cards
    let bestGroup = null;
    let bestValue = -1;

    for (const [value, group] of Object.entries(groups)) {
        if (group.length >= 2) {
            const v = parseInt(value);
            // Prefer stacking lower values (save high cards)
            if (bestGroup === null || v < bestValue) {
                bestGroup = group;
                bestValue = v;
            }
        }
    }

    if (bestGroup) {
        thoughts.push(`Stacking ${bestGroup.length}x Attack ${bestValue}`);
        return bestGroup.map(g => g.index);
    }

    return null;
}

/**
 * Handle computer's Undead swap automatically.
 */
function handleComputerUndead(state, thoughts) {
    const myUnlocked = getUnlockedCards(state.computer.prison);
    const theirUnlocked = getUnlockedCards(state.player.prison);

    if (theirUnlocked.length === 0) {
        thoughts.push('Undead: no opponent cards to take.');
        return;
    }

    // Find best card to take (highest attack value or special)
    let bestTake = null;
    for (const u of theirUnlocked) {
        if (!bestTake) { bestTake = u; continue; }
        if (u.card.type === CardType.ATTACK && bestTake.card.type === CardType.ATTACK) {
            if (u.card.value > bestTake.card.value) bestTake = u;
        } else if (u.card.isSpecial && !bestTake.card.isSpecial) {
            bestTake = u;
        }
    }

    // Find worst card to give (lowest attack value)
    let worstGive = null;
    for (const u of myUnlocked) {
        if (u.card.type === CardType.ATTACK) {
            if (!worstGive || u.card.value < worstGive.card.value) {
                worstGive = u;
            }
        }
    }

    if (bestTake && worstGive) {
        executeUndeadSwap(state, 'computer',
            { row: worstGive.row, index: worstGive.index },
            { row: bestTake.row, index: bestTake.index }
        );
        thoughts.push(`Undead: swapped ${worstGive.card.name} for ${bestTake.card.name}`);
    } else if (bestTake && myUnlocked.length === 0) {
        // No cards to give - just take
        const card = state.player.prison[bestTake.row][bestTake.index].card;
        state.player.prison[bestTake.row][bestTake.index].card = null;
        state.computer.hand.push(card);
        thoughts.push(`Undead: took ${bestTake.card.name} (nothing to give)`);
    } else {
        thoughts.push('Undead: no beneficial swap found.');
    }
}

/**
 * Computer plays from prison when hand is empty.
 */
function computerPlayPrison(state, thoughts) {
    thoughts.push('Hand empty - playing from prison.');

    // Find all accessible prison cards
    const accessible = [];
    for (const row of ['front', 'back']) {
        for (let i = 0; i < state.computer.prison[row].length; i++) {
            if (isPrisonCardAccessible(state.computer.prison, row, i)) {
                const slot = state.computer.prison[row][i];
                accessible.push({ row, index: i, card: slot.card, faceUp: slot.faceUp });
            }
        }
    }

    if (accessible.length === 0) {
        // No accessible prison cards - shouldn't happen in normal play
        thoughts.push('No accessible prison cards.');
        pickupDiscardPile(state, 'computer');
        drawCard(state, 'computer');
        nextTurn(state);
        return { message: 'Computer picked up the pile.', thoughts: thoughts.join('\n') };
    }

    // Prefer face-up cards we can validate
    const faceUpPlayable = accessible.filter(a =>
        a.faceUp && isValidPlay(a.card, state)
    );

    if (faceUpPlayable.length > 0) {
        // Play the highest valid face-up card
        const sorted = faceUpPlayable.sort((a, b) => {
            if (a.card.isSpecial && !b.card.isSpecial) return -1;
            if (!a.card.isSpecial && b.card.isSpecial) return 1;
            return (b.card.value || 0) - (a.card.value || 0);
        });
        const pick = sorted[0];
        thoughts.push(`Playing prison card: ${pick.card.name} (${pick.row}[${pick.index}])`);
        const result = playFromPrison(state, 'computer', pick.row, pick.index);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n') };
    }

    // No valid face-up cards - try a face-down card (risky)
    const faceDown = accessible.filter(a => !a.faceUp);
    if (faceDown.length > 0) {
        const pick = faceDown[0]; // Just pick first available
        thoughts.push(`Playing face-down prison card (risky): ${pick.row}[${pick.index}]`);
        const result = playFromPrison(state, 'computer', pick.row, pick.index);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n') };
    }

    // Absolute fallback
    thoughts.push('No prison plays possible. Picking up.');
    pickupDiscardPile(state, 'computer');
    drawCard(state, 'computer');
    nextTurn(state);
    return { message: 'Computer picked up the pile.', thoughts: thoughts.join('\n') };
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: computer AI with strategic card evaluation"
```

---

## Task 6: UI Renderer

**Files:**
- Create: `js/ui/renderer.js`
- Create: `js/ui/events.js`

This renders the entire game board from state. No framework - just DOM manipulation.

**Step 1: Create renderer.js**

```javascript
// js/ui/renderer.js
import { getCardImage, CardType } from '../engine/cards.js';
import { getEffectiveValue, getPlayableHandCards } from '../engine/game.js';

const ASSETS_PATH = 'assets/cards/';

/**
 * Render the entire game UI from state.
 * @param {object} state - game state
 * @param {HTMLElement} root - #game-root element
 * @param {object} handlers - { onCardSelect, onPlaySelected, onPickup, onRestart, onPrisonClick }
 */
export function render(state, root, handlers) {
    root.innerHTML = '';

    // Header
    root.appendChild(createHeader(handlers.onRestart));

    // Status bar
    root.appendChild(createStatusBar(state));

    // Game board (2-column: player left, computer right)
    const board = el('div', 'game-board');

    // Player area
    board.appendChild(createPlayerArea(state, handlers));

    // Computer area
    board.appendChild(createComputerArea(state));

    root.appendChild(board);

    // Controls bar (fixed bottom)
    root.appendChild(createControlsBar(state, handlers));

    // Turn indicator
    root.appendChild(createTurnIndicator(state));
}

// ============================================
// COMPONENT BUILDERS
// ============================================

function createHeader(onRestart) {
    const header = el('header', 'game-header');

    const logo = el('div', 'header-left');
    const img = document.createElement('img');
    img.src = 'assets/logo-red.png';
    img.alt = 'Skorch';
    img.className = 'game-logo';
    logo.appendChild(img);
    header.appendChild(logo);

    const actions = el('div', 'header-actions');
    const restartBtn = el('button', 'btn-restart');
    restartBtn.textContent = 'Restart Game';
    restartBtn.addEventListener('click', onRestart);
    actions.appendChild(restartBtn);
    header.appendChild(actions);

    return header;
}

function createStatusBar(state) {
    const container = el('div', 'status-container');
    const msg = el('div', 'status-message');
    msg.textContent = state.status;
    container.appendChild(msg);
    return container;
}

function createPlayerArea(state, handlers) {
    const section = el('section', 'area-box');

    // Hand section
    const handSection = el('div', 'hand-section');
    const handTitle = el('h3');
    handTitle.textContent = 'Your Hand ';
    const countBadge = el('span', `card-count${state.player.hand.length > 7 ? ' warning' : ''}`);
    countBadge.textContent = state.player.hand.length;
    handTitle.appendChild(countBadge);
    handSection.appendChild(handTitle);

    // Separate playable from unplayable
    const effectiveValue = getEffectiveValue(state);
    const playable = [];
    const unplayable = [];

    state.player.hand.forEach((card, index) => {
        if (card.isSpecial || state.discardPile.length === 0 ||
            (card.type === CardType.ATTACK && card.value >= effectiveValue) ||
            (state.discardPile.length > 0 && (
                state.discardPile[state.discardPile.length - 1].type === CardType.DEMOTER ||
                state.discardPile[state.discardPile.length - 1].type === CardType.SKORCH
            ))) {
            playable.push({ card, index });
        } else {
            unplayable.push({ card, index });
        }
    });

    // Sort playable: attack cards by value ascending, then specials
    playable.sort((a, b) => {
        if (a.card.type === CardType.ATTACK && b.card.type === CardType.ATTACK) {
            return a.card.value - b.card.value;
        }
        if (a.card.type === CardType.ATTACK) return -1;
        if (b.card.type === CardType.ATTACK) return 1;
        return 0;
    });

    const handContainer = el('div', 'hand-container');

    // Playable cards
    if (playable.length > 0) {
        const playableDiv = el('div', 'playable-cards');
        const row = el('div', 'card-row');
        playable.forEach(({ card, index }) => {
            const cardEl = createCardElement(card, true);
            if (state.currentTurn === 'player') {
                cardEl.classList.add('selectable');
                cardEl.dataset.index = index;
                cardEl.addEventListener('click', () => handlers.onCardSelect(index, cardEl));
            }
            row.appendChild(cardEl);
        });
        playableDiv.appendChild(row);
        handContainer.appendChild(playableDiv);
    }

    // Unplayable cards (fanned stack)
    if (unplayable.length > 0) {
        const stackDiv = el('div', 'unplayable-stack');
        const stacked = el('div', 'stacked-cards');
        unplayable.slice(0, 8).forEach(({ card }) => {
            const cardEl = createCardElement(card, true);
            cardEl.classList.add('stacked');
            stacked.appendChild(cardEl);
        });
        if (unplayable.length > 8) {
            const extra = el('span', 'stack-count');
            extra.textContent = `+${unplayable.length - 8}`;
            stacked.appendChild(extra);
        }
        stackDiv.appendChild(stacked);
        handContainer.appendChild(stackDiv);
    }

    // No playable cards message
    if (playable.length === 0 && state.currentTurn === 'player') {
        const noPlays = el('div', 'no-plays-message');
        noPlays.innerHTML = '<p>No playable cards available</p>';
        const pickupBtn = el('button', 'btn-pickup prominent');
        pickupBtn.textContent = 'Pick Up Discard Pile';
        pickupBtn.addEventListener('click', handlers.onPickup);
        noPlays.appendChild(pickupBtn);
        handContainer.appendChild(noPlays);
    }

    handSection.appendChild(handContainer);
    section.appendChild(handSection);

    // Prison section
    section.appendChild(createPrisonSection(state, 'player', handlers));

    return section;
}

function createComputerArea(state) {
    const section = el('section', 'area-box');

    // Hand (face down)
    const handSection = el('div', 'hand-section');
    const title = el('h3');
    title.textContent = 'Hand ';
    if (state.computer.hand.length > 0) {
        const badge = el('span', 'card-count');
        badge.textContent = state.computer.hand.length;
        title.appendChild(badge);
    }
    handSection.appendChild(title);

    const handContainer = el('div', 'card-container computer-hand');
    const row = el('div', 'card-row');
    const showCount = Math.min(8, state.computer.hand.length);
    for (let i = 0; i < showCount; i++) {
        row.appendChild(createCardElement(null, false)); // face down
    }
    handContainer.appendChild(row);
    handSection.appendChild(handContainer);
    section.appendChild(handSection);

    // Prison
    section.appendChild(createPrisonSection(state, 'computer', null));

    return section;
}

function createPrisonSection(state, who, handlers) {
    const prison = state[who].prison;
    const section = el('div', 'prison-section');

    for (const rowName of ['front', 'back']) {
        const rowDiv = el('div', 'prison-row');
        const container = el('div', 'card-container');

        prison[rowName].forEach((slot, index) => {
            if (slot.card === null) {
                // Empty slot
                const placeholder = el('div', 'sk-card sk-placeholder');
                container.appendChild(placeholder);
            } else {
                const cardEl = createCardElement(slot.card, slot.faceUp || who === 'player');

                // For player's prison: make clickable when hand is empty
                if (who === 'player' && handlers && state.currentTurn === 'player' && state.player.hand.length === 0) {
                    const btn = el('button', 'card-button');
                    btn.appendChild(cardEl);
                    btn.addEventListener('click', () => handlers.onPrisonClick(rowName, index));
                    container.appendChild(btn);
                } else {
                    container.appendChild(cardEl);
                }
            }
        });

        rowDiv.appendChild(container);
        section.appendChild(rowDiv);
    }

    return section;
}

function createControlsBar(state, handlers) {
    const controls = el('div', 'game-controls');

    // Draw pile
    const drawPile = el('div');
    const drawLabel = el('div', 'pile-label');
    drawLabel.textContent = 'Draw Pile';
    drawPile.appendChild(drawLabel);
    const drawStack = el('div', 'pile-stack');
    drawStack.appendChild(createCardElement(null, false));
    const drawCount = el('span', 'pile-count');
    drawCount.textContent = state.deck.length;
    drawStack.appendChild(drawCount);
    drawPile.appendChild(drawStack);
    controls.appendChild(drawPile);

    // Buttons
    const buttonStack = el('div', 'button-stack');

    const playBtn = el('button', 'btn-play');
    playBtn.id = 'playSelectedBtn';
    playBtn.textContent = 'Play Selected Cards';
    playBtn.disabled = true;
    playBtn.addEventListener('click', handlers.onPlaySelected);
    buttonStack.appendChild(playBtn);

    const pickupBtn = el('button', 'btn-pickup');
    pickupBtn.textContent = 'Pick Up Discard Pile';
    if (state.currentTurn !== 'player') {
        pickupBtn.disabled = true;
        pickupBtn.textContent = 'Waiting...';
    } else {
        pickupBtn.addEventListener('click', handlers.onPickup);
    }
    buttonStack.appendChild(pickupBtn);

    controls.appendChild(buttonStack);

    // Discard pile
    const discardPile = el('div');
    const discardLabel = el('div', 'pile-label');
    discardLabel.textContent = 'Discard Pile';
    discardPile.appendChild(discardLabel);
    const discardStack = el('div', 'pile-stack');

    if (state.discardPile.length > 0) {
        const topCard = state.discardPile[state.discardPile.length - 1];
        discardStack.appendChild(createCardElement(topCard, true));
        const discardCount = el('span', 'pile-count');
        discardCount.textContent = state.discardPile.length;
        discardStack.appendChild(discardCount);
    } else {
        const empty = el('div', 'sk-card sk-placeholder');
        const emptyText = el('div', 'empty-pile-text');
        emptyText.textContent = 'No Cards';
        empty.appendChild(emptyText);
        discardStack.appendChild(empty);
    }

    discardPile.appendChild(discardStack);
    controls.appendChild(discardPile);

    return controls;
}

function createTurnIndicator(state) {
    const indicator = el('div', `turn-indicator${state.currentTurn === 'player' ? ' your-turn' : ''}`);
    indicator.textContent = state.currentTurn === 'player' ? 'Your Turn' : "Computer's Turn";
    return indicator;
}

// ============================================
// HELPERS
// ============================================

function createCardElement(card, faceUp) {
    const div = el('div', 'sk-card');

    if (!faceUp || !card) {
        div.classList.add('sk-face-down');
        div.style.backgroundImage = `url('${ASSETS_PATH}Card-Back.png')`;
    } else {
        div.classList.add('sk-face-up');
        div.style.backgroundImage = `url('${ASSETS_PATH}${getCardImage(card)}')`;
        div.dataset.type = card.type;
        if (card.type === CardType.ATTACK) {
            div.dataset.value = card.value;
        } else {
            div.dataset.effect = card.name;
        }
    }

    return div;
}

function el(tag, className = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    return element;
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: DOM renderer for full game board"
```

---

## Task 7: Main.js - Wire Everything Together

**Files:**
- Modify: `js/main.js`

**Step 1: Write main.js - the game controller**

```javascript
// js/main.js
import { createGameState, playFromHand, playFromPrison, pickupDiscardPile, drawCard, nextTurn, checkWin } from './engine/game.js';
import { computerTurn } from './ai/computer.js';
import { render } from './ui/renderer.js';

let state = createGameState();
let selectedIndexes = new Set();
const root = document.getElementById('game-root');

function update() {
    selectedIndexes.clear();
    render(state, root, {
        onCardSelect,
        onPlaySelected,
        onPickup,
        onRestart,
        onPrisonClick
    });
}

function onCardSelect(index, cardEl) {
    if (state.currentTurn !== 'player' || state.gameOver) return;

    if (selectedIndexes.has(index)) {
        selectedIndexes.delete(index);
        cardEl.classList.remove('selected');
    } else {
        selectedIndexes.add(index);
        cardEl.classList.add('selected');
    }

    // Update play button state
    const playBtn = document.getElementById('playSelectedBtn');
    if (playBtn) {
        playBtn.disabled = selectedIndexes.size === 0;
        playBtn.classList.toggle('active', selectedIndexes.size > 0);
    }
}

function onPlaySelected() {
    if (state.currentTurn !== 'player' || selectedIndexes.size === 0) return;

    const indexes = Array.from(selectedIndexes).sort((a, b) => a - b);
    const result = playFromHand(state, 'player', indexes);

    state.status = result.message;

    if (result.success && result.effect !== 'pickup') {
        // Draw a card
        drawCard(state, 'player');

        // Check win
        if (checkWin(state, 'player')) {
            state.gameOver = true;
            state.winner = 'player';
            state.status = 'You win!';
            update();
            return;
        }

        // Handle Shield (player goes again)
        if (result.effect === 'shield') {
            state.status += ' You go again!';
            update();
            return;
        }

        // Handle Undead (TODO: show swap UI)
        if (result.effect === 'undead') {
            // For now, auto-skip if no unlocked cards
            // Full Undead UI will be added in a later task
            state.status += ' (Undead swap - coming soon)';
        }

        // Next turn -> computer
        nextTurn(state);
        update();

        // Computer plays after a short delay
        setTimeout(doComputerTurn, 800);
    } else {
        // Pickup happened or failed
        if (result.effect === 'pickup') {
            nextTurn(state);
            update();
            setTimeout(doComputerTurn, 800);
        } else {
            update();
        }
    }
}

function onPickup() {
    if (state.currentTurn !== 'player') return;

    pickupDiscardPile(state, 'player');
    drawCard(state, 'player');
    state.status = 'You picked up the discard pile.';
    nextTurn(state);
    update();
    setTimeout(doComputerTurn, 800);
}

function onPrisonClick(row, index) {
    if (state.currentTurn !== 'player' || state.player.hand.length > 0) return;

    const result = playFromPrison(state, 'player', row, index);
    state.status = result.message;

    if (result.success && result.effect !== 'pickup') {
        drawCard(state, 'player');

        if (checkWin(state, 'player')) {
            state.gameOver = true;
            state.winner = 'player';
            state.status = 'You win!';
            update();
            return;
        }

        if (result.effect === 'shield') {
            state.status += ' You go again!';
            update();
            return;
        }

        nextTurn(state);
    } else if (result.effect === 'pickup') {
        nextTurn(state);
    }

    update();

    if (state.currentTurn === 'computer' && !state.gameOver) {
        setTimeout(doComputerTurn, 800);
    }
}

function doComputerTurn() {
    if (state.gameOver) return;

    const result = computerTurn(state);
    state.status = `Computer: ${result.message}`;

    // If Shield was played, computer goes again
    if (result.message.includes('Shield')) {
        update();
        setTimeout(doComputerTurn, 1000);
        return;
    }

    update();
}

function onRestart() {
    state = createGameState();
    update();
}

// Initial render
update();

// If computer goes first (special card flipped), trigger after delay
if (state.currentTurn === 'computer') {
    setTimeout(doComputerTurn, 1000);
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: main controller wiring game engine, AI, and UI"
```

---

## Task 8: Complete CSS Styles

**Files:**
- Modify: `css/styles.css`

**Step 1: Port and adapt styles from existing PHP version**

This is the full styles.css - ported from the PHP version with refinements. Copy the complete CSS from the existing `Skorch copy/styles.css` and adapt it. Key changes:
- Use CSS variables consistently
- Use `background-image` via inline styles instead of data-attribute selectors (since renderer sets them directly)
- Keep all the card sizing, layout, animations, hover effects, selection states
- Keep the fixed header, fixed controls bar, prison layout, stacked cards fan

The existing styles.css from the PHP version is comprehensive and tested. Copy it wholesale, then adjust:
1. Remove the `[data-type]` and `[data-effect]` background-image rules (renderer handles this via inline styles now)
2. Keep everything else: layout, colors, animations, responsive, hover effects

**Step 2: Verify game loads and renders in browser**

```bash
open "/Users/tonyshaw/Documents/Little Big Planet/Skorch JS/index.html"
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: complete game styles ported from PHP version"
```

---

## Task 9: Undead Swap UI

**Files:**
- Create: `js/ui/undead-modal.js`
- Modify: `js/main.js` (add Undead handlers)

**Step 1: Create undead-modal.js**

A modal that shows the player's unlocked prison cards and the opponent's unlocked prison cards. Player selects one from each to swap.

```javascript
// js/ui/undead-modal.js
import { getCardImage } from '../engine/cards.js';
import { getUnlockedCards } from '../engine/prison.js';

/**
 * Show the Undead swap modal.
 * @param {object} state
 * @param {function} onSwap - callback({myRow, myIndex}, {theirRow, theirIndex})
 * @param {function} onCancel
 */
export function showUndeadModal(state, onSwap, onCancel) {
    const myUnlocked = getUnlockedCards(state.player.prison);
    const theirUnlocked = getUnlockedCards(state.computer.prison);

    // If no opponent cards, dismiss
    if (theirUnlocked.length === 0) {
        onCancel();
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal';

    const content = document.createElement('div');
    content.className = 'modal-content';

    content.innerHTML = `
        <h3 class="modal-title">Undead Swap</h3>
        <p style="color:#9ca3af;margin-bottom:1rem;">
            ${myUnlocked.length > 0
                ? 'Select one of YOUR cards to give, and one of THEIR cards to take.'
                : 'You have no unlocked cards. Select one of THEIR cards to take.'}
        </p>
        <div class="modal-grid">
            <div>
                <h4 style="color:#9ca3af;margin-bottom:0.5rem;">Your Cards</h4>
                <div class="modal-cards" id="my-cards"></div>
            </div>
            <div>
                <h4 style="color:#9ca3af;margin-bottom:0.5rem;">Their Cards</h4>
                <div class="modal-cards" id="their-cards"></div>
            </div>
        </div>
        <div style="display:flex;gap:1rem;justify-content:center;margin-top:1rem;">
            <button class="btn-play" id="swap-btn" disabled>Swap</button>
            <button class="btn-pickup" id="cancel-btn">Cancel</button>
        </div>
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    let selectedMy = null;
    let selectedTheir = null;

    // Render my unlocked cards
    const myContainer = content.querySelector('#my-cards');
    if (myUnlocked.length > 0) {
        myUnlocked.forEach(u => {
            const card = createModalCard(u.card);
            card.addEventListener('click', () => {
                myContainer.querySelectorAll('.sk-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedMy = { row: u.row, index: u.index };
                updateSwapBtn();
            });
            myContainer.appendChild(card);
        });
    } else {
        myContainer.innerHTML = '<p style="color:#666;">No unlocked cards</p>';
    }

    // Render their unlocked cards
    const theirContainer = content.querySelector('#their-cards');
    theirUnlocked.forEach(u => {
        const card = createModalCard(u.card);
        card.addEventListener('click', () => {
            theirContainer.querySelectorAll('.sk-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedTheir = { row: u.row, index: u.index };
            updateSwapBtn();
        });
        theirContainer.appendChild(card);
    });

    function updateSwapBtn() {
        const btn = content.querySelector('#swap-btn');
        const ready = selectedTheir && (selectedMy || myUnlocked.length === 0);
        btn.disabled = !ready;
        btn.classList.toggle('active', ready);
    }

    content.querySelector('#swap-btn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        onSwap(selectedMy, selectedTheir);
    });

    content.querySelector('#cancel-btn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        onCancel();
    });
}

function createModalCard(card) {
    const div = document.createElement('div');
    div.className = 'sk-card sk-face-up';
    div.style.backgroundImage = `url('assets/cards/${getCardImage(card)}')`;
    div.style.cursor = 'pointer';
    return div;
}
```

**Step 2: Wire into main.js**

Update the `onPlaySelected` function's Undead handling to show the modal instead of the placeholder text. Import `showUndeadModal` and call it when `result.effect === 'undead'`. On swap completion, call `executeUndeadSwap` or `executeUndeadTake`, then draw, check win, next turn, update, and trigger computer turn.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: undead swap modal UI"
```

---

## Task 10: Polish, Test, Deploy

**Files:**
- Various tweaks across all files

**Step 1: Test all game flows manually**

Play through several full games checking:
- [ ] Cards render correctly with images
- [ ] Selection and stacking works
- [ ] Each special card effect works (Skorch, Shield, Demoter, Elude, Undead)
- [ ] Prison cards unlock correctly (back after front removed)
- [ ] Face-down prison cards flip and may cause pickup
- [ ] Computer AI plays sensibly
- [ ] Shield gives current player another turn
- [ ] Win condition triggers when hand + prison empty
- [ ] Pick up discard pile works
- [ ] Draw pile depletes correctly
- [ ] Responsive layout on mobile
- [ ] Restart button works

**Step 2: Fix any bugs found during testing**

**Step 3: Final commit**

```bash
git add -A && git commit -m "feat: polish and bug fixes - game complete"
```

**Step 4: Deploy to Netlify**

Since this is pure static HTML/JS/CSS with no build step:
1. Drag the `Skorch JS` folder to Netlify
2. Or connect to GitHub and auto-deploy

---

## Summary

| Task | Description | Estimated Time |
|------|-------------|---------------|
| 1 | Project scaffold + assets | 5 min |
| 2 | Card data model + deck | 10 min |
| 3 | Prison system | 10 min |
| 4 | Core game engine (rules, turns, specials) | 30 min |
| 5 | Computer AI | 20 min |
| 6 | UI renderer | 30 min |
| 7 | Main controller (wire it all) | 15 min |
| 8 | Complete CSS styles | 15 min |
| 9 | Undead swap modal | 15 min |
| 10 | Test, polish, deploy | 20 min |
| **Total** | | **~2.5-3 hours** |
