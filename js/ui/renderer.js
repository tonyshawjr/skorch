import { getCardImage, CardType } from '../engine/cards.js';
import { getEffectiveValue } from '../engine/game.js';

const ASSETS_PATH = 'assets/cards/';

export function render(state, root, handlers) {
    root.innerHTML = '';
    root.appendChild(createHeader(state, handlers.onRestart));
    const board = el('div', 'game-board');
    board.appendChild(createPlayerArea(state, handlers));
    board.appendChild(createComputerArea(state));
    board.appendChild(createCenterSection(state, handlers));
    root.appendChild(board);
    root.appendChild(createStatusBar(state));
}

function createHeader(state, onRestart) {
    const header = el('header', 'game-header');
    const logo = el('div', 'header-left');
    const img = document.createElement('img');
    img.src = 'assets/logo-red.png';
    img.alt = 'Skorch';
    img.className = 'game-logo';
    logo.appendChild(img);
    header.appendChild(logo);

    // Turn indicator in center of header
    const indicator = el('div', `turn-indicator${state.currentTurn === 'player' ? ' your-turn' : ''}`);
    indicator.textContent = state.gameOver
        ? (state.winner === 'player' ? 'You Win!' : 'Computer Wins!')
        : (state.currentTurn === 'player' ? 'Your Turn' : "Computer's Turn");
    header.appendChild(indicator);

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
    const handSection = el('div', 'hand-section');
    const handTitle = el('h3');
    handTitle.textContent = 'Your Hand ';
    const countBadge = el('span', `card-count${state.player.hand.length > 7 ? ' warning' : ''}`);
    countBadge.textContent = state.player.hand.length;
    handTitle.appendChild(countBadge);
    handSection.appendChild(handTitle);

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

    playable.sort((a, b) => {
        if (a.card.type === CardType.ATTACK && b.card.type === CardType.ATTACK) return a.card.value - b.card.value;
        if (a.card.type === CardType.ATTACK) return -1;
        if (b.card.type === CardType.ATTACK) return 1;
        return 0;
    });

    const handContainer = el('div', 'hand-container');

    if (playable.length > 0) {
        const playableDiv = el('div', 'playable-cards');
        // Split into rows of 8
        for (let r = 0; r < playable.length; r += 8) {
            const row = el('div', 'card-row');
            const chunk = playable.slice(r, r + 8);
            chunk.forEach(({ card, index }) => {
                const cardEl = createCardElement(card, true);
                if (state.currentTurn === 'player' && !state.gameOver) {
                    cardEl.classList.add('selectable');
                    cardEl.dataset.index = index;
                    cardEl.addEventListener('click', () => handlers.onCardSelect(index, cardEl));
                }
                row.appendChild(cardEl);
            });
            playableDiv.appendChild(row);
        }
        handContainer.appendChild(playableDiv);
    }

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

    if (playable.length === 0 && state.player.hand.length > 0 && state.currentTurn === 'player' && !state.gameOver) {
        // Only show "no playable cards" when player HAS cards but none are playable
        // When hand is empty, player should be playing from prison instead
        const noPlays = el('div', 'no-plays-message');
        noPlays.innerHTML = '<p>No playable cards - pick up the discard pile</p>';
        const pickupBtn = el('button', 'btn-pickup prominent');
        pickupBtn.textContent = 'Pick Up Discard Pile';
        pickupBtn.addEventListener('click', handlers.onPickup);
        noPlays.appendChild(pickupBtn);
        handContainer.appendChild(noPlays);
    } else if (state.player.hand.length === 0 && state.currentTurn === 'player' && !state.gameOver) {
        const prisonMsg = el('div', 'no-plays-message');
        prisonMsg.innerHTML = '<p style="color: var(--skorch-green);">Hand empty - play from your prison!</p>';
        handContainer.appendChild(prisonMsg);
    }

    handSection.appendChild(handContainer);
    section.appendChild(handSection);
    section.appendChild(createPrisonSection(state, 'player', handlers));
    return section;
}

function createComputerArea(state) {
    const section = el('section', 'area-box');
    const handSection = el('div', 'hand-section');
    const title = el('h3');
    title.textContent = 'Opponent Hand ';
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
        row.appendChild(createCardElement(null, false));
    }
    handContainer.appendChild(row);
    handSection.appendChild(handContainer);
    section.appendChild(handSection);
    section.appendChild(createPrisonSection(state, 'computer', null));
    return section;
}

