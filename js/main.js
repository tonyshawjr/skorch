import { createGameState, playFromHand, playFromPrison, pickupDiscardPile, drawCard, nextTurn, checkWin, executeUndeadSwap, executeUndeadTake } from './engine/game.js';
import { computerTurn } from './ai/computer.js';
import { render, markPlayerPlayed, resetRenderCache } from './ui/renderer.js';
import { showUndeadModal } from './ui/undead-modal.js';
import { animatePop, animateBurn, animateSlideIn, animateShake, wait } from './ui/animations.js';
import { announceSpecial, showGameOver } from './ui/announcer.js';
import { initSound, playCardSnap, playCardStack, playCardDraw, playPickup, playSkorch, playShield, playDemoter, playElude, playUndead, playError, playVictory, playDefeat, playTurnDing } from './ui/sound.js';
import { connect, createRoom, joinRoom, playCards as mpPlayCards, pickup as mpPickup, playPrison as mpPlayPrison, undeadSwap as mpUndeadSwap, requestRematch, disconnect, getRoomCode, isConnected, sendChat } from './multiplayer/client.js';
import { initChat, addMessage, destroyChat } from './ui/chat.js';
import { showLobby } from './multiplayer/lobby.js';
import { showAccountModal } from './ui/account.js';
import { recordMatch, isLoggedIn, getProfile } from './multiplayer/auth.js';

const SAVE_KEY = 'skorch_game_state';
let multiplayerMode = false;

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
let isProcessing = false;
let computerTurnTimeout = null;
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
        onPrisonClick,
        onMultiplayer,
        onAccount
    });

}

function onCardSelect(index, cardEl) {
    if (state.currentTurn !== 'player' || state.gameOver) return;

    const newCard = state.player.hand[index];
    if (!newCard) return;

    if (selectedIndexes.has(index)) {
        // Deselect this card
        selectedIndexes.delete(index);
        cardEl.classList.remove('selected');
    } else {
        // Check if this card matches what's already selected
        if (selectedIndexes.size > 0) {
            const firstSelectedIndex = selectedIndexes.values().next().value;
            const firstCard = state.player.hand[firstSelectedIndex];
            const matches = firstCard && (
                (newCard.type === 'attack' && firstCard.type === 'attack' && newCard.value === firstCard.value) ||
                (newCard.type !== 'attack' && firstCard.type !== 'attack' && newCard.type === firstCard.type)
            );
            if (!matches) {
                // Different card type/value - clear all previous selections
                document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
                selectedIndexes.clear();
            }
        }
        selectedIndexes.add(index);
        cardEl.classList.add('selected');
    }

    const playBtn = document.getElementById('playSelectedBtn');
    if (playBtn) {
        playBtn.disabled = selectedIndexes.size === 0;
        playBtn.classList.toggle('active', selectedIndexes.size > 0);
    }
}

