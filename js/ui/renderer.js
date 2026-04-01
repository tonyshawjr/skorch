import { getCardImage, CardType } from '../engine/cards.js';
import { getEffectiveValue } from '../engine/game.js';
import { toggleMute, isMuted } from './sound.js';

const ASSETS_PATH = 'assets/cards/';

const SVG_SOUND = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>';
const SVG_MUTED = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';

export function render(state, root, handlers) {
    root.innerHTML = '';
    root.appendChild(createHeader(state, handlers.onRestart, handlers.onMultiplayer));

    if (window.innerWidth <= 1024) {
    // --- MOBILE LAYOUT ---

    // 1. Discard area (hero section)
    const discardArea = el('div', 'mobile-discard-area');

    // Discard pile - large
    const discardSection = el('div', 'mobile-discard');
    if (state.discardPile.length > 0) {
        const topCard = state.discardPile[state.discardPile.length - 1];
        const discardCard = createCardElement(topCard, true);
        discardCard.classList.add('mobile-discard-card');
        discardSection.appendChild(discardCard);
        const count = el('span', 'mobile-pile-count');
        count.textContent = state.discardPile.length;
        discardSection.appendChild(count);
    } else {
        const placeholder = el('div', 'sk-card sk-placeholder mobile-discard-card');
        discardSection.appendChild(placeholder);
    }
    discardArea.appendChild(discardSection);

    // Draw pile count (small, beside discard)
    if (state.deck.length > 0) {
        const drawInfo = el('div', 'mobile-draw-info');
        drawInfo.innerHTML = `<span class="mobile-draw-label">Draw</span><span class="mobile-draw-count">${state.deck.length}</span>`;
        discardArea.appendChild(drawInfo);
    }

    root.appendChild(discardArea);

    // 2. Action buttons
    const actions = el('div', 'mobile-actions');
    const playBtn = el('button', 'mobile-play-btn');
    playBtn.id = 'playSelectedBtn';
    playBtn.textContent = 'Play Selected';
    playBtn.disabled = true;
    if (state.currentTurn === 'player' && !state.gameOver) {
        playBtn.addEventListener('click', handlers.onPlaySelected);
    }
    actions.appendChild(playBtn);

    const pickupBtn = el('button', 'mobile-pickup-btn');
    const canPickup = state.currentTurn === 'player' && !state.gameOver &&
                      state.player.hand.length > 0 && state.discardPile.length > 0;
    if (!canPickup) {
        pickupBtn.disabled = true;
        if (state.gameOver) pickupBtn.textContent = 'Game Over';
        else if (state.currentTurn !== 'player') pickupBtn.textContent = 'Waiting...';
        else if (state.player.hand.length === 0) pickupBtn.textContent = 'Play Prison';
        else pickupBtn.textContent = 'Pick Up';
    } else {
        pickupBtn.textContent = 'Pick Up';
        pickupBtn.addEventListener('click', handlers.onPickup);
    }
    actions.appendChild(pickupBtn);
    root.appendChild(actions);

    // 3. Your hand (horizontal scroll)
    const handSection = el('div', 'mobile-hand-section');
    const handLabel = el('div', 'mobile-section-label');
    handLabel.textContent = (state._myName || 'Your Hand') + ` (${state.player.hand.length})`;
    handSection.appendChild(handLabel);

    const handScroll = el('div', 'mobile-hand-scroll');

    // Separate playable from unplayable
    const effectiveValue = getEffectiveValue(state);
    const playable = [];
    const unplayable = [];
    state.player.hand.forEach((card, index) => {
        if (!card) return;
        const isSpecial = card.isSpecial || (card.type && card.type !== 'attack');
        if (isSpecial || state.discardPile.length === 0 ||
            (card.type === 'attack' && card.value >= effectiveValue) ||
            (state.discardPile.length > 0 && (
                state.discardPile[state.discardPile.length - 1].type === 'demoter' ||
                state.discardPile[state.discardPile.length - 1].type === 'skorch'
            ))) {
            playable.push({ card, index });
        } else {
            unplayable.push({ card, index });
        }
    });

    // Sort playable
    playable.sort((a, b) => {
        if (a.card.type === 'attack' && b.card.type === 'attack') return a.card.value - b.card.value;
        if (a.card.type === 'attack') return -1;
        if (b.card.type === 'attack') return 1;
        return 0;
    });

    // No playable cards - show pickup card
    if (playable.length === 0 && state.currentTurn === 'player' && !state.gameOver && state.discardPile.length > 0) {
        const pickupCard = el('div', 'mobile-pickup-card');
        pickupCard.textContent = 'Pick Up';
        pickupCard.addEventListener('click', handlers.onPickup);
        handScroll.appendChild(pickupCard);
    }

    // Render playable cards
    playable.forEach(({ card, index }) => {
        const cardEl = createCardElement(card, true);
        cardEl.classList.add('mobile-hand-card');
        if (state.currentTurn === 'player' && !state.gameOver) {
            cardEl.classList.add('selectable');
            cardEl.dataset.index = index;
            cardEl.addEventListener('click', () => handlers.onCardSelect(index, cardEl));
        }
        handScroll.appendChild(cardEl);
    });

    // Unplayable badge - tap to see all in modal
    if (unplayable.length > 0) {
        const badge = el('button', 'mobile-unplayable-badge');
        badge.textContent = `+${unplayable.length}`;
        badge.addEventListener('click', () => {
            const sheet = el('div', 'mobile-peek-sheet');
            sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.remove(); });
            const content = el('div', 'mobile-peek-content');
            const title = el('h3');
            title.textContent = `Cards You Can't Play Yet (${unplayable.length})`;
            title.style.cssText = 'color:white;margin-bottom:1rem;font-size:1rem;text-align:center;';
            content.appendChild(title);
            const cardGrid = el('div', 'mobile-unplayable-grid');
            unplayable.forEach(({ card }) => {
                const cardEl = createCardElement(card, true);
                cardEl.classList.add('mobile-hand-card');
                cardEl.style.margin = '0';
                cardGrid.appendChild(cardEl);
            });
            content.appendChild(cardGrid);
            const hint = el('p');
            hint.textContent = 'Tap outside to close';
            hint.style.cssText = 'color:#6b7280;text-align:center;margin-top:1rem;font-size:0.8rem;';
            content.appendChild(hint);
            sheet.appendChild(content);
            document.body.appendChild(sheet);
        });
        handScroll.appendChild(badge);
    }

    handSection.appendChild(handScroll);
    root.appendChild(handSection);

    // Reset scroll to left
    requestAnimationFrame(() => { handScroll.scrollLeft = 0; });

    // 4. Your prison
    const prisonSection = el('div', 'mobile-prison-section');
    const prisonLabel = el('div', 'mobile-section-label');
    prisonLabel.textContent = 'Your Prison';
    prisonSection.appendChild(prisonLabel);

    for (const rowName of ['front', 'back']) {
        const row = el('div', 'mobile-prison-row');
        state.player.prison[rowName].forEach((slot, index) => {
            if (slot.card === null) {
                row.appendChild(el('div', 'sk-card sk-placeholder mobile-prison-card'));
            } else {
                const cardEl = createCardElement(slot.card, slot.faceUp);
                cardEl.classList.add('mobile-prison-card');
                if (!slot.faceUp) {
                    cardEl.className = 'sk-card sk-face-down mobile-prison-card';
                    cardEl.style.backgroundImage = `url('${ASSETS_PATH}Card-Back.png')`;
                }
                if (state.currentTurn === 'player' && state.player.hand.length === 0 && !state.gameOver) {
                    cardEl.style.cursor = 'pointer';
                    cardEl.addEventListener('click', () => handlers.onPrisonClick(rowName, index));
                }
                row.appendChild(cardEl);
            }
        });
        prisonSection.appendChild(row);
    }
    root.appendChild(prisonSection);

    // 5. Opponent peek bar
    const oppBar = el('div', 'mobile-opponent-bar');
    const oppInfo = el('span', 'mobile-opp-info');
    oppInfo.textContent = `${state._opponentName || 'Opponent'}: ${state.computer.hand.length} cards`;
    oppBar.appendChild(oppInfo);

    const peekBtn = el('button', 'mobile-peek-btn');
    peekBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    peekBtn.addEventListener('click', () => {
        // Show opponent peek sheet
        const sheet = el('div', 'mobile-peek-sheet');
        sheet.addEventListener('click', () => sheet.remove());

        const content = el('div', 'mobile-peek-content');
        const title = el('h3');
        title.textContent = `${state._opponentName || 'Opponent'} - ${state.computer.hand.length} cards in hand`;
        title.style.cssText = 'color:white;margin-bottom:1rem;font-size:1rem;text-align:center;';
        content.appendChild(title);

        // Show opponent prison
        for (const rowName of ['front', 'back']) {
            const row = el('div', 'mobile-prison-row');
            state.computer.prison[rowName].forEach((slot) => {
                if (slot.card === null) {
                    row.appendChild(el('div', 'sk-card sk-placeholder mobile-prison-card'));
                } else {
                    const showFace = slot.faceUp;
                    const cardEl = createCardElement(slot.card, showFace);
                    cardEl.classList.add('mobile-prison-card');
                    if (!showFace) {
                        cardEl.className = 'sk-card sk-face-down mobile-prison-card';
                        cardEl.style.backgroundImage = `url('${ASSETS_PATH}Card-Back.png')`;
                    }
                    row.appendChild(cardEl);
                }
            });
            content.appendChild(row);
        }

        const hint = el('p');
        hint.textContent = 'Tap anywhere to close';
        hint.style.cssText = 'color:#6b7280;text-align:center;margin-top:1rem;font-size:0.8rem;';
        content.appendChild(hint);

        sheet.appendChild(content);
        document.body.appendChild(sheet);
    });
    oppBar.appendChild(peekBtn);
    root.appendChild(oppBar);

    // Status at very bottom
    root.appendChild(createStatusBar(state));
    } else {
        // Desktop: normal layout
        const board = el('div', 'game-board');
        board.appendChild(createPlayerArea(state, handlers));
        board.appendChild(createComputerArea(state));
        board.appendChild(createCenterSection(state, handlers));
        root.appendChild(board);
        root.appendChild(createStatusBar(state));
    }
}

