// Server-side game engine - CommonJS port of client engine
// Ported from: js/engine/cards.js, deck.js, prison.js, game.js

// --- UUID helper ---

function uuid() {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

// --- Cards (from cards.js) ---

const CardType = {
    ATTACK: 'attack',
    ELUDE: 'elude',
    SHIELD: 'shield',
    DEMOTER: 'demoter',
    SKORCH: 'skorch',
    UNDEAD: 'undead'
};

const SPECIAL_TYPES = [
    CardType.ELUDE, CardType.SHIELD, CardType.DEMOTER, CardType.SKORCH, CardType.UNDEAD
];

function createCard(type, value = null) {
    return {
        id: uuid(),
        type,
        value,
        name: type === CardType.ATTACK ? `Attack ${value}` : type.charAt(0).toUpperCase() + type.slice(1),
        isSpecial: type !== CardType.ATTACK
    };
}

function getCardImage(card) {
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

// --- Deck (from deck.js) ---

function generateDeck(isMultiplayer = false) {
    const deck = [];
    for (let rank = 1; rank <= 10; rank++) {
        for (let i = 0; i < 6; i++) {
            deck.push(createCard(CardType.ATTACK, rank));
        }
    }
    const specials = [
        { type: CardType.ELUDE, count: 4 },
        { type: CardType.SHIELD, count: isMultiplayer ? 0 : 4 },
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

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// --- Prison (from prison.js) ---

const BACK_PATTERN = [false, true, false, true, false];
const FRONT_PATTERN = [true, false, true, false, true];

function createPrison(deck) {
    const prison = { front: [], back: [] };
    for (let i = 0; i < 5; i++) {
        prison.back.push({ card: deck.pop(), faceUp: BACK_PATTERN[i] });
    }
    for (let i = 0; i < 5; i++) {
        prison.front.push({ card: deck.pop(), faceUp: FRONT_PATTERN[i] });
    }
    return prison;
}

function isPrisonCardAccessible(prison, row, index) {
    const slot = prison[row][index];
    if (!slot || slot.card === null) return false;
    if (row === 'back') {
        if (prison.front[index] && prison.front[index].card !== null) return false;
    }
    return true;
}

function removePrisonCard(prison, row, index) {
    const slot = prison[row][index];
    if (!slot || slot.card === null) return null;
    const card = slot.card;
    slot.card = null;
    return card;
}

function isPrisonEmpty(prison) {
    for (const slot of prison.front) { if (slot.card !== null) return false; }
    for (const slot of prison.back) { if (slot.card !== null) return false; }
    return true;
}

function getUnlockedCards(prison) {
    const unlocked = [];
    for (let i = 0; i < prison.front.length; i++) {
        const slot = prison.front[i];
        if (slot.card !== null) {
            unlocked.push({ row: 'front', index: i, card: slot.card, faceUp: slot.faceUp });
        }
    }
    for (let i = 0; i < prison.back.length; i++) {
        const slot = prison.back[i];
        if (slot.card !== null) {
            if (prison.front[i] && prison.front[i].card === null) {
                unlocked.push({ row: 'back', index: i, card: slot.card, faceUp: slot.faceUp });
            }
        }
    }
    return unlocked;
}

function swapPrisonCards(prisonA, rowA, indexA, prisonB, rowB, indexB) {
    const slotA = prisonA[rowA][indexA];
    const slotB = prisonB[rowB][indexB];
    const tempCard = slotA.card;
    const tempFaceUp = slotA.faceUp;
    slotA.card = slotB.card;
    slotA.faceUp = slotB.faceUp;
    slotB.card = tempCard;
    slotB.faceUp = tempFaceUp;
}

// --- Game (from game.js) ---

function createGameState(isMultiplayer = false) {
    const deck = shuffleDeck(generateDeck(isMultiplayer));
    const playerPrison = createPrison(deck);
    const computerPrison = createPrison(deck);
    const playerHand = [];
    const computerHand = [];
    for (let i = 0; i < 5; i++) {
        playerHand.push(deck.pop());
        computerHand.push(deck.pop());
    }
    let firstCard = deck.pop();
    let firstPlayer = 'player';
    if (firstCard.isSpecial) {
        firstPlayer = 'computer';
    }
    return {
        deck,
        discardPile: [firstCard],
        player: { hand: playerHand, prison: playerPrison },
        computer: { hand: computerHand, prison: computerPrison },
        currentTurn: firstPlayer,
        turnCount: 1,
        burnedCards: [],
        gameOver: false,
        winner: null,
        status: firstPlayer === 'player' ? "Game started! It's your turn." : "Game started! Special card flipped - computer goes first.",
        log: [],
        _aiMemory: {
            knownOpponentCards: [],
            unknownOpponentDraws: 0,
            opponentPlayHistory: []
        }
    };
}

function getEffectiveValue(state) {
    for (let i = state.discardPile.length - 1; i >= 0; i--) {
        const card = state.discardPile[i];
        if (card.type === CardType.ATTACK) return card.value;
        if (card.type === CardType.DEMOTER || card.type === CardType.SKORCH) return 0;
    }
    return 0;
}

function isValidPlay(card, state) {
    if (card.isSpecial) return true;
    if (state.discardPile.length === 0) return true;
    const topCard = state.discardPile[state.discardPile.length - 1];
    if (topCard.type === CardType.DEMOTER || topCard.type === CardType.SKORCH) return true;
    if (card.type === CardType.ATTACK) {
        return card.value >= getEffectiveValue(state);
    }
    return false;
}

function isValidStack(cards) {
    if (cards.length === 0) return false;
    if (cards.length === 1) return true;
    const first = cards[0];
    if (first.type === CardType.SKORCH || first.type === CardType.SHIELD) return false;
    if (first.type === CardType.ATTACK) {
        return cards.every(c => c.type === CardType.ATTACK && c.value === first.value);
    }
    return cards.every(c => c.type === first.type);
}

function processSpecialEffect(state, who, card) {
    switch (card.type) {
        case CardType.SKORCH:
            state.burnedCards = (state.burnedCards || []).concat(state.discardPile);
            state.discardPile = [];
            return { type: 'skorch', message: ' Skorch! Discard pile burned.' };
        case CardType.SHIELD:
            return { type: 'shield', message: " Shield! Opponent's turn skipped." };
        case CardType.DEMOTER:
            return { type: 'demoter', message: ' Demoter! Any card can be played next.' };
        case CardType.ELUDE:
            return { type: 'elude', message: ` Elude! Value to beat remains ${getEffectiveValue(state)}.` };
        case CardType.UNDEAD:
            return { type: 'undead', message: ' Undead! Choose cards to swap.' };
        default:
            return { type: 'none', message: '' };
    }
}

function playFromHand(state, who, handIndexes) {
    // Deduplicate indexes to prevent card duplication exploit
    handIndexes = [...new Set(handIndexes)];
    const player = state[who];
    const cards = handIndexes.map(i => player.hand[i]).filter(Boolean);
    if (cards.length === 0) return { success: false, message: 'No valid cards selected.' };
    if (!isValidStack(cards)) return { success: false, message: 'All cards must be the same type and value.' };
    if (!isValidPlay(cards[0], state)) {
        player.hand = player.hand.concat(state.discardPile);
        state.discardPile = [];
        return { success: true, message: 'Invalid play! You picked up the discard pile.', effect: 'pickup' };
    }
    const sortedDesc = [...handIndexes].sort((a, b) => b - a);
    for (const idx of sortedDesc) { player.hand.splice(idx, 1); }
    state.discardPile.push(...cards);
    const effect = processSpecialEffect(state, who, cards[0]);
    const cardName = cards[0].type === CardType.ATTACK ? `Attack ${cards[0].value}` : cards[0].name;
    return {
        success: true,
        message: `${cards.length > 1 ? cards.length + 'x ' : ''}${cardName} played.${effect.message}`,
        effect: effect.type
    };
}

function playFromPrison(state, who, row, index) {
    const player = state[who];
    if (player.hand.length > 0) return { success: false, message: 'Must play all hand cards first.' };
    if (!isPrisonCardAccessible(player.prison, row, index)) return { success: false, message: 'That card is not accessible.' };
    const slot = player.prison[row][index];
    const card = slot.card;
    const wasFaceDown = !slot.faceUp;
    if (wasFaceDown) {
        slot.faceUp = true;
        if (!isValidPlay(card, state)) {
            player.hand = player.hand.concat(state.discardPile);
            player.hand.push(card);
            state.discardPile = [];
            slot.card = null;
            return { success: true, message: `Flipped ${card.name} - invalid! Picked up the discard pile.`, effect: 'pickup' };
        }
    } else {
        if (!isValidPlay(card, state)) {
            player.hand = player.hand.concat(state.discardPile);
            player.hand.push(card);
            state.discardPile = [];
            slot.card = null;
            return { success: true, message: `Played ${card.name} - invalid! Picked up the discard pile.`, effect: 'pickup' };
        }
    }
    slot.card = null;
    state.discardPile.push(card);
    const effect = processSpecialEffect(state, who, card);
    return {
        success: true,
        message: `${wasFaceDown ? '(Face-down) ' : ''}${card.name} played from prison.${effect.message}`,
        effect: effect.type
    };
}

function pickupDiscardPile(state, who) {
    const player = state[who];
    player.hand = player.hand.concat(state.discardPile);
    state.discardPile = [];
    return { success: true, message: 'Picked up the discard pile.' };
}

function drawCard(state, who) {
    if (state.deck.length === 0) return null;
    const card = state.deck.pop();
    state[who].hand.push(card);
    return card;
}

function executeUndeadSwap(state, who, myCard, theirCard) {
    const opponent = who === 'player' ? 'computer' : 'player';
    swapPrisonCards(state[who].prison, myCard.row, myCard.index, state[opponent].prison, theirCard.row, theirCard.index);
    return { success: true, message: 'Undead swap complete!' };
}

function executeUndeadTake(state, who, theirCard) {
    const opponent = who === 'player' ? 'computer' : 'player';
    const takenCard = removePrisonCard(state[opponent].prison, theirCard.row, theirCard.index);
    if (!takenCard) return { success: false, message: 'No card to take.' };

    const prison = state[who].prison;
    let placed = false;
    for (const row of ['front', 'back']) {
        for (let i = 0; i < prison[row].length; i++) {
            if (prison[row][i].card === null) {
                prison[row][i].card = takenCard;
                prison[row][i].faceUp = true;
                placed = true;
                break;
            }
        }
        if (placed) break;
    }

    if (!placed) {
        state[who].hand.push(takenCard);
    }

    return { success: true, message: `Took ${takenCard.name} from opponent's prison.` };
}

function nextTurn(state) {
    state.currentTurn = state.currentTurn === 'player' ? 'computer' : 'player';
    state.turnCount++;
}

function checkWin(state, who) {
    const player = state[who];
    if (player.hand.length > 0) return false;
    return isPrisonEmpty(player.prison);
}

function getPlayableHandCards(state, who) {
    const hand = state[who].hand;
    const playable = [];
    for (let i = 0; i < hand.length; i++) {
        if (isValidPlay(hand[i], state)) playable.push({ index: i, card: hand[i] });
    }
    return playable;
}

// --- Exports ---

module.exports = {
    // Cards
    CardType,
    SPECIAL_TYPES,
    createCard,
    getCardImage,
    // Deck
    generateDeck,
    shuffleDeck,
    // Prison
    createPrison,
    isPrisonCardAccessible,
    removePrisonCard,
    isPrisonEmpty,
    getUnlockedCards,
    swapPrisonCards,
    // Game
    createGameState,
    getEffectiveValue,
    isValidPlay,
    isValidStack,
    playFromHand,
    playFromPrison,
    pickupDiscardPile,
    drawCard,
    executeUndeadSwap,
    executeUndeadTake,
    nextTurn,
    checkWin,
    getPlayableHandCards
};
