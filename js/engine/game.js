import { CardType } from './cards.js';
import { generateDeck, shuffleDeck } from './deck.js';
import { createPrison, isPrisonCardAccessible, removePrisonCard, isPrisonEmpty, getUnlockedCards, swapPrisonCards } from './prison.js';

export function createGameState() {
    const deck = shuffleDeck(generateDeck());
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

export function getEffectiveValue(state) {
    if (state.discardPile.length === 0) return 0;
    const topCard = state.discardPile[state.discardPile.length - 1];
    if (topCard.type === CardType.DEMOTER) return 0;
    if (topCard.type === CardType.SKORCH) return 0;
    for (let i = state.discardPile.length - 1; i >= 0; i--) {
        if (state.discardPile[i].type === CardType.ATTACK) {
            return state.discardPile[i].value;
        }
    }
    return 0;
}

export function isValidPlay(card, state) {
    if (card.isSpecial) return true;
    if (state.discardPile.length === 0) return true;
    const topCard = state.discardPile[state.discardPile.length - 1];
    if (topCard.type === CardType.DEMOTER || topCard.type === CardType.SKORCH) return true;
    if (card.type === CardType.ATTACK) {
        return card.value >= getEffectiveValue(state);
    }
    return false;
}

export function isValidStack(cards) {
    if (cards.length === 0) return false;
    if (cards.length === 1) return true;
    const first = cards[0];
    return cards.every(c => c.type === first.type && (c.type !== CardType.ATTACK || c.value === first.value));
}

export function playFromHand(state, who, handIndexes) {
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

export function playFromPrison(state, who, row, index) {
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
            // Face-up invalid play - strategic choice to pick up the pile and hide this card
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

export function pickupDiscardPile(state, who) {
    const player = state[who];
    player.hand = player.hand.concat(state.discardPile);
    state.discardPile = [];
    return { success: true, message: 'Picked up the discard pile.' };
}

export function drawCard(state, who) {
    if (state.deck.length === 0) return null;
    const card = state.deck.pop();
    state[who].hand.push(card);
    return card;
}

function processSpecialEffect(state, who, card) {
    switch (card.type) {
        case CardType.SKORCH:
            // Skorch burns EVERYTHING - the pile AND the Skorch card itself. All removed from game.
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

export function executeUndeadSwap(state, who, myCard, theirCard) {
    const opponent = who === 'player' ? 'computer' : 'player';
    swapPrisonCards(state[who].prison, myCard.row, myCard.index, state[opponent].prison, theirCard.row, theirCard.index);
    return { success: true, message: 'Undead swap complete!' };
}

export function executeUndeadTake(state, who, theirCard) {
    const opponent = who === 'player' ? 'computer' : 'player';
    const card = removePrisonCard(state[opponent].prison, theirCard.row, theirCard.index);
    if (card) state[who].hand.push(card);
    return { success: true, message: `Took ${card?.name || 'a card'} from opponent's prison.` };
}

export function nextTurn(state) {
    state.currentTurn = state.currentTurn === 'player' ? 'computer' : 'player';
    state.turnCount++;
}

export function checkWin(state, who) {
    const player = state[who];
    if (player.hand.length > 0) return false;
    return isPrisonEmpty(player.prison);
}

export function getPlayableHandCards(state, who) {
    const hand = state[who].hand;
    const playable = [];
    for (let i = 0; i < hand.length; i++) {
        if (isValidPlay(hand[i], state)) playable.push({ index: i, card: hand[i] });
    }
    return playable;
}
