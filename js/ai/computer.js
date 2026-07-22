import { CardType, createCard } from '../engine/cards.js';
import { isValidPlay, getEffectiveValue, playFromHand, playFromPrison, pickupDiscardPile, drawCard, nextTurn, checkWin, getPlayableHandCards, executeUndeadSwap } from '../engine/game.js';
import { isPrisonCardAccessible, getUnlockedCards } from '../engine/prison.js';

function getCapabilities(difficulty) {
    switch (difficulty) {
        case 'easy':
            return { counting: false, memory: false, lookahead: false, blunderChance: 0.45, specialDepth: 'shallow', search: false };
        case 'hard':
            return { counting: true, memory: true, lookahead: true, blunderChance: 0, specialDepth: 'full', search: false };
        case 'insane':
            return { counting: true, memory: true, lookahead: false, blunderChance: 0, specialDepth: 'full', search: true };
        case 'medium':
        default:
            return { counting: true, memory: false, lookahead: false, blunderChance: 0.12, specialDepth: 'full', search: false };
    }
}

function clonePrison(prison) {
    const out = { front: [], back: [] };
    for (const row of ['front', 'back']) {
        for (const slot of prison[row]) {
            out[row].push({ card: slot.card ? { ...slot.card } : null, faceUp: slot.faceUp });
        }
    }
    return out;
}

function cloneState(state) {
    return {
        deck: state.deck.map(c => ({ ...c })),
        discardPile: state.discardPile.map(c => ({ ...c })),
        burnedCards: (state.burnedCards || []).map(c => ({ ...c })),
        player: { hand: state.player.hand.map(c => ({ ...c })), prison: clonePrison(state.player.prison) },
        computer: { hand: state.computer.hand.map(c => ({ ...c })), prison: clonePrison(state.computer.prison) },
        currentTurn: state.currentTurn,
        turnCount: state.turnCount,
        gameOver: state.gameOver,
        winner: state.winner
    };
}

function lookaheadAdjust(move, state) {
    const clone = cloneState(state);
    const result = playFromHand(clone, 'computer', move.indexes);
    if (!result.success || result.effect === 'pickup') return 0;
    if (checkWin(clone, 'computer')) return 14;
    drawCard(clone, 'computer');
    nextTurn(clone);
    const valueLeft = getEffectiveValue(clone);
    const counting = countCards(clone);
    const beatProb = counting.canOpponentBeat(valueLeft > 0 ? valueLeft : 1);
    return Math.round((0.5 - beatProb) * 10);
}

function prisonCount(prison) {
    let n = 0;
    for (const row of ['front', 'back']) {
        for (const slot of prison[row]) if (slot.card) n++;
    }
    return n;
}

function evaluatePosition(state) {
    const myBurden = state.computer.hand.length + prisonCount(state.computer.prison);
    const oppBurden = state.player.hand.length + prisonCount(state.player.prison);
    if (myBurden === 0) return 1000;
    if (oppBurden === 0) return -1000;
    let score = (oppBurden - myBurden) * 10;
    const hand = state.computer.hand;
    const attacks = hand.filter(c => c.type === CardType.ATTACK);
    const lows = attacks.filter(c => c.value <= 3).length;
    const highs = attacks.filter(c => c.value >= 8).length;
    const specials = hand.filter(c => c.isSpecial).length;
    score += specials * 3;
    score += lows * 1.5;
    if (attacks.length >= 3 && lows > 0 && highs > 0) score += 4;
    if (attacks.length >= 3 && lows === 0) score -= 4;
    return score;
}

function sampleOpponentHand(state, counting) {
    const known = (state._aiMemory && state._aiMemory.knownOpponentCards ? state._aiMemory.knownOpponentCards : [])
        .slice(0, state.player.hand.length)
        .map(c => c.type === CardType.ATTACK ? createCard(CardType.ATTACK, c.value) : createCard(c.type, null));
    const need = state.player.hand.length - known.length;
    if (need <= 0) return known;
    const pool = [];
    const rem = { ...counting.remaining };
    for (const c of known) {
        const key = c.type === CardType.ATTACK ? c.value : c.type;
        if (rem[key] > 0) rem[key]--;
    }
    for (const [k, n] of Object.entries(rem)) {
        const isSpecial = ['elude', 'shield', 'demoter', 'skorch', 'undead'].includes(k);
        for (let i = 0; i < n; i++) {
            pool.push(isSpecial ? createCard(k, null) : createCard(CardType.ATTACK, parseInt(k, 10)));
        }
    }
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return known.concat(pool.slice(0, need));
}

