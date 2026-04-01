import { CardType, createCard } from './cards.js';

export function generateDeck() {
    const deck = [];
    for (let rank = 1; rank <= 10; rank++) {
        for (let i = 0; i < 6; i++) {
            deck.push(createCard(CardType.ATTACK, rank));
        }
    }
    const specials = [
        { type: CardType.ELUDE, count: 4 },
        { type: CardType.SHIELD, count: 0 }, // Removed from 2-player games
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

export function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}