function createHeader(state, onRestart, onMultiplayer) {
    const header = el('header', 'game-header');
    const logo = el('div', 'header-left');
    const img = document.createElement('img');
    img.src = 'assets/logo-red.png';
    img.alt = 'Skorch';
    img.className = 'game-logo';
    logo.appendChild(img);
    header.appendChild(logo);

    // Room code (if multiplayer)
    if (state._roomCode) {
        const roomBadge = el('div', 'room-code-badge');
        roomBadge.textContent = `Room: ${state._roomCode}`;
        header.appendChild(roomBadge);
    }

    // Turn indicator in center of header
    const indicator = el('div', `turn-indicator${state.currentTurn === 'player' ? ' your-turn' : ''}`);
    indicator.textContent = state.gameOver
        ? (state.winner === 'player' ? 'You Win!' : 'Computer Wins!')
        : (state.currentTurn === 'player' ? 'Your Turn' : "Opponent's Turn");
    header.appendChild(indicator);

    const isMobile = window.innerWidth <= 1024;

    if (isMobile) {
        // Hamburger menu for mobile
        const hamburger = el('button', 'hamburger-btn');
        hamburger.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
        header.appendChild(hamburger);

        const drawer = el('div', 'mobile-drawer');
        const drawerContent = el('div', 'mobile-drawer-content');

        const muteBtn = el('button', 'drawer-item');
        muteBtn.innerHTML = (isMuted() ? 'Unmute Sound' : 'Mute Sound');
        muteBtn.addEventListener('click', () => {
            const nowMuted = toggleMute();
            muteBtn.textContent = nowMuted ? 'Unmute Sound' : 'Mute Sound';
        });
        drawerContent.appendChild(muteBtn);

        const mpBtn = el('button', 'drawer-item');
        mpBtn.textContent = 'Multiplayer';
        mpBtn.addEventListener('click', () => { drawer.classList.remove('open'); onMultiplayer(); });
        drawerContent.appendChild(mpBtn);

        const restartBtn = el('button', 'drawer-item drawer-item-danger');
        restartBtn.textContent = 'Restart Game';
        restartBtn.addEventListener('click', () => { drawer.classList.remove('open'); onRestart(); });
        drawerContent.appendChild(restartBtn);

        drawer.appendChild(drawerContent);
        drawer.addEventListener('click', (e) => { if (e.target === drawer) drawer.classList.remove('open'); });
        header.appendChild(drawer);

        hamburger.addEventListener('click', () => drawer.classList.toggle('open'));
    } else {
        // Desktop: normal actions row
        const actions = el('div', 'header-actions');
        const muteBtn = el('button', 'btn-mute');
        muteBtn.innerHTML = isMuted() ? SVG_MUTED : SVG_SOUND;
        muteBtn.addEventListener('click', () => {
            const nowMuted = toggleMute();
            muteBtn.innerHTML = nowMuted ? SVG_MUTED : SVG_SOUND;
        });
        actions.appendChild(muteBtn);
        const mpBtn = el('button', 'btn-multiplayer');
        mpBtn.textContent = 'Multiplayer';
        mpBtn.addEventListener('click', onMultiplayer);
        actions.appendChild(mpBtn);
        const restartBtn = el('button', 'btn-restart');
        restartBtn.textContent = 'Restart Game';
        restartBtn.addEventListener('click', onRestart);
        actions.appendChild(restartBtn);
        header.appendChild(actions);
    }

    return header;
}

