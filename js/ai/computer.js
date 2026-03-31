import { CardType } from '../engine/cards.js';
import { isValidPlay, getEffectiveValue, playFromHand, playFromPrison, pickupDiscardPile, drawCard, nextTurn, checkWin, getPlayableHandCards, executeUndeadSwap } from '../engine/game.js';
import { isPrisonCardAccessible, getUnlockedCards } from '../engine/prison.js';

// ─── MAIN ENTRY ────────────────────────────────────────────────

export function computerTurn(state) {
    const thoughts = [];
    const hand = state.computer.hand;
    const handBefore = hand.map(c => c.type === 'attack' ? `Attack ${c.value}` : c.name).join(', ') || '(empty)';
    const effectiveValue = getEffectiveValue(state);
    thoughts.push(`Value to beat: ${effectiveValue}`);
    thoughts.push(`Hand: ${hand.length} cards | Deck: ${state.deck.length} | Pile: ${state.discardPile.length}`);

    // Prison phase
    if (hand.length === 0) return computerPlayPrison(state, thoughts);

    // Generate every possible move
    const moves = generateMoves(state);

    if (moves.length === 0) {
        // Truly nothing (empty pile, no cards playable — shouldn't happen, but safety net)
        thoughts.push('No moves generated. Picking up.');
        const result = pickupDiscardPile(state, 'computer');
        drawCard(state, 'computer');
        nextTurn(state);
        return { message: result.message, thoughts: thoughts.join('\n'), handBefore };
    }

    // Score every move
    for (const move of moves) {
        move.score = scoreMove(move, state);
        thoughts.push(`  ${move.description}: ${move.score} pts`);
    }

    // Sort descending by score
    moves.sort((a, b) => b.score - a.score);
    const best = moves[0];
    thoughts.push(`→ Best: ${best.description} (${best.score} pts)`);

    // Execute best move
    if (best.type === 'pickup') {
        const result = pickupDiscardPile(state, 'computer');
        drawCard(state, 'computer');
        nextTurn(state);
        return { message: result.message, thoughts: thoughts.join('\n'), handBefore };
    }

    // Play the cards (single or stack)
    const result = playFromHand(state, 'computer', best.indexes);
    handlePostPlay(state, result, thoughts);
    return { message: result.message, thoughts: thoughts.join('\n'), handBefore };
}

// ─── MOVE GENERATION ───────────────────────────────────────────

function generateMoves(state) {
    const moves = [];
    const hand = state.computer.hand;

    // Single-card plays
    for (let i = 0; i < hand.length; i++) {
        const card = hand[i];
        if (isValidPlay(card, state)) {
            // Avoid duplicate singles for identical attack cards (we'll handle stacks below)
            const isDuplicateAttack = card.type === CardType.ATTACK &&
                moves.some(m => m.type === 'single' && m.card.type === CardType.ATTACK && m.card.value === card.value);
            if (!isDuplicateAttack) {
                moves.push({
                    type: 'single',
                    indexes: [i],
                    card,
                    description: card.type === CardType.ATTACK ? `Attack ${card.value}` : card.name
                });
            }
        }
    }

    // Stack plays (2+ same-value attack cards)
    const groups = {};
    for (let i = 0; i < hand.length; i++) {
        const card = hand[i];
        if (card.type === CardType.ATTACK && isValidPlay(card, state)) {
            const v = card.value;
            if (!groups[v]) groups[v] = [];
            groups[v].push(i);
        }
    }
    for (const [value, indexes] of Object.entries(groups)) {
        if (indexes.length >= 2) {
            moves.push({
                type: 'stack',
                indexes: [...indexes],
                card: hand[indexes[0]],
                description: `${indexes.length}x Attack ${value}`
            });
        }
    }

    // Pickup is always an option when there's a discard pile
    if (state.discardPile.length > 0) {
        moves.push({
            type: 'pickup',
            indexes: [],
            card: null,
            description: `Pickup ${state.discardPile.length} cards`
        });
    }

    return moves;
}

// ─── SCORING ENGINE ────────────────────────────────────────────

