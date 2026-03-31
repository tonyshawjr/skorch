import { createGameState, playFromHand, playFromPrison, pickupDiscardPile, drawCard, nextTurn, checkWin, executeUndeadSwap, executeUndeadTake } from './engine/game.js';
import { computerTurn } from './ai/computer.js';
import { render } from './ui/renderer.js';
import { showUndeadModal } from './ui/undead-modal.js';

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
    const result = computerTurn(state);
    state.status = `Computer: ${result.message}`;

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
    state = createGameState();
    update();
    if (state.currentTurn === 'computer') setTimeout(doComputerTurn, 1000);
}

// Initial render
update();
if (state.currentTurn === 'computer') setTimeout(doComputerTurn, 1000);