function applyOpponentTurn(clone) {
    const hand = clone.player.hand;
    if (hand.length > 0) {
        let best = -1, bestV = 999;
        for (let i = 0; i < hand.length; i++) {
            if (isValidPlay(hand[i], clone)) {
                const v = hand[i].type === CardType.ATTACK ? hand[i].value : 40;
                if (v < bestV) { bestV = v; best = i; }
            }
        }
        if (best === -1) {
            clone.player.hand = clone.player.hand.concat(clone.discardPile);
            clone.discardPile = [];
            drawCard(clone, 'player');
            nextTurn(clone);
            return;
        }
        const r = playFromHand(clone, 'player', [best]);
        if (r.effect !== 'pickup' && r.effect !== 'shield') drawCard(clone, 'player');
        if (r.effect !== 'shield') nextTurn(clone);
        return;
    }
    let played = false;
    for (const row of ['front', 'back']) {
        for (let i = 0; i < clone.player.prison[row].length && !played; i++) {
            if (isPrisonCardAccessible(clone.player.prison, row, i)) {
                const slot = clone.player.prison[row][i];
                if (slot.faceUp && !isValidPlay(slot.card, clone)) continue;
                playFromPrison(clone, 'player', row, i);
                played = true;
            }
        }
        if (played) break;
    }
    if (!played) { pickupDiscardPile(clone, 'player'); }
    drawCard(clone, 'player');
    nextTurn(clone);
}

const SEARCH_CAPS = { counting: true, memory: true, lookahead: false, blunderChance: 0, specialDepth: 'full', search: false };

function positionValue(state) {
    const burden = evaluatePosition(state);
    if (Math.abs(burden) >= 1000) return burden;
    let greedy = 0;
    if (state.computer.hand.length > 0 && !state.gameOver) {
        const moves = generateMoves(state);
        if (moves.length > 0) {
            const counting = countCards(state);
            let bestGreedy = -Infinity;
            for (const m of moves) {
                if (m.type === 'pickup') continue;
                const s = scoreMove(m, state, counting, SEARCH_CAPS);
                if (s > bestGreedy) bestGreedy = s;
            }
            if (bestGreedy > -Infinity) greedy = bestGreedy;
        }
    }
    return greedy + burden * 0.6;
}

function searchScoreMove(move, state, counting, samples) {
    let total = 0;
    for (let s = 0; s < samples; s++) {
        const clone = cloneState(state);
        clone._aiMemory = state._aiMemory;
        clone.player.hand = sampleOpponentHand(state, counting);
        if (move.type === 'pickup') {
            pickupDiscardPile(clone, 'computer');
            drawCard(clone, 'computer');
            nextTurn(clone);
            applyOpponentTurn(clone);
            total += positionValue(clone);
            continue;
        }
        const r = playFromHand(clone, 'computer', move.indexes);
        if (!r.success) { total += positionValue(clone); continue; }
        if (checkWin(clone, 'computer')) { total += 1000; continue; }
        if (r.effect !== 'pickup' && r.effect !== 'shield') drawCard(clone, 'computer');
        if (r.effect === 'shield') {
            total += positionValue(clone) + 6;
            continue;
        }
        nextTurn(clone);
        if (clone.currentTurn === 'player' && !clone.gameOver) applyOpponentTurn(clone);
        total += positionValue(clone);
    }
    return total / samples;
}

function searchSelectMove(state, moves, counting, thoughts) {
    const SAMPLES = 12;
    let best = null, bestScore = -Infinity;
    for (const move of moves) {
        const sc = searchScoreMove(move, state, counting, SAMPLES);
        move.score = Math.round(sc * 10) / 10;
        thoughts.push(`  ${move.description}: eval ${move.score}`);
        if (sc > bestScore) { bestScore = sc; best = move; }
    }
    thoughts.push(`→ Search best: ${best.description} (eval ${Math.round(bestScore * 10) / 10})`);
    return best;
}

function sampleOneUnknown(counting) {
    const pool = [];
    for (const [k, n] of Object.entries(counting.remaining)) {
        const isSpecial = ['elude', 'shield', 'demoter', 'skorch', 'undead'].includes(k);
        for (let i = 0; i < n; i++) {
            pool.push(isSpecial ? createCard(k, null) : createCard(CardType.ATTACK, parseInt(k, 10)));
        }
    }
    if (pool.length === 0) return createCard(CardType.ATTACK, 5);
    return pool[Math.floor(Math.random() * pool.length)];
}