function scoreMove(move, state) {
    // Pickup: heavily penalized, proportional to pile size
    if (move.type === 'pickup') {
        return -10 - state.discardPile.length * 3;
    }

    let score = 0;
    const card = move.card;
    const hand = state.computer.hand;
    const cardsPlayed = move.indexes.length;
    const handSizeAfter = hand.length - cardsPlayed;
    const effectiveValue = getEffectiveValue(state);
    const opponentCards = state.player.hand.length;
    const pileSize = state.discardPile.length;

    // ── 1. Cards played bonus (dump more = better) ──
    score += cardsPlayed * 8;

    // ── 2. Hand emptying bonus (reaching prison is huge) ──
    if (handSizeAfter === 0) score += 25;

    // ── 3. Attack card logic ──
    if (card.type === CardType.ATTACK) {
        // Conservation: prefer playing LOW cards, save HIGH for later
        score += (11 - card.value) * 2;

        // Pressure: higher values are harder for opponent to beat
        score += card.value;

        // Waste penalty: don't play a 10 when a 3 would do
        if (effectiveValue > 0 && card.value - effectiveValue >= 5) {
            score -= (card.value - effectiveValue) * 1.5;
        }

        // Endgame: if opponent is close, play high to block them
        if (opponentCards <= 3) {
            score += card.value * 0.5;
        }
    }

    // ── 4. Special card scoring ──
    if (card.isSpecial) {
        score += scoreSpecial(card, move, state, hand, handSizeAfter, effectiveValue, opponentCards, pileSize);
    }

    return Math.round(score);
}

function scoreSpecial(card, move, state, hand, handSizeAfter, effectiveValue, opponentCards, pileSize) {
    let score = 0;

    // Count what else we have
    const attacksInHand = hand.filter(c => c.type === CardType.ATTACK);
    const playableAttacks = attacksInHand.filter(c => c.value >= effectiveValue);
    const hasPlayableAttacks = playableAttacks.length > 0;

    switch (card.type) {
        case CardType.SKORCH:
            // Value scales with pile size — burning a big pile removes lots of cards from game
            if (pileSize >= 8) score += 20;
            else if (pileSize >= 5) score += 12;
            else if (pileSize >= 3) score += 5;
            else score -= 12; // Don't waste on tiny piles
            // Extra value if it empties hand
            if (handSizeAfter === 0) score += 15;
            break;

        case CardType.DEMOTER:
            // Resets value to 0 — great when we can't play attacks
            if (!hasPlayableAttacks) {
                score += 18;
                // Even better if we have low cards to follow (after opponent plays)
                const lowCards = attacksInHand.filter(c => c.value <= 4);
                if (lowCards.length > 0) score += 5;
            } else {
                // We have attacks that work — save demoter for later
                score -= 8;
            }
            // Empties hand bonus
            if (handSizeAfter === 0) score += 15;
            break;

        case CardType.SHIELD:
            // Shield skips opponent's turn, value stays the same, we go again.
            // KEY INSIGHT: Shield doesn't change the value. If we have attacks that beat it,
            // we should play attacks instead of wasting a Shield. Shield is a defensive card
            // for when we CAN'T beat the value, not an offensive play.
            if (handSizeAfter === 0) {
                // Empties hand to reach prison — always great
                score += 25;
            } else if (!hasPlayableAttacks) {
                // Can't beat the value - Shield buys another turn (maybe draw helps)
                score += 8;
                if (opponentCards <= 2) score += 10;
            } else {
                // We HAVE attacks that work. Don't waste Shield - save it.
                // Shield should almost never beat a playable attack card.
                score -= 15;
            }
            break;

        case CardType.ELUDE:
            // Mirrors current value, doesn't help change the situation
            if (!hasPlayableAttacks) {
                // Can't beat the value with attacks — elude buys time
                score += 10;
            } else {
                // Attacks work fine — save elude
                score -= 6;
            }
            if (handSizeAfter === 0) score += 15;
            break;

        case CardType.UNDEAD: {
            // Swap unlocked prison cards — value depends on what's available
            const theirUnlocked = getUnlockedCards(state.player.prison);
            const myUnlocked = getUnlockedCards(state.computer.prison);
            if (theirUnlocked.length === 0) {
                // Nothing to take — low value
                score -= 5;
            } else {
                const theirBest = theirUnlocked.reduce((best, u) => {
                    if (u.card.type === CardType.ATTACK) {
                        return (!best || (best.card.type === CardType.ATTACK && u.card.value > best.card.value)) ? u : best;
                    }
                    return u.card.isSpecial && (!best || !best.card.isSpecial) ? u : best;
                }, null);
                if (theirBest && theirBest.card.type === CardType.ATTACK && theirBest.card.value >= 7) {
                    score += 12;
                } else if (theirBest && theirBest.card.isSpecial) {
                    score += 10;
                } else {
                    score += 4;
                }
                // Bonus if we have low-value cards to give away
                const myWorst = myUnlocked.find(u => u.card.type === CardType.ATTACK && u.card.value <= 3);
                if (myWorst) score += 3;
            }
            if (handSizeAfter === 0) score += 15;
            break;
        }
    }

    return score;
}