function createStatusBar(state) {
    const container = el('div', 'status-container');
    const msg = el('div', 'status-message');
    const isMobile = window.innerWidth <= 1024;

    // Show value to beat
    const value = getEffectiveValue(state);
    const valueText = state.discardPile.length === 0 ? 'Any' : `Beat ${value}`;
    const valueSpan = el('span', 'value-to-beat');
    valueSpan.textContent = valueText;
    msg.appendChild(valueSpan);

    // Status text - truncate on mobile, tap for full
    const fullStatus = state.status || '';
    const statusText = el('span', 'status-text');

    if (isMobile && fullStatus.length > 30) {
        // Short version
        const short = fullStatus.substring(0, 28) + '...';
        statusText.textContent = short;
        msg.style.cursor = 'pointer';
        msg.addEventListener('click', () => {
            const sheet = el('div', 'mobile-peek-sheet');
            sheet.addEventListener('click', () => sheet.remove());
            const content = el('div', 'mobile-peek-content');
            const text = el('p');
            text.textContent = fullStatus;
            text.style.cssText = 'color:white;font-size:1rem;text-align:center;line-height:1.6;';
            content.appendChild(text);
            sheet.appendChild(content);
            document.body.appendChild(sheet);
        });
    } else {
        statusText.textContent = fullStatus;
    }

    msg.appendChild(statusText);
    container.appendChild(msg);
    return container;
}

