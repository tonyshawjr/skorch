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

    // Card counting intel
    const cc = countCards(state);
    const burned = (state.burnedCards || []).length;
    thoughts.push(`[Card Count] Unknown: ${cc.total} | Opp hand: ${cc.opponentHand} | Burned: ${burned}`);
    if (effectiveValue > 0) {
        const beatProb = cc.canOpponentBeat(effectiveValue);
        thoughts.push(`[Card Count] P(opp beats ${effectiveValue}): ${(beatProb * 100).toFixed(0)}%`);
    }

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

    // Score every move (with card counting data)
    const counting = countCards(state);
    for (const move of moves) {
        move.score = scoreMove(move, state, counting);
        thoughts.push(`  ${move.description}: ${move.score} pts`);
    }

    // Strategic awareness logging
    if (state._aiMemory?.knownOpponentCards?.length > 0) {
        const known = state._aiMemory.knownOpponentCards;
        const knownStr = known.map(c => c.type === 'attack' ? `A${c.value}` : c.name.substring(0,3)).join(', ');
        thoughts.push(`[Strategy] Known opp cards: ${knownStr}`);
        const highest = Math.max(...known.filter(c => c.type === 'attack').map(c => c.value), 0);
        if (highest > 0) thoughts.push(`[Strategy] Opp highest known: ${highest}`);
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

    // Also generate partial stacks (play N-1 of N matching cards)
    for (const [value, indexes] of Object.entries(groups)) {
        if (indexes.length >= 3) {
            // Play all but one (keep one in reserve)
            moves.push({
                type: 'stack',
                indexes: indexes.slice(0, -1),
                card: hand[indexes[0]],
                description: `${indexes.length - 1}x Attack ${value} (keep 1)`
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

// ─── CARD COUNTING ────────────────────────────────────────────

const FULL_DECK = (() => {
    const d = {};
    for (let i = 1; i <= 10; i++) d[i] = 6;
    d.elude = 4; d.shield = 4; d.demoter = 4; d.skorch = 4; d.undead = 1;
    return d;
})();

function cardKey(card) {
    return card.type === 'attack' ? card.value : card.type;
}

function subtractCards(remaining, cards) {
    for (const card of cards) {
        const key = cardKey(card);
        if (remaining[key] > 0) remaining[key]--;
    }
}

function countCards(state) {
    // Start with full deck
    const remaining = { ...FULL_DECK };

    // Subtract: computer's own hand (known)
    subtractCards(remaining, state.computer.hand);

    // Subtract: face-up prison cards (both players)
    for (const who of ['player', 'computer']) {
        for (const row of ['front', 'back']) {
            for (const slot of state[who].prison[row]) {
                if (slot.card && slot.faceUp) {
                    subtractCards(remaining, [slot.card]);
                }
            }
        }
    }

    // Subtract: discard pile (known)
    subtractCards(remaining, state.discardPile);

    // Subtract: burned cards (removed from game by Skorch)
    subtractCards(remaining, state.burnedCards || []);

    // Total unknown cards = deck + opponent hand + face-down prison cards
    const total = Object.values(remaining).reduce((sum, n) => sum + n, 0);
    const opponentHand = state.player.hand.length;

    // Probability opponent can beat a given attack value
    // Cards that beat value V: attacks V through 10, plus all specials (always playable)
    function canOpponentBeat(value) {
        if (total === 0) return 0;
        let beaters = 0;
        for (let v = value; v <= 10; v++) {
            beaters += remaining[v];
        }
        beaters += remaining.elude + remaining.shield + remaining.demoter + remaining.skorch + remaining.undead;
        // Probability at least one of opponent's cards can beat it
        // P(none beat) = C(non-beaters, handSize) / C(total, handSize)
        // Simplified: 1 - ((total - beaters) / total) ^ handSize
        const nonBeaters = total - beaters;
        if (nonBeaters <= 0) return 1;
        if (opponentHand === 0) return 0;
        return 1 - Math.pow(nonBeaters / total, opponentHand);
    }

    return { remaining, total, opponentHand, canOpponentBeat };
}

// ─── SCORING ENGINE ────────────────────────────────────────────

function scoreMove(move, state, counting) {
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
    if (handSizeAfter === 0) {
        // Check prison readiness
        let faceDownCount = 0;
        for (const row of ['front', 'back']) {
            for (const slot of state.computer.prison[row]) {
                if (slot.card !== null && !slot.faceUp) faceDownCount++;
            }
        }
        score += faceDownCount >= 4 ? 12 : 25;
    }

    // ── 3. Attack card logic ──
    if (card.type === CardType.ATTACK) {
        // Conservation: prefer low, but less dominant
        score += (11 - card.value) * 1.5;

        // Pressure: scales with opponent proximity to winning
        let oppCardsTotal = opponentCards;
        for (const row of ['front', 'back']) {
            for (const slot of state.player.prison[row]) {
                if (slot.card !== null) oppCardsTotal++;
            }
        }
        if (oppCardsTotal <= 3) {
            score += card.value * 2.5;  // Heavy pressure when they're close
        } else if (oppCardsTotal <= 6) {
            score += card.value * 1.5;
        } else {
            score += card.value;
        }

        // Waste penalty: don't play a 10 when a 3 would do
        if (effectiveValue > 0 && card.value - effectiveValue >= 3) {
            score -= (card.value - effectiveValue) * 1.5;
        }

        // Large hand: prioritize dumping cards
        if (hand.length >= 10) {
            score += cardsPlayed * 5;  // Extra bonus per card played
            score += (11 - card.value) * 0.5;  // Even more conservation (dump low first)
        }

        // Endgame: if opponent is close, play high to block them
        if (opponentCards <= 3) {
            score += card.value * 0.5;
        }

        // Card counting: if opponent is unlikely to beat this value, bonus for playing it
        if (counting) {
            const beatProb = counting.canOpponentBeat(card.value);
            if (beatProb < 0.3) {
                // Opponent probably can't beat this — great play
                score += 8;
            } else if (beatProb < 0.5) {
                score += 4;
            }
            // If most high cards are gone, mid-value cards are effectively high
            const highCardsLeft = (counting.remaining[8] || 0) + (counting.remaining[9] || 0) + (counting.remaining[10] || 0);
            if (highCardsLeft <= 3 && card.value >= 5) {
                score += 5; // Mid cards are strong when highs are depleted
            }
        }
    }

    // ── 4. Special card scoring ──
    if (card.isSpecial) {
        score += scoreSpecial(card, move, state, hand, handSizeAfter, effectiveValue, opponentCards, pileSize, counting);
    }

    // ── 5. Strategic scoring based on opponent knowledge ──
    score += scoreStrategic(move, state, counting);

    return Math.round(score);
}

function scoreSpecial(card, move, state, hand, handSizeAfter, effectiveValue, opponentCards, pileSize, counting) {
    let score = 0;

    // Count what else we have
    const attacksInHand = hand.filter(c => c.type === CardType.ATTACK);
    const playableAttacks = attacksInHand.filter(c => c.value >= effectiveValue);
    const hasPlayableAttacks = playableAttacks.length > 0;

    switch (card.type) {
        case CardType.SKORCH: {
            // === SKORCH-UNDEAD STRATEGY ===
            // The Skorch card is the ONLY way to permanently remove the Undead card from the game.
            // If Undead is in the discard pile, Skorching it eliminates a major threat.
            // If Undead has NOT appeared yet, consider saving Skorch as insurance.

            const undeadInPile = state.discardPile.some(c => c.type === CardType.UNDEAD);
            const undeadBurned = (state.burnedCards || []).some(c => c.type === CardType.UNDEAD);
            const undeadInMyHand = hand.some(c => c.type === CardType.UNDEAD);
            const undeadAccountedFor = undeadBurned || undeadInMyHand; // We know where it is

            if (undeadInPile) {
                // CRITICAL: Undead is in the pile - Skorch it NOW to remove from game
                score += 25;
            } else if (!undeadAccountedFor && !hasPlayableAttacks) {
                // Undead is still out there and we can't play attacks - save Skorch if possible
                // But if we have no other options, still play it
                score -= 8;
            }

            // Value scales with pile size — burning a big pile removes lots of cards from game
            if (pileSize >= 8) score += 20;
            else if (pileSize >= 5) score += 12;
            else if (pileSize >= 3) score += 5;
            else if (!undeadInPile) score -= 12; // Don't waste on tiny piles (unless Undead is there)

            // Card counting: bonus if pile contains high-value or special cards worth burning
            if (counting && pileSize > 0) {
                let pileValue = 0;
                for (const c of state.discardPile) {
                    if (c.type === CardType.ATTACK && c.value >= 7) pileValue += 2;
                    if (c.type === CardType.ATTACK && c.value <= 3) pileValue += 1;
                    if (c.isSpecial) pileValue += 3;
                }
                score += pileValue;
            }

            // Don't burn pile if opponent would have to pick it up anyway
            // UNLESS Undead is in the pile (always burn Undead)
            if (!undeadInPile) {
                const knownCards = (state._aiMemory?.knownOpponentCards || []);
                const canOpponentBeat = knownCards.some(c =>
                    (c.type === 'attack' && c.value >= effectiveValue) || c.isSpecial
                );
                if (!canOpponentBeat && knownCards.length > 0 && pileSize >= 3) {
                    score -= 20; // Let them pick up instead of burning
                }
            }

            // Extra value if it empties hand
            if (handSizeAfter === 0) score += 15;
            break;
        }

        case CardType.DEMOTER:
            // Demoter on a 0-value pile does nothing useful
            if (effectiveValue === 0) {
                score -= 15;
                break;
            }
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

            // Card counting: if lots of low cards remain, opponent easily plays after reset — less valuable
            if (counting) {
                const lowRemaining = (counting.remaining[1] || 0) + (counting.remaining[2] || 0) + (counting.remaining[3] || 0);
                if (lowRemaining >= 8) score -= 4; // Opponent has easy follow-ups
                else if (lowRemaining <= 2) score += 4; // Few low cards left, harder for them
            }

            // Large pile + Demoter = gift to opponent (easy play for them)
            if (pileSize >= 6) score -= 5;

            // Empties hand bonus
            if (handSizeAfter === 0) score += 15;
            break;

        case CardType.SHIELD:
            if (handSizeAfter === 0) {
                score += 25;
            } else if (!hasPlayableAttacks) {
                score += 8;
                if (opponentCards <= 2) score += 10;
            } else {
                // Has attacks - Shield is usually worse than just playing them
                score -= 15;
                // BUT: Shield + high attack on big pile = combo play
                if (pileSize >= 6) {
                    const maxAttack = Math.max(...playableAttacks.map(c => c.value));
                    if (maxAttack >= 7) score += maxAttack + pileSize;
                }
            }
            break;

        case CardType.ELUDE:
            if (!hasPlayableAttacks) {
                score += 10;
            } else if (effectiveValue >= 7) {
                // Elude maintains high pressure AND saves our high cards
                score += effectiveValue - 3;
            } else {
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

// ─── STRATEGIC SCORING (OPPONENT AWARENESS) ───────────────────

function scoreStrategic(move, state, counting) {
    const memory = state._aiMemory;
    if (!memory || !move.card) return 0;

    let score = 0;
    const card = move.card;
    const knownCards = memory.knownOpponentCards || [];
    const effectiveValue = getEffectiveValue(state);

    // Only apply to attack cards
    if (card.type !== CardType.ATTACK) return score;

    // --- BLOCK SCORING ---
    // If we know opponent's highest attack, play just above it
    const knownAttacks = knownCards.filter(c => c.type === 'attack');
    const highestKnown = knownAttacks.length > 0
        ? Math.max(...knownAttacks.map(c => c.value))
        : 0;

    if (highestKnown > 0 && card.value > highestKnown) {
        // This card blocks their known highest - great play
        score += 12;
        // Even better if it's just 1 above (efficient block)
        if (card.value === highestKnown + 1) score += 5;
    }

    // --- DUMP PREVENTION ---
    // Don't play below what we know they can beat
    const knownBeatable = knownAttacks.filter(c => c.value >= card.value);
    if (knownBeatable.length > 0) {
        score -= 6 + knownBeatable.length * 2;
    }

    // --- TRAP SCORING ---
    // If opponent can't beat current value with known cards, pile is a trap
    const canBeatWithKnown = knownCards.some(c =>
        (c.type === 'attack' && c.value >= card.value) || c.isSpecial
    );
    if (!canBeatWithKnown && knownCards.length > 0 && memory.unknownOpponentDraws <= 2) {
        // High confidence they can't beat this
        const pileSize = state.discardPile.length;
        score += 8 + (pileSize * 2); // Bigger pile = better trap
    }

    // Also apply probability-based trap with pile size
    if (counting && card.type === CardType.ATTACK) {
        const beatProb = counting.canOpponentBeat(card.value);
        if (beatProb < 0.4 && state.discardPile.length >= 4) {
            score += Math.round((1 - beatProb) * state.discardPile.length);
        }
    }

    // --- ENDGAME PRESSURE ---
    const opponentTotal = state.player.hand.length;
    // Count remaining prison cards
    let opponentPrisonCards = 0;
    for (const row of ['front', 'back']) {
        for (const slot of state.player.prison[row]) {
            if (slot.card !== null) opponentPrisonCards++;
        }
    }
    const totalToWin = opponentTotal + opponentPrisonCards;

    if (totalToWin <= 3) {
        // Opponent is close to winning - play high to block
        score += card.value * 2;
    }

    return Math.round(score);
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
    // Score each opponent card to decide what to take
    // Face-down cards are valuable targets: deny opponent info + could be anything
    let bestTake = null;
    let bestTakeScore = -999;
    for (const u of theirUnlocked) {
        let score = 0;
        if (!u.faceUp) {
            // Face-down = mystery card. Worth taking to deny opponent + gamble on value
            score = 7; // Mid-high priority - better than taking a known low card
        } else if (u.card.isSpecial) {
            score = 10; // Specials are always valuable to steal
        } else if (u.card.type === CardType.ATTACK) {
            score = u.card.value; // Higher attack = more valuable
        }
        if (score > bestTakeScore) {
            bestTakeScore = score;
            bestTake = u;
        }
    }

    // Find worst card to give (lowest attack, or face-down if we have one)
    let worstGive = null;
    let worstGiveScore = 999;
    for (const u of myUnlocked) {
        let score;
        if (!u.faceUp) {
            score = 5; // Mystery - might be giving away something good, risky
        } else if (u.card.type === CardType.ATTACK) {
            score = u.card.value; // Lower = better to give away
        } else {
            score = 11; // Don't give away specials
        }
        if (score < worstGiveScore) {
            worstGiveScore = score;
            worstGive = u;
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

    // Face-up cards: score each one like hand plays
    const faceUpPlayable = accessible.filter(a => a.faceUp && isValidPlay(a.card, state));
    if (faceUpPlayable.length > 0) {
        const effectiveValue = getEffectiveValue(state);
        const pileSize = state.discardPile.length;
        const opponentCards = state.player.hand.length;
        const counting = countCards(state);

        // Score each prison card
        for (const a of faceUpPlayable) {
            const card = a.card;
            let score = 0;
            if (card.type === CardType.ATTACK) {
                // Play lowest valid attack (conservation)
                score += (11 - card.value) * 2;
                // Pressure
                score += card.value;
                // Don't overkill
                if (effectiveValue > 0 && card.value - effectiveValue >= 5) {
                    score -= (card.value - effectiveValue) * 2;
                }
            } else {
                // Specials from prison: only play if attacks can't handle it
                const hasAttacks = faceUpPlayable.some(p => p.card.type === CardType.ATTACK);
                if (hasAttacks) {
                    score -= 10; // Save specials, play attacks first
                } else {
                    score += 5;
                }
                // Skorch from prison is great if pile is big
                if (card.type === CardType.SKORCH && pileSize >= 5) score += 15;
                // Shield from prison - only if can't play attacks
                if (card.type === CardType.SHIELD && hasAttacks) score -= 20;
            }
            // Add strategic scoring (same as hand plays)
            score += scoreStrategic({ card: a.card, type: 'single', indexes: [] }, state, counting);
            a.score = score;
            thoughts.push(`  Prison ${card.name} (${a.row}[${a.index}]): ${score} pts`);
        }

        faceUpPlayable.sort((a, b) => b.score - a.score);
        const pick = faceUpPlayable[0];
        thoughts.push(`→ Best prison: ${pick.card.name} (${pick.score} pts)`);
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