async function onPlaySelected() {
    if (state.currentTurn !== 'player' || selectedIndexes.size === 0) return;
    if (isProcessing) return;
    isProcessing = true;

    const indexes = Array.from(selectedIndexes).sort((a, b) => a - b);

    // Multiplayer: send to server instead of local engine
    if (multiplayerMode) {
        const cardsToPlay = indexes.map(i => state.player.hand[i]).filter(Boolean);
        const cardType = cardsToPlay.length > 0 ? cardsToPlay[0].type : null;

        // Trigger announcement for special cards
        if (cardType && cardType !== 'attack') {
            announceSpecial(cardType, 'player', 1200, state);
        }

        const isUndead = cardsToPlay.length === 1 && cardType === 'undead';

        if (isUndead) {
            mpPlayCards(indexes);
            // Then show modal for the swap
            setTimeout(() => {
                showUndeadModal(state,
                    (myCard, theirCard) => {
                        mpUndeadSwap(myCard, theirCard);
                        isProcessing = false;
                    },
                    () => {
                        // Can't skip undead but just in case
                        isProcessing = false;
                    }
                );
            }, 500); // Wait for state update from server
            return;
        }

        mpPlayCards(indexes);
        isProcessing = false;
        return;
    }

    logState('BEFORE PLAYER PLAY');
    const cardsBeingPlayed = indexes.map(i => state.player.hand[i]);
    const cardsPlayed = cardsBeingPlayed.map(c => c.type === 'attack' ? `Attack ${c.value}` : c.name).join(', ');
    // AI Memory: capture discard pile before play (in case of invalid play pickup)
    const pileBeforePlay = state._aiMemory ? state.discardPile.map(c => ({ type: c.type, value: c.value, name: c.name, isSpecial: c.isSpecial })) : [];
    const result = playFromHand(state, 'player', indexes);

    // AI Memory: track what player played
    if (state._aiMemory && result.success) {
        for (const c of cardsBeingPlayed) {
            // Add to play history
            state._aiMemory.opponentPlayHistory.push({ type: c.type, value: c.value, name: c.name });
            // Remove ONE matching card from known cards (if it was known)
            const knownIdx = state._aiMemory.knownOpponentCards.findIndex(k =>
                k.type === c.type && (c.type !== 'attack' || k.value === c.value)
            );
            if (knownIdx !== -1) {
                state._aiMemory.knownOpponentCards.splice(knownIdx, 1);
            } else {
                // Played an unknown card - decrement unknown draws
                if (state._aiMemory.unknownOpponentDraws > 0) state._aiMemory.unknownOpponentDraws--;
            }
        }
    }
    console.log(`>> Player played: ${cardsPlayed} → ${result.message}`);
    state.status = result.message;

    if (result.success && result.effect !== 'pickup') {
        // Sound effects for successful plays
        if (indexes.length > 1) playCardStack(); else playCardSnap();
        if (result.effect === 'skorch') playSkorch();
        else if (result.effect === 'shield') playShield();
        else if (result.effect === 'demoter') playDemoter();
        else if (result.effect === 'elude') playElude();
        else if (result.effect === 'undead') playUndead();

        if (result.effect === 'undead') {
            update();
            showUndeadModal(state,
                (myCard, theirCard) => {
                    console.log('UNDEAD SWAP:', { myCard, theirCard });
                    console.log('BEFORE swap - my prison:', JSON.stringify(state.player.prison));
                    console.log('BEFORE swap - their prison:', JSON.stringify(state.computer.prison));
                    if (myCard) executeUndeadSwap(state, 'player', myCard, theirCard);
                    else executeUndeadTake(state, 'player', theirCard);
                    console.log('AFTER swap - my prison:', JSON.stringify(state.player.prison));
                    console.log('AFTER swap - their prison:', JSON.stringify(state.computer.prison));
                    state.status = 'Undead swap complete!';
                    drawCard(state, 'player');
                    if (state._aiMemory) state._aiMemory.unknownOpponentDraws++;
                    if (checkWin(state, 'player')) { state.gameOver = true; state.winner = 'player'; state.status = 'You win!'; update(); isProcessing = false; return; }
                    nextTurn(state);
                    update();
                    isProcessing = false;
                    computerTurnTimeout = setTimeout(doComputerTurn, 1200);
                },
                () => {
                    state.status = 'Undead - no swap made.';
                    drawCard(state, 'player');
                    if (state._aiMemory) state._aiMemory.unknownOpponentDraws++;
                    if (checkWin(state, 'player')) { state.gameOver = true; state.winner = 'player'; state.status = 'You win!'; update(); isProcessing = false; return; }
                    nextTurn(state);
                    update();
                    isProcessing = false;
                    computerTurnTimeout = setTimeout(doComputerTurn, 1200);
                }
            );
            // isProcessing will be cleared in the modal callbacks
            return;
        }

        drawCard(state, 'player');
        if (state._aiMemory) state._aiMemory.unknownOpponentDraws++;
        if (checkWin(state, 'player')) {
            state.gameOver = true; state.winner = 'player'; state.status = 'You win!';
            playVictory();
            update();
            showGameOver('player', onRestart);
            isProcessing = false;
            return;
        }

        // Announce special cards
        if (['skorch', 'shield', 'demoter', 'elude', 'undead'].includes(result.effect)) {
            console.log(`ANNOUNCING: ${result.effect} by player`);
            update();
            await announceSpecial(result.effect, 'player', 1200, state);
        }

        if (result.effect === 'shield') {
            state.status += ' You go again!';
            update();
            isProcessing = false;
            return;
        }

        nextTurn(state);
        update();
        isProcessing = false;
        computerTurnTimeout = setTimeout(doComputerTurn, 1200);
    } else if (result.effect === 'pickup') {
        playPickup();
        // AI Memory: invalid play caused pickup — player now has all pile cards
        if (state._aiMemory) {
            for (const c of pileBeforePlay) {
                state._aiMemory.knownOpponentCards.push(c);
            }
        }
        nextTurn(state);
        update();
        isProcessing = false;
        computerTurnTimeout = setTimeout(doComputerTurn, 1200);
    } else {
        update();
        isProcessing = false;
    }
}