function createPrisonSection(state, who, handlers) {
    const prison = state[who].prison;
    const section = el('div', 'prison-section');
    const label = el('h4', 'prison-label');
    label.textContent = who === 'player' ? 'Your Prison' : "Opponent's Prison";
    section.appendChild(label);

    for (const rowName of ['front', 'back']) {
        const rowDiv = el('div', 'prison-row');
        const rowLabel = el('span', 'row-label');
        rowLabel.textContent = rowName === 'front' ? 'Front' : 'Back';
        rowDiv.appendChild(rowLabel);
        const container = el('div', 'card-container');

        prison[rowName].forEach((slot, index) => {
            if (slot.card === null) {
                const placeholder = el('div', 'sk-card sk-placeholder');
                container.appendChild(placeholder);
            } else {
                // For computer's cards: show face-up cards, hide face-down
                const showFace = who === 'player' ? true : slot.faceUp;
                const cardEl = createCardElement(slot.card, showFace && slot.faceUp);
                if (!slot.faceUp) {
                    // Show as face-down
                    cardEl.className = 'sk-card sk-face-down';
                    cardEl.style.backgroundImage = `url('${ASSETS_PATH}Card-Back.png')`;
                }

                if (who === 'player' && handlers && state.currentTurn === 'player' && state.player.hand.length === 0 && !state.gameOver) {
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

function createCenterSection(state, handlers) {
    const section = el('div', 'center-piles');

    // Discard pile (top)
    const discardPile = el('div', 'pile-section');
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
        discardStack.appendChild(el('div', 'sk-card sk-placeholder'));
    }
    discardPile.appendChild(discardStack);
    section.appendChild(discardPile);

    // Buttons (middle)
    const buttonGroup = el('div', 'center-buttons');

    const playBtn = el('button', 'btn-play');
    playBtn.id = 'playSelectedBtn';
    playBtn.textContent = 'Play Selected';
    playBtn.disabled = true;
    if (state.currentTurn === 'player' && !state.gameOver) {
        playBtn.addEventListener('click', handlers.onPlaySelected);
    }
    buttonGroup.appendChild(playBtn);

    const pickupBtn = el('button', 'btn-pickup');
    const canPickup = state.currentTurn === 'player' && !state.gameOver &&
                      state.player.hand.length > 0 && state.discardPile.length > 0;
    if (!canPickup) {
        pickupBtn.disabled = true;
        if (state.gameOver) pickupBtn.textContent = 'Game Over';
        else if (state.currentTurn !== 'player') pickupBtn.textContent = 'Waiting...';
        else if (state.player.hand.length === 0) pickupBtn.textContent = 'Play Prison';
        else if (state.discardPile.length === 0) pickupBtn.textContent = 'Pile Empty';
        else pickupBtn.textContent = 'Pick Up Pile';
    } else {
        pickupBtn.textContent = 'Pick Up Pile';
        pickupBtn.addEventListener('click', handlers.onPickup);
    }
    buttonGroup.appendChild(pickupBtn);
    section.appendChild(buttonGroup);

    // Draw pile (bottom)
    const drawPile = el('div', 'pile-section');
    const drawLabel = el('div', 'pile-label');
    drawLabel.textContent = 'Draw Pile';
    drawPile.appendChild(drawLabel);
    const drawStack = el('div', 'pile-stack');
    if (state.deck.length > 0) {
        drawStack.appendChild(createCardElement(null, false));
        const drawCount = el('span', 'pile-count');
        drawCount.textContent = state.deck.length;
        drawStack.appendChild(drawCount);
    } else {
        drawStack.appendChild(el('div', 'sk-card sk-placeholder'));
    }
    drawPile.appendChild(drawStack);
    section.appendChild(drawPile);

    return section;
}

function createCardElement(card, faceUp) {
    const div = el('div', 'sk-card');
    if (!faceUp || !card) {
        div.classList.add('sk-face-down');
        div.style.backgroundImage = `url('${ASSETS_PATH}Card-Back.png')`;
    } else {
        div.classList.add('sk-face-up');
        div.style.backgroundImage = `url('${ASSETS_PATH}${getCardImage(card)}')`;
        div.dataset.type = card.type;
        if (card.type === CardType.ATTACK) div.dataset.value = card.value;
        else div.dataset.effect = card.name;
    }
    return div;
}

function el(tag, className = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    return element;
}