function searchScorePrison(slot, state, counting, samples) {
    let total = 0;
    for (let s = 0; s < samples; s++) {
        const clone = cloneState(state);
        clone._aiMemory = state._aiMemory;
        clone.player.hand = sampleOpponentHand(state, counting);
        if (!slot.faceUp) {
            clone.computer.prison[slot.row][slot.index].card = sampleOneUnknown(counting);
        }
        const r = playFromPrison(clone, 'computer', slot.row, slot.index);
        if (!r.success) { total += positionValue(clone); continue; }
        if (checkWin(clone, 'computer')) { total += 1000; continue; }
        if (r.effect !== 'pickup' && r.effect !== 'shield') drawCard(clone, 'computer');
        if (r.effect === 'shield') { total += positionValue(clone) + 6; continue; }
        nextTurn(clone);
        if (clone.currentTurn === 'player' && !clone.gameOver) applyOpponentTurn(clone);
        total += positionValue(clone);
    }
    return total / samples;
}

const LEARNED_WEIGHTS = [0.419, 1.534, 0.601, -0.191, -0.041, 0.583, 0.467, 0.106, 0.073, 0.014, -0.296, 0.21, 0.242];

function linFeatures(state) {
    const c = state.computer, p = state.player;
    const cA = c.hand.filter(x => x.type === CardType.ATTACK);
    const lows = cA.filter(x => x.value <= 3).length;
    const mids = cA.filter(x => x.value >= 4 && x.value <= 7).length;
    const highs = cA.filter(x => x.value >= 8).length;
    const specials = c.hand.filter(x => x.isSpecial).length;
    const myB = c.hand.length + prisonCount(c.prison);
    const oppB = p.hand.length + prisonCount(p.prison);
    const pile = state.discardPile.length;
    const val = getEffectiveValue(state);
    const deck = state.deck.length;
    return [
        1,
        (oppB - myB) / 10,
        -myB / 10,
        lows / 5, mids / 5, highs / 5,
        specials / 4,
        -pile / 10,
        -val / 10,
        deck / 40,
        oppB <= 3 ? 1 : 0,
        myB <= 3 ? 1 : 0,
        c.hand.length / 15,
    ];
}

function linEval(state) {
    if (state.gameOver) return state.winner === 'computer' ? 100 : -100;
    const mB = state.computer.hand.length + prisonCount(state.computer.prison);
    const oB = state.player.hand.length + prisonCount(state.player.prison);
    if (mB === 0) return 100;
    if (oB === 0) return -100;
    const f = linFeatures(state);
    let s = 0;
    for (let i = 0; i < f.length; i++) s += f[i] * LEARNED_WEIGHTS[i];
    return s;
}

function genMovesFor(state, who) {
    const moves = [];
    const hand = state[who].hand;
    if (hand.length > 0) {
        const groups = {};
        for (let i = 0; i < hand.length; i++) {
            const c = hand[i];
            if (!isValidPlay(c, state)) continue;
            if (c.type === CardType.ATTACK) (groups[c.value] = groups[c.value] || []).push(i);
            else moves.push({ kind: 'play', indexes: [i], card: c });
        }
        for (const v in groups) {
            const idx = groups[v];
            moves.push({ kind: 'play', indexes: [idx[0]], card: hand[idx[0]] });
            if (idx.length >= 2) moves.push({ kind: 'play', indexes: [...idx], card: hand[idx[0]] });
        }
        if (state.discardPile.length > 0) moves.push({ kind: 'pickup' });
        return moves;
    }
    for (const row of ['front', 'back']) {
        for (let i = 0; i < state[who].prison[row].length; i++) {
            if (isPrisonCardAccessible(state[who].prison, row, i)) {
                const slot = state[who].prison[row][i];
                if (slot.faceUp) { if (isValidPlay(slot.card, state)) moves.push({ kind: 'prison', row, index: i, card: slot.card }); }
                else moves.push({ kind: 'prison', row, index: i, faceDown: true });
            }
        }
    }
    if (state.discardPile.length > 0 || moves.length === 0) moves.push({ kind: 'pickup' });
    return moves;
}