function onPickup() {
    if (state.currentTurn !== 'player' || state.gameOver) return;
    if (isProcessing) return;
    isProcessing = true;

    if (multiplayerMode) {
        mpPickup();
        isProcessing = false;
        return;
    }

    logState('BEFORE PLAYER PICKUP');
    // AI Memory: player picks up discard pile - we know exactly what they got
    if (state._aiMemory) {
        for (const c of state.discardPile) {
            state._aiMemory.knownOpponentCards.push({ type: c.type, value: c.value, name: c.name, isSpecial: c.isSpecial });
        }
    }
    pickupDiscardPile(state, 'player');
    playPickup();
    drawCard(state, 'player');
    // AI Memory: player drew an unknown card
    if (state._aiMemory) state._aiMemory.unknownOpponentDraws++;
    state.status = 'You picked up the discard pile.';
    nextTurn(state);
    update();
    isProcessing = false;
    computerTurnTimeout = setTimeout(doComputerTurn, 1200);
}

function onPrisonClick(row, index) {
    if (state.currentTurn !== 'player' || state.player.hand.length > 0 || state.gameOver) return;
    if (isProcessing) return;
    isProcessing = true;

    if (multiplayerMode) {
        mpPlayPrison(row, index);
        isProcessing = false;
        return;
    }

    logState('BEFORE PLAYER PRISON PLAY');
    // AI Memory: capture discard pile + prison card before play (in case of pickup)
    const pileBeforePrison = state._aiMemory ? state.discardPile.map(c => ({ type: c.type, value: c.value, name: c.name, isSpecial: c.isSpecial })) : [];
    const prisonCard = state.player.prison[row][index]?.card;
    const prisonCardInfo = prisonCard && state._aiMemory ? { type: prisonCard.type, value: prisonCard.value, name: prisonCard.name, isSpecial: prisonCard.isSpecial } : null;

    const result = playFromPrison(state, 'player', row, index);
    state.status = result.message;

    // AI Memory: track prison play results
    if (state._aiMemory && result.success) {
        if (result.effect === 'pickup') {
            // Player picked up the pile + the prison card — all become known
            for (const c of pileBeforePrison) {
                state._aiMemory.knownOpponentCards.push(c);
            }
            if (prisonCardInfo) {
                state._aiMemory.knownOpponentCards.push(prisonCardInfo);
            }
        } else if (prisonCardInfo) {
            // Successful play — add to play history
            state._aiMemory.opponentPlayHistory.push(prisonCardInfo);
        }
    }

    if (result.success && result.effect !== 'pickup') {
        playCardSnap();
        drawCard(state, 'player');
        if (state._aiMemory) state._aiMemory.unknownOpponentDraws++;
        if (checkWin(state, 'player')) {
            state.gameOver = true; state.winner = 'player'; state.status = 'You win!';
            playVictory();
            update();
            showGameOver('player', onRestart);
            isProcessing = false;
            return;
        }
        // Announce special cards from prison
        if (['skorch', 'shield', 'demoter', 'elude', 'undead'].includes(result.effect)) {
            update();
            announceSpecial(result.effect, 'player', 1200, state).then(() => {
                if (result.effect === 'shield') { state.status += ' You go again!'; update(); isProcessing = false; return; }
                nextTurn(state);
                update();
                isProcessing = false;
                if (state.currentTurn === 'computer' && !state.gameOver) computerTurnTimeout = setTimeout(doComputerTurn, 1200);
            });
            return;
        }
        if (result.effect === 'shield') { state.status += ' You go again!'; update(); isProcessing = false; return; }
        nextTurn(state);
    } else if (result.effect === 'pickup') {
        playPickup(); playError();
        nextTurn(state);
    }
    update();
    isProcessing = false;
    if (state.currentTurn === 'computer' && !state.gameOver) computerTurnTimeout = setTimeout(doComputerTurn, 1200);
}