function createPlayerArea(state, handlers) {
    const section = el('section', 'area-box');
    const handSection = el('div', 'hand-section');
    const handTitle = el('h3');
    handTitle.textContent = (state._myName || 'Your Hand') + ' ';
    const countBadge = el('span', `card-count${state.player.hand.length > 7 ? ' warning' : ''}`);
    countBadge.textContent = state.player.hand.length;
    handTitle.appendChild(countBadge);
    handSection.appendChild(handTitle);

    const effectiveValue = getEffectiveValue(state);
    const playable = [];
    const unplayable = [];

    state.player.hand.forEach((card, index) => {
        if (!card) return; // Guard against null cards
        const isSpecial = card.isSpecial || (card.type && card.type !== 'attack');
        if (isSpecial || state.discardPile.length === 0 ||
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
    title.textContent = (state._opponentName || 'Opponent Hand') + ' ';
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

    // Make draggable (desktop only - on mobile, center piles are inline)
    if (window.innerWidth > 1024) {
        makeDraggable(section);
    }

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

        // Show effective value when top card is a special (value hidden)
        if (topCard.isSpecial) {
            const effectiveVal = getEffectiveValue(state);
            const valueBadge = el('div', 'discard-value-badge');
            valueBadge.textContent = effectiveVal === 0 ? 'Any' : `Beat ${effectiveVal}`;
            discardStack.appendChild(valueBadge);
        }
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

// Restore saved position for center piles
const PILE_POS_KEY = 'skorch_pile_pos';
let _dragCleanup = null;

function makeDraggable(el) {
    // Clean up previous listeners
    if (_dragCleanup) _dragCleanup();

    let isDragging = false;
    let startX, startY;

    // Restore saved position
    try {
        const saved = JSON.parse(localStorage.getItem(PILE_POS_KEY));
        if (saved) {
            el.style.left = saved.left;
            el.style.top = saved.top;
            el.style.transform = 'none';
        }
    } catch(e) {}

    el.style.cursor = 'grab';

    el.addEventListener('mousedown', (e) => {
        // Don't drag if clicking a button
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
        isDragging = true;
        el.style.cursor = 'grabbing';
        // Get actual rendered position
        const rect = el.getBoundingClientRect();
        // Store offset of mouse within the element
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        // Kill the centering transform immediately
        el.style.transform = 'none';
        el.style.left = rect.left + 'px';
        el.style.top = rect.top + 'px';
        e.preventDefault();
    });

    const onMouseMove = (e) => {
        if (!isDragging) return;
        el.style.left = (e.clientX - startX) + 'px';
        el.style.top = (e.clientY - startY) + 'px';
    };

    const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        el.style.cursor = 'grab';
        // Save position
        try {
            localStorage.setItem(PILE_POS_KEY, JSON.stringify({
                left: el.style.left,
                top: el.style.top
            }));
        } catch(e) {}
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    _dragCleanup = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
}