function applyMoveSim(state, who, m) {
    if (m.kind === 'pickup') { pickupDiscardPile(state, who); drawCard(state, who); nextTurn(state); return; }
    const r = m.kind === 'prison' ? playFromPrison(state, who, m.row, m.index) : playFromHand(state, who, m.indexes);
    if (!r.success) { nextTurn(state); return; }
    if (r.effect === 'pickup') { drawCard(state, who); nextTurn(state); return; }
    if (r.effect !== 'shield') drawCard(state, who);
    if (checkWin(state, who)) { state.gameOver = true; state.winner = who; return; }
    if (r.effect !== 'shield') nextTurn(state);
}

function oppGreedySim(state) {
    const h = state.player.hand;
    if (h.length) {
        let b = -1, bv = 999;
        for (let i = 0; i < h.length; i++) if (isValidPlay(h[i], state)) { const v = h[i].type === CardType.ATTACK ? h[i].value : 40; if (v < bv) { bv = v; b = i; } }
        if (b < 0) applyMoveSim(state, 'player', { kind: 'pickup' });
        else applyMoveSim(state, 'player', { kind: 'play', indexes: [b] });
        return;
    }
    const ms = genMovesFor(state, 'player');
    applyMoveSim(state, 'player', ms[0]);
}

function sampleOppLearned(state, counting) {
    const pool = [];
    for (const [k, n] of Object.entries(counting.remaining)) {
        const sp = ['elude', 'shield', 'demoter', 'skorch', 'undead'].includes(k);
        for (let i = 0; i < n; i++) pool.push(sp ? createCard(k, null) : createCard(CardType.ATTACK, parseInt(k, 10)));
    }
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, state.player.hand.length);
}

function learnedScoreMove(move, state, counting, samples) {
    let total = 0;
    for (let s = 0; s < samples; s++) {
        const clone = cloneState(state);
        clone.player.hand = sampleOppLearned(state, counting);
        applyMoveSim(clone, 'computer', move);
        if (!clone.gameOver && clone.currentTurn === 'player') oppGreedySim(clone);
        total += linEval(clone);
    }
    return total / samples;
}

function describeLearned(m) {
    if (m.kind === 'pickup') return 'Pickup';
    if (m.kind === 'prison') return m.faceDown ? '(prison face-down)' : `Prison ${m.card.name}`;
    const c = m.card;
    const name = c.type === CardType.ATTACK ? `Attack ${c.value}` : c.name;
    return m.indexes.length > 1 ? `${m.indexes.length}x ${name}` : name;
}

function learnedTurn(state, thoughts, handBefore) {
    const counting = countCards(state);
    const moves = genMovesFor(state, 'computer');
    let best = moves[0], bestV = -Infinity;
    for (const m of moves) {
        m._v = learnedScoreMove(m, state, counting, 4);
        if (m._v > bestV) { bestV = m._v; best = m; }
    }
    for (const m of moves) thoughts.push(`  ${describeLearned(m)}: ${m._v.toFixed(1)}`);
    thoughts.push(`→ Learned: ${describeLearned(best)} (${bestV.toFixed(1)})`);
    if (best.kind === 'pickup') {
        const result = pickupDiscardPile(state, 'computer');
        drawCard(state, 'computer');
        nextTurn(state);
        return { message: result.message, thoughts: thoughts.join('\n'), handBefore };
    }
    const result = best.kind === 'prison'
        ? playFromPrison(state, 'computer', best.row, best.index)
        : playFromHand(state, 'computer', best.indexes);
    handlePostPlay(state, result, thoughts);
    return { message: result.message, thoughts: thoughts.join('\n'), handBefore };
}

