export const CardType = {
    ATTACK: 'attack',
    ELUDE: 'elude',
    SHIELD: 'shield',
    DEMOTER: 'demoter',
    SKORCH: 'skorch',
    UNDEAD: 'undead'
};

export const SPECIAL_TYPES = [
    CardType.ELUDE, CardType.SHIELD, CardType.DEMOTER, CardType.SKORCH, CardType.UNDEAD
];

export function createCard(type, value = null) {
    return {
        id: crypto.randomUUID(),
        type,
        value,
        name: type === CardType.ATTACK ? `Attack ${value}` : type.charAt(0).toUpperCase() + type.slice(1),
        isSpecial: type !== CardType.ATTACK
    };
}

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