async function doComputerTurn() {
    isProcessing = false;
    if (state.gameOver) return;
    if (state.currentTurn !== 'computer') return; // Guard: don't play on player's turn
    const result = computerTurn(state);
    state.status = `Computer: ${result.message}`;
    // Brief pause so player can see what happened
    await wait(300);
    const discardList = state.discardPile.map(c => c.type === 'attack' ? `A${c.value}` : c.name.substring(0,3)).join(', ');
    console.log('--- COMPUTER TURN ---');
    console.log('Computer BEFORE:', result.handBefore);
    console.log(result.thoughts);
    console.log('Computer AFTER:', logHand('computer'));
    console.log('Player hand:', logHand('player'));
    console.log(`Discard pile (${state.discardPile.length}): [${discardList}]`);
    console.log(`Deck: ${state.deck.length}`);
    console.log('---------------------');

    if (state.gameOver) {
        playDefeat();
        update();
        showGameOver(state.winner, onRestart);
        return;
    }

    // Announce computer's special cards
    const specialMatch = result.message.match(/Skorch|Shield|Demoter|Elude|Undead/i);
    if (specialMatch) {
        update();
        await announceSpecial(specialMatch[0].toLowerCase(), 'computer', 1200, state);
    }

    // Shield: computer goes again
    if (result.message.includes('Shield') || result.message.includes('shield')) {
        update();
        computerTurnTimeout = setTimeout(doComputerTurn, 1500);
        return;
    }
    update();
}

async function animateDeal() {
    // Animate prison cards appearing (staggered)
    const prisonCards = root.querySelectorAll('.prison-section .sk-card:not(.sk-placeholder)');
    prisonCards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'scale(0.5) translateY(20px)';
        setTimeout(() => {
            card.style.transition = 'opacity 200ms ease-out, transform 200ms ease-out';
            card.style.opacity = '1';
            card.style.transform = 'scale(1) translateY(0)';
        }, 50 + i * 40);
    });

    // Animate hand cards appearing (after prison)
    const handCards = root.querySelectorAll('.hand-section .sk-card');
    const prisonDelay = prisonCards.length * 40 + 100;
    handCards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        setTimeout(() => {
            card.style.transition = 'opacity 250ms ease-out, transform 250ms ease-out';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, prisonDelay + i * 60);
    });
}

function onRestart() {
    if (computerTurnTimeout) clearTimeout(computerTurnTimeout);
    isProcessing = false;
    localStorage.removeItem(SAVE_KEY);
    resetRenderCache();
    state = createGameState();
    update();
    animateDeal();
    if (state.currentTurn === 'computer') computerTurnTimeout = setTimeout(doComputerTurn, 2000);
}

// Account handler
function onAccount() {
    showAccountModal(() => update());
}