export function computerTurn(state) {
    const thoughts = [];
    const caps = getCapabilities(state.difficulty || 'medium');
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

    if (caps.search) return learnedTurn(state, thoughts, handBefore);

    // Prison phase
    if (hand.length === 0) return computerPlayPrison(state, thoughts, caps);

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

    const scoreCounting = caps.counting ? counting : null;
    for (const move of moves) {
        move.score = scoreMove(move, state, scoreCounting, caps);
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

    if (caps.lookahead) {
        const topN = moves.filter(m => m.type !== 'pickup').slice(0, 3);
        for (const m of topN) {
            const adj = lookaheadAdjust(m, state);
            m.score += adj;
            thoughts.push(`  [Lookahead] ${m.description}: ${adj >= 0 ? '+' : ''}${adj}`);
        }
        moves.sort((a, b) => b.score - a.score);
    }

    let best = moves[0];

    if (caps.blunderChance > 0 && moves.length > 1 && Math.random() < caps.blunderChance) {
        const nonPickup = moves.filter(m => m.type !== 'pickup');
        if (nonPickup.length > 0) {
            best = nonPickup[Math.floor(Math.random() * nonPickup.length)];
            thoughts.push('[Blunder] Played a random legal move.');
        }
    }
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

function scoreMove(move, state, counting, caps) {
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
        score += scoreSpecial(card, move, state, hand, handSizeAfter, effectiveValue, opponentCards, pileSize, counting, caps);
    }

    // ── 5. Strategic scoring based on opponent knowledge ──
    score += scoreStrategic(move, state, counting, caps);

    return Math.round(score);
}

function scoreSpecial(card, move, state, hand, handSizeAfter, effectiveValue, opponentCards, pileSize, counting, caps) {
    let score = 0;

    // Count what else we have
    const attacksInHand = hand.filter(c => c.type === CardType.ATTACK);
    const playableAttacks = attacksInHand.filter(c => c.value >= effectiveValue);
    const hasPlayableAttacks = playableAttacks.length > 0;

    if (caps && caps.specialDepth === 'shallow') {
        if (!hasPlayableAttacks) score += 8;
        else score -= 6;
        if (card.type === CardType.SKORCH && pileSize >= 5) score += 10;
        if (card.type === CardType.SKORCH && pileSize < 2) score -= 10;
        if (handSizeAfter === 0) score += 12;
        return score;
    }

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

function scoreStrategic(move, state, counting, caps) {
    if (caps && !caps.memory && !caps.counting) return 0;
    const memory = state._aiMemory;
    if (!memory || !move.card) return 0;

    let score = 0;
    const card = move.card;
    const useMemory = !caps || caps.memory;
    const knownCards = useMemory ? (memory.knownOpponentCards || []) : [];
    const effectiveValue = getEffectiveValue(state);

    // Only apply to attack cards
    if (card.type !== CardType.ATTACK) return score;

    // --- VISIBLE PRISON AWARENESS ---
    // When opponent is in prison phase, their face-up prison cards ARE known threats
    let allKnownThreats = [...knownCards];
    if (state.player.hand.length === 0) {
        // Opponent is in prison - add their visible prison cards as known
        for (const row of ['front', 'back']) {
            for (let i = 0; i < state.player.prison[row].length; i++) {
                const slot = state.player.prison[row][i];
                if (slot.card && slot.faceUp) {
                    allKnownThreats.push(slot.card);
                }
            }
        }
    }

    // --- BLOCK SCORING ---
    // If we know opponent's highest attack, play just above it
    const knownAttacks = allKnownThreats.filter(c => c.type === 'attack');
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
    const canBeatWithKnown = allKnownThreats.some(c =>
        (c.type === 'attack' && c.value >= card.value) || c.isSpecial
    );
    if (!canBeatWithKnown && allKnownThreats.length > 0 && memory.unknownOpponentDraws <= 2) {
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
        // What the player sees: if the taken card was face-down, they don't know what it was
        const tookDisplay = bestTake.faceUp ? bestTake.card.name : 'Unknown card';
        const gaveDisplay = worstGive.faceUp ? worstGive.card.name : 'Unknown card';
        executeUndeadSwap(state, 'computer', { row: worstGive.row, index: worstGive.index }, { row: bestTake.row, index: bestTake.index });
        const swapMsg = `Gave ${gaveDisplay} → Took your ${tookDisplay}`;
        thoughts.push(`Undead: Gave ${worstGive.card.name} → Took ${bestTake.card.name}`);
        state._lastUndeadSwap = { gave: gaveDisplay, took: tookDisplay, swapMsg };
    } else if (bestTake && myUnlocked.length === 0) {
        const tookDisplay = bestTake.faceUp ? bestTake.card.name : 'Unknown card';
        const card = state.player.prison[bestTake.row][bestTake.index].card;
        state.player.prison[bestTake.row][bestTake.index].card = null;
        state.computer.hand.push(card);
        const swapMsg = `Took your ${tookDisplay}`;
        thoughts.push(`Undead: Took ${bestTake.card.name}`);
        state._lastUndeadSwap = { gave: null, took: tookDisplay, swapMsg };
    } else {
        thoughts.push('Undead: no beneficial swap found.');
        state._lastUndeadSwap = null;
    }
}

// ─── PRISON PLAYS ──────────────────────────────────────────────

function computerPlayPrison(state, thoughts, caps) {
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

    const effectiveValue = getEffectiveValue(state);
    const pileSize = state.discardPile.length;

    const faceUpPlayable = accessible.filter(a => a.faceUp && isValidPlay(a.card, state));
    const faceDownAccessible = accessible.filter(a => !a.faceUp);

    if (caps && caps.search) {
        const counting = countCards(state);
        const SAMPLES = 10;
        const searchCands = [];
        for (const a of faceUpPlayable) {
            searchCands.push({ slot: a, score: searchScorePrison(a, state, counting, SAMPLES), label: a.card.name });
        }
        if (faceDownAccessible.length > 0) {
            const a = faceDownAccessible[0];
            searchCands.push({ slot: a, score: searchScorePrison(a, state, counting, SAMPLES), label: '(face-down flip)' });
        }
        if (searchCands.length > 0) {
            searchCands.sort((x, y) => y.score - x.score);
            const pick = searchCands[0];
            for (const c of searchCands) thoughts.push(`  Prison ${c.label} (${c.slot.row}[${c.slot.index}]): eval ${Math.round(c.score * 10) / 10}`);
            thoughts.push(`→ Search prison: ${pick.label}`);
            const result = playFromPrison(state, 'computer', pick.slot.row, pick.slot.index);
            handlePostPlay(state, result, thoughts);
            return { message: result.message, thoughts: thoughts.join('\n'), handBefore: pick.slot.faceUp ? '(prison - face up)' : '(prison - face down)' };
        }
    }

    const counting = caps && caps.counting ? countCards(state) : null;
    const hasFaceUpAttacks = faceUpPlayable.some(p => p.card.type === CardType.ATTACK);
    const candidates = [];

    for (const a of faceUpPlayable) {
        const card = a.card;
        let score = 0;
        if (card.type === CardType.ATTACK) {
            score += (11 - card.value) * 2 + card.value;
            if (effectiveValue > 0 && card.value - effectiveValue >= 5) score -= (card.value - effectiveValue) * 2;
        } else {
            score += hasFaceUpAttacks ? -10 : 3;
            if (card.type === CardType.SKORCH) {
                if (pileSize >= 5) score += 15;
                else if (pileSize <= 2) score -= 30;
            }
            if (card.type === CardType.DEMOTER && effectiveValue === 0) score -= 30;
            if (card.type === CardType.ELUDE && effectiveValue === 0) score -= 15;
            if (card.type === CardType.SHIELD && hasFaceUpAttacks) score -= 20;
        }
        score += scoreStrategic({ card, type: 'single', indexes: [] }, state, counting, caps);
        a.score = score;
        candidates.push({ slot: a, score, label: card.name });
        thoughts.push(`  Prison ${card.name} (${a.row}[${a.index}]): ${Math.round(score)} pts`);
    }

    const faceDown = accessible.filter(a => !a.faceUp);
    if (faceDown.length > 0) {
        const a = faceDown[0];
        let score = 7;
        if (effectiveValue > 0) score -= effectiveValue * 1.2;
        a.score = score;
        candidates.push({ slot: a, score, label: '(face-down flip)' });
        thoughts.push(`  Prison face-down flip (${a.row}[${a.index}]): ${Math.round(score)} pts`);
    }

    if (candidates.length > 0) {
        candidates.sort((x, y) => y.score - x.score);
        let pick = candidates[0];
        if (caps && caps.blunderChance > 0 && candidates.length > 1 && Math.random() < caps.blunderChance) {
            pick = candidates[Math.floor(Math.random() * candidates.length)];
        }
        thoughts.push(`→ Best prison: ${pick.label} (${Math.round(pick.score)} pts)`);
        const result = playFromPrison(state, 'computer', pick.slot.row, pick.slot.index);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n'), handBefore: pick.slot.faceUp ? '(prison - face up)' : '(prison - face down)' };
    }

    // Fallback
    thoughts.push('No prison plays possible. Picking up.');
    pickupDiscardPile(state, 'computer');
    drawCard(state, 'computer');
    nextTurn(state);
    return { message: 'Computer picked up the pile.', thoughts: thoughts.join('\n'), handBefore: '(prison)' };
}
