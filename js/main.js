import { createGameState, playFromHand, playFromPrison, pickupDiscardPile, drawCard, nextTurn, checkWin, executeUndeadSwap, executeUndeadTake } from './engine/game.js';
import { computerTurn } from './ai/computer.js';
import { render } from './ui/renderer.js';
import { showUndeadModal } from './ui/undead-modal.js';

const SAVE_KEY = 'skorch_game_state';

function saveState() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch(e) {}
}

function loadState() {
    try {
        const saved = localStorage.getItem(SAVE_KEY);
        if (saved) return JSON.parse(saved);
    } catch(e) {}
    return null;
}

let state = loadState() || createGameState();
let selectedIndexes = new Set();
const root = document.getElementById('game-root');

function logHand(who) {
    const hand = state[who].hand;
    return hand.map(c => c.type === 'attack' ? `Attack ${c.value}` : c.name).join(', ') || '(empty)';
}

function logState(label) {
    console.log(`=== ${label} ===`);
    console.log(`Player hand (${state.player.hand.length}): ${logHand('player')}`);
    console.log(`Computer hand (${state.computer.hand.length}): ${logHand('computer')}`);
    const discardCards = state.discardPile.map(c => c.type === 'attack' ? `A${c.value}` : c.name.substring(0,3)).join(', ');
    console.log(`Discard pile (${state.discardPile.length}): [${discardCards}]`);
    console.log(`Deck: ${state.deck.length}`);
    console.log('');
}

function update() {
    selectedIndexes.clear();
    saveState();
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
    const playBtn = document.getElementById('playSelectedBtn');
    if (playBtn) {
        playBtn.disabled = selectedIndexes.size === 0;
        playBtn.classList.toggle('active', selectedIndexes.size > 0);
    }
}

function onPlaySelected() {
    if (state.currentTurn !== 'player' || selectedIndexes.size === 0) return;
    logState('BEFORE PLAYER PLAY');
    const indexes = Array.from(selectedIndexes).sort((a, b) => a - b);
    const cardsPlayed = indexes.map(i => state.player.hand[i]).map(c => c.type === 'attack' ? `Attack ${c.value}` : c.name).join(', ');
    const result = playFromHand(state, 'player', indexes);
    console.log(`>> Player played: ${cardsPlayed} → ${result.message}`);
    state.status = result.message;

    if (result.success && result.effect !== 'pickup') {
        if (result.effect === 'undead') {
            update();
            showUndeadModal(state,
                (myCard, theirCard) => {
                    if (myCard) executeUndeadSwap(state, 'player', myCard, theirCard);
                    else executeUndeadTake(state, 'player', theirCard);
                    state.status = 'Undead swap complete!';
                    drawCard(state, 'player');
                    if (checkWin(state, 'player')) { state.gameOver = true; state.winner = 'player'; state.status = 'You win!'; update(); return; }
                    nextTurn(state);
                    update();
                    setTimeout(doComputerTurn, 800);
                },
                () => {
                    state.status = 'Undead - no swap made.';
                    drawCard(state, 'player');
                    if (checkWin(state, 'player')) { state.gameOver = true; state.winner = 'player'; state.status = 'You win!'; update(); return; }
                    nextTurn(state);
                    update();
                    setTimeout(doComputerTurn, 800);
                }
            );
            return;
        }

        drawCard(state, 'player');
        if (checkWin(state, 'player')) { state.gameOver = true; state.winner = 'player'; state.status = 'You win!'; update(); return; }

        if (result.effect === 'shield') {
            state.status += ' You go again!';
            update();
            return;
        }

        nextTurn(state);
        update();
        setTimeout(doComputerTurn, 800);
    } else if (result.effect === 'pickup') {
        nextTurn(state);
        update();
        setTimeout(doComputerTurn, 800);
    } else {
        update();
    }
}

function onPickup() {
    logState('BEFORE PLAYER PICKUP');
    if (state.currentTurn !== 'player' || state.gameOver) return;
    pickupDiscardPile(state, 'player');
    drawCard(state, 'player');
    state.status = 'You picked up the discard pile.';
    nextTurn(state);
    update();
    setTimeout(doComputerTurn, 800);
}

function onPrisonClick(row, index) {
    if (state.currentTurn !== 'player' || state.player.hand.length > 0 || state.gameOver) return;
    logState('BEFORE PLAYER PRISON PLAY');
    const result = playFromPrison(state, 'player', row, index);
    state.status = result.message;

    if (result.success && result.effect !== 'pickup') {
        drawCard(state, 'player');
        if (checkWin(state, 'player')) { state.gameOver = true; state.winner = 'player'; state.status = 'You win!'; update(); return; }
        if (result.effect === 'shield') { state.status += ' You go again!'; update(); return; }
        nextTurn(state);
    } else if (result.effect === 'pickup') {
        nextTurn(state);
    }
    update();
    if (state.currentTurn === 'computer' && !state.gameOver) setTimeout(doComputerTurn, 800);
}

function doComputerTurn() {
    if (state.gameOver) return;
    if (state.currentTurn !== 'computer') return; // Guard: don't play on player's turn
    const result = computerTurn(state);
    state.status = `Computer: ${result.message}`;
    const discardList = state.discardPile.map(c => c.type === 'attack' ? `A${c.value}` : c.name.substring(0,3)).join(', ');
    console.log('--- COMPUTER TURN ---');
    console.log('Computer BEFORE:', result.handBefore);
    console.log(result.thoughts);
    console.log('Computer AFTER:', logHand('computer'));
    console.log('Player hand:', logHand('player'));
    console.log(`Discard pile (${state.discardPile.length}): [${discardList}]`);
    console.log(`Deck: ${state.deck.length}`);
    console.log('---------------------');

    if (state.gameOver) { update(); return; }

    // Shield: computer goes again
    if (result.message.includes('Shield') || result.message.includes('shield')) {
        update();
        setTimeout(doComputerTurn, 1000);
        return;
    }
    update();
}

function onRestart() {
    localStorage.removeItem(SAVE_KEY);
    state = createGameState();
    update();
    if (state.currentTurn === 'computer') setTimeout(doComputerTurn, 1000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && selectedIndexes.size > 0 && state.currentTurn === 'player' && !state.gameOver) {
        onPlaySelected();
    }
});

// Initial render
update();
if (state.currentTurn === 'computer') setTimeout(doComputerTurn, 1000);