// ─── POST-PLAY HANDLING ────────────────────────────────────────

function handlePostPlay(state, result, thoughts) {
    if (result.effect === 'shield') {
        thoughts.push('Shield played - taking another turn.');
        drawCard(state, 'computer');
        return;
    }
    if (result.effect === 'undead') {
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

// ─── UNDEAD SWAP LOGIC ─────────────────────────────────────────

function handleComputerUndead(state, thoughts) {
    const myUnlocked = getUnlockedCards(state.computer.prison);
    const theirUnlocked = getUnlockedCards(state.player.prison);
    if (theirUnlocked.length === 0) {
        thoughts.push('Undead: no opponent cards to take.');
        return;
    }
    // Find best card to take (highest attack or any special)
    let bestTake = null;
    for (const u of theirUnlocked) {
        if (!bestTake) { bestTake = u; continue; }
        if (u.card.type === CardType.ATTACK && bestTake.card.type === CardType.ATTACK) {
            if (u.card.value > bestTake.card.value) bestTake = u;
        } else if (u.card.isSpecial && !bestTake.card.isSpecial) {
            bestTake = u;
        }
    }
    // Find worst card to give (lowest attack)
    let worstGive = null;
    for (const u of myUnlocked) {
        if (u.card.type === CardType.ATTACK) {
            if (!worstGive || u.card.value < worstGive.card.value) worstGive = u;
        }
    }
    if (bestTake && worstGive) {
        executeUndeadSwap(state, 'computer', { row: worstGive.row, index: worstGive.index }, { row: bestTake.row, index: bestTake.index });
        const swapMsg = `Gave ${worstGive.card.name} → Took your ${bestTake.card.name}`;
        thoughts.push(`Undead: ${swapMsg}`);
        state._lastUndeadSwap = { gave: worstGive.card.name, took: bestTake.card.name, swapMsg };
    } else if (bestTake && myUnlocked.length === 0) {
        const card = state.player.prison[bestTake.row][bestTake.index].card;
        state.player.prison[bestTake.row][bestTake.index].card = null;
        state.computer.hand.push(card);
        const swapMsg = `Took your ${bestTake.card.name}`;
        thoughts.push(`Undead: ${swapMsg}`);
        state._lastUndeadSwap = { gave: null, took: bestTake.card.name, swapMsg };
    } else {
        thoughts.push('Undead: no beneficial swap found.');
        state._lastUndeadSwap = null;
    }
}

// ─── PRISON PLAYS ──────────────────────────────────────────────

function computerPlayPrison(state, thoughts) {
    thoughts.push('Hand empty - playing from prison.');
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
        thoughts.push('No accessible prison cards.');
        pickupDiscardPile(state, 'computer');
        drawCard(state, 'computer');
        nextTurn(state);
        return { message: 'Computer picked up the pile.', thoughts: thoughts.join('\n'), handBefore: '(prison)' };
    }

    // Face-up cards: pick the best playable one
    const faceUpPlayable = accessible.filter(a => a.faceUp && isValidPlay(a.card, state));
    if (faceUpPlayable.length > 0) {
        const sorted = faceUpPlayable.sort((a, b) => {
            // Prefer specials first, then highest attack
            if (a.card.isSpecial && !b.card.isSpecial) return -1;
            if (!a.card.isSpecial && b.card.isSpecial) return 1;
            return (b.card.value || 0) - (a.card.value || 0);
        });
        const pick = sorted[0];
        thoughts.push(`Playing prison card: ${pick.card.name} (${pick.row}[${pick.index}])`);
        const result = playFromPrison(state, 'computer', pick.row, pick.index);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n'), handBefore: '(prison - face up)' };
    }

    // Face-down cards: blind flip (no choice, just pick one)
    const faceDown = accessible.filter(a => !a.faceUp);
    if (faceDown.length > 0) {
        const pick = faceDown[0];
        thoughts.push(`Playing face-down prison card (risky): ${pick.row}[${pick.index}]`);
        const result = playFromPrison(state, 'computer', pick.row, pick.index);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n'), handBefore: '(prison - face down)' };
    }

    // Fallback
    thoughts.push('No prison plays possible. Picking up.');
    pickupDiscardPile(state, 'computer');
    drawCard(state, 'computer');
    nextTurn(state);
    return { message: 'Computer picked up the pile.', thoughts: thoughts.join('\n'), handBefore: '(prison)' };
}