// Multiplayer handler
async function onMultiplayer() {
    const lobby = showLobby(() => {
        // Back to single player
        multiplayerMode = false;
        destroyChat();
        disconnect();
    });

    lobby.onCreateClick(async (username) => {
        lobby.showError('Connecting to server...');
        try {
            await connect({
                onStateUpdate: (view) => {
                    // Detect opponent special card plays
                    const oldTopType = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1]?.type : null;
                    const newTop = view.discardPile.length > 0 ? view.discardPile[view.discardPile.length - 1] : null;
                    const newTopType = newTop?.type;
                    const specialTypes = ['skorch', 'demoter', 'elude', 'undead'];
                    if (newTopType && newTopType !== oldTopType && specialTypes.includes(newTopType)) {
                        announceSpecial(newTopType, view.currentTurn === 'player' ? 'computer' : 'player', 1200, state);
                    }
                    // Detect Skorch (pile went from cards to empty)
                    if (state.discardPile.length > 2 && view.discardPile.length === 0) {
                        announceSpecial('skorch', 'computer', 1200, state);
                    }

                    // Update state from server view
                    state.player.hand = view.myHand;
                    state.player.prison = view.myPrison;
                    state.computer.hand = new Array(view.opponentHandCount).fill({ type: 'unknown' });
                    state.computer.prison = view.opponentPrison;
                    state.discardPile = view.discardPile;
                    state.deck = new Array(view.deckCount).fill(null);
                    state.currentTurn = view.currentTurn;
                    state.gameOver = view.gameOver;
                    state.winner = view.winner;
                    state._roomCode = getRoomCode();
                    state._myName = view.myName || 'You';
                    state._opponentName = view.opponentName || 'Opponent';
                    state.status = view.currentTurn === 'player' ? 'Your turn' : "Opponent's turn";
                    if (view.currentTurn === 'player') playTurnDing();
                    update();
                },
                onGameStart: (view) => {
                    lobby.close();
                    multiplayerMode = true;
                    initChat((msg) => sendChat(msg));
                    state = createGameState();
                    state.player.hand = view.myHand;
                    state.player.prison = view.myPrison;
                    state.computer.hand = new Array(view.opponentHandCount).fill({ type: 'unknown' });
                    state.computer.prison = view.opponentPrison;
                    state.discardPile = view.discardPile;
                    state.deck = new Array(view.deckCount).fill(null);
                    state.currentTurn = view.currentTurn;
                    state._roomCode = getRoomCode();
                    state._myName = view.myName || 'You';
                    state._opponentName = view.opponentName || 'Opponent';
                    state.status = 'Game started!';
                    update();
                    animateDeal();
                },
                onGameOver: (data) => {
                    const won = data.winner === 'player';
                    state.gameOver = true;
                    state.winner = data.winner;
                    if (won) playVictory(); else playDefeat();
                    showGameOver(data.winner, () => {
                        requestRematch();
                        state.status = 'Rematch requested...';
                        update();
                    });
                },
                onError: (msg) => lobby.showError(msg),
                onOpponentLeft: () => {
                    state.status = 'Opponent disconnected.';
                    state.gameOver = true;
                    destroyChat();
                    update();
                },
                onRematchRequested: () => {
                    state.status = 'Opponent wants a rematch!';
                    update();
                },
                onChatMessage: (data) => addMessage(data),
                onRoomCreated: (data) => lobby.showWaiting(data.code),
                onRoomJoined: () => {}
            });
            createRoom(username);
        } catch (e) {
            lobby.showError('Could not connect: ' + (e.message || 'Server may be waking up, try again in 30s'));
        }
    });

    lobby.onJoinClick(async (username, code) => {
        lobby.showError('Connecting to server...');
        try {
            await connect({
                onStateUpdate: (view) => {
                    // Detect opponent special card plays
                    const oldTopType2 = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1]?.type : null;
                    const newTop2 = view.discardPile.length > 0 ? view.discardPile[view.discardPile.length - 1] : null;
                    const newTopType2 = newTop2?.type;
                    if (newTopType2 && newTopType2 !== oldTopType2 && ['skorch','demoter','elude','undead'].includes(newTopType2)) {
                        announceSpecial(newTopType2, view.currentTurn === 'player' ? 'computer' : 'player', 1200, state);
                    }
                    if (state.discardPile.length > 2 && view.discardPile.length === 0) {
                        announceSpecial('skorch', 'computer', 1200, state);
                    }

                    state.player.hand = view.myHand;
                    state.player.prison = view.myPrison;
                    state.computer.hand = new Array(view.opponentHandCount).fill({ type: 'unknown' });
                    state.computer.prison = view.opponentPrison;
                    state.discardPile = view.discardPile;
                    state.deck = new Array(view.deckCount).fill(null);
                    state.currentTurn = view.currentTurn;
                    state.gameOver = view.gameOver;
                    state.winner = view.winner;
                    state._roomCode = getRoomCode();
                    state._myName = view.myName || 'You';
                    state._opponentName = view.opponentName || 'Opponent';
                    state.status = view.currentTurn === 'player' ? 'Your turn' : "Opponent's turn";
                    if (view.currentTurn === 'player') playTurnDing();
                    update();
                },
                onGameStart: (view) => {
                    lobby.close();
                    multiplayerMode = true;
                    initChat((msg) => sendChat(msg));
                    state = createGameState();
                    state.player.hand = view.myHand;
                    state.player.prison = view.myPrison;
                    state.computer.hand = new Array(view.opponentHandCount).fill({ type: 'unknown' });
                    state.computer.prison = view.opponentPrison;
                    state.discardPile = view.discardPile;
                    state.deck = new Array(view.deckCount).fill(null);
                    state.currentTurn = view.currentTurn;
                    state._roomCode = getRoomCode();
                    state._myName = view.myName || 'You';
                    state._opponentName = view.opponentName || 'Opponent';
                    state.status = 'Game started!';
                    update();
                    animateDeal();
                },
                onGameOver: (data) => {
                    const won = data.winner === 'computer'; // player2 is 'computer' in state
                    state.gameOver = true;
                    state.winner = data.winner;
                    if (won) playVictory(); else playDefeat();
                    showGameOver(won ? 'player' : 'computer', () => {
                        requestRematch();
                        state.status = 'Rematch requested...';
                        update();
                    });
                },
                onError: (msg) => lobby.showError(msg),
                onOpponentLeft: () => {
                    state.status = 'Opponent disconnected.';
                    state.gameOver = true;
                    destroyChat();
                    update();
                },
                onRematchRequested: () => {
                    state.status = 'Opponent wants a rematch!';
                    update();
                },
                onChatMessage: (data) => addMessage(data),
                onRoomCreated: () => {},
                onRoomJoined: () => lobby.showJoining()
            });
            joinRoom(code, username);
        } catch (e) {
            lobby.showError('Could not connect: ' + (e.message || 'Server may be waking up, try again in 30s'));
        }
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && selectedIndexes.size > 0 && state.currentTurn === 'player' && !state.gameOver) {
        onPlaySelected();
    }
});

// Mobile: flick up anywhere to play selected cards
let flickGlobalY = 0;
document.addEventListener('touchstart', (e) => {
    flickGlobalY = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', (e) => {
    if (selectedIndexes.size === 0) return;
    if (state.currentTurn !== 'player' || state.gameOver) return;
    const dy = flickGlobalY - e.changedTouches[0].clientY;
    if (dy > 50) {
        const playBtn = document.getElementById('playSelectedBtn');
        if (playBtn && !playBtn.disabled) playBtn.click();
    }
}, { passive: true });

// Silently restore session if already logged in
getProfile().catch(() => {});

// Initial render - restore session first, then render
initSound();
getProfile().catch(() => {}).finally(() => {
    update();
    animateDeal();
    if (state.currentTurn === 'computer') computerTurnTimeout = setTimeout(doComputerTurn, 2000);
});
