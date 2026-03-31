import { CardType } from '../engine/cards.js';
import { isValidPlay, getEffectiveValue, playFromHand, playFromPrison, pickupDiscardPile, drawCard, nextTurn, checkWin, getPlayableHandCards, executeUndeadSwap } from '../engine/game.js';
import { isPrisonCardAccessible, getUnlockedCards } from '../engine/prison.js';

export function computerTurn(state) {
    const thoughts = [];
    const hand = state.computer.hand;
    const handBefore = hand.map(c => c.type === 'attack' ? `Attack ${c.value}` : c.name).join(', ') || '(empty)';
    const effectiveValue = getEffectiveValue(state);
    thoughts.push(`Value to beat: ${effectiveValue}`);
    thoughts.push(`Hand size: ${hand.length}`);
    thoughts.push(`Deck remaining: ${state.deck.length}`);

    if (hand.length === 0) return computerPlayPrison(state, thoughts);

    const playable = getPlayableHandCards(state, 'computer');
    const attacks = playable.filter(p => p.card.type === CardType.ATTACK);
    const specials = playable.filter(p => p.card.isSpecial);
    thoughts.push(`Playable: ${attacks.length} attack, ${specials.length} special`);

    if (playable.length === 0) {
        thoughts.push('No valid plays. Picking up discard pile.');
        const result = pickupDiscardPile(state, 'computer');
        drawCard(state, 'computer');
        nextTurn(state);
        return { message: result.message, thoughts: thoughts.join('\n'), handBefore: handBefore || '(prison)' };
    }

    // PRIORITY ORDER:
    // 1. Stack matching attack cards (always efficient)
    // 2. Play single attack card (lowest valid)
    // 3. Use special cards (only when no attacks work, or true emergency)

    // 1. Try stacking first
    const stackPlay = findBestStack(state, attacks, thoughts);
    if (stackPlay) {
        const result = playFromHand(state, 'computer', stackPlay);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n'), handBefore: handBefore || '(prison)' };
    }

    // 2. Play lowest attack card if we have any
    if (attacks.length > 0) {
        const sorted = [...attacks].sort((a, b) => a.card.value - b.card.value);
        const lowest = sorted[0];
        thoughts.push(`Playing lowest: Attack ${lowest.card.value}`);
        const result = playFromHand(state, 'computer', [lowest.index]);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n'), handBefore: handBefore || '(prison)' };
    }

    // 3. No attack cards playable - evaluate specials
    thoughts.push('No playable attacks - evaluating specials.');
    const specialPlay = evaluateSpecialCards(state, specials, attacks, thoughts);
    if (specialPlay) {
        const result = playFromHand(state, 'computer', [specialPlay.index]);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n'), handBefore: handBefore || '(prison)' };
    }

    // 4. Fallback: play a useful special card (never waste Shield)
    if (specials.length > 0) {
        // Priority: Demoter (resets value) > Skorch (burns pile) > Elude (buys time) > Undead
        // NEVER play Shield as fallback - it doesn't change the value, just wastes a card
        const priority = [CardType.DEMOTER, CardType.SKORCH, CardType.ELUDE, CardType.UNDEAD];
        for (const type of priority) {
            const card = specials.find(s => s.card.type === type);
            if (card) {
                thoughts.push(`Fallback: playing ${card.card.name} (useful)`);
                const result = playFromHand(state, 'computer', [card.index]);
                handlePostPlay(state, result, thoughts);
                return { message: result.message, thoughts: thoughts.join('\n'), handBefore: handBefore || '(prison)' };
            }
        }
        // Only Shields left - check if playing them empties hand to reach prison
        const attacksLeft = state.computer.hand.filter(c => c.type === 'attack').length;
        const shieldsLeft = specials.filter(s => s.card.type === 'shield');
        if (attacksLeft === 0 && shieldsLeft.length > 0) {
            // Playing shields empties hand → prison access
            thoughts.push(`Fallback: playing Shield to empty hand (${shieldsLeft.length} shields → prison)`);
            const result = playFromHand(state, 'computer', [shieldsLeft[0].index]);
            handlePostPlay(state, result, thoughts);
            return { message: result.message, thoughts: thoughts.join('\n'), handBefore: handBefore || '(prison)' };
        }
        thoughts.push('Only Shield available - not useful, picking up instead.');
    }

    // 5. Truly nothing - pick up
    thoughts.push('No moves at all. Picking up.');
    const pickResult = pickupDiscardPile(state, 'computer');
    drawCard(state, 'computer');
    nextTurn(state);
    return { message: pickResult.message, thoughts: thoughts.join('\n'), handBefore };
}

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

function evaluateSpecialCards(state, specials, attacks, thoughts) {
    const discardSize = state.discardPile.length;
    const effectiveValue = getEffectiveValue(state);
    const playerHandSize = state.player.hand.length;
    const noAttacks = attacks.length === 0;

    for (const s of specials) {
        switch (s.card.type) {
            case CardType.SKORCH:
                // Only burn when pile is truly large (8+) or we're desperate
                if (discardSize >= 8 || (noAttacks && discardSize >= 5)) {
                    thoughts.push(`Playing Skorch (${discardSize} cards in pile)`);
                    return s;
                }
                break;
            case CardType.DEMOTER:
                // Demoter resets value to 0 - great when we can't play attacks
                if (noAttacks && effectiveValue >= 3) {
                    thoughts.push(`Playing Demoter (resets value from ${effectiveValue} to 0)`);
                    return s;
                }
                break;
            case CardType.SHIELD: {
                // Shield skips opponent and gives us another turn, but value stays the same.
                const canFollowUp = state.computer.hand.some(c =>
                    c.type === CardType.ATTACK && c.value >= effectiveValue
                );

                // Count how many specials (non-attack) are in hand
                const specialsInHand = state.computer.hand.filter(c => c.isSpecial).length;
                const attacksInHand = state.computer.hand.filter(c => c.type === CardType.ATTACK).length;

                // Play Shield if:
                // 1. Player is about to win and we can follow up with an attack
                if (playerHandSize <= 2 && canFollowUp) {
                    thoughts.push(`Playing Shield (player has ${playerHandSize} cards, have follow-up)`);
                    return s;
                }

                // 2. Playing remaining specials will empty our hand → access prison cards
                //    If hand is ALL specials (no attacks), playing them gets us to prison
                if (attacksInHand === 0 && specialsInHand <= 3) {
                    thoughts.push(`Playing Shield (emptying hand to reach prison, ${specialsInHand} specials left)`);
                    return s;
                }

                // 3. We have an attack follow-up and discardPile is small (not wasting much)
                if (canFollowUp && discardSize <= 3) {
                    thoughts.push(`Playing Shield (have follow-up, small pile)`);
                    return s;
                }

                thoughts.push(`Skipping Shield (no strategic benefit)`);
                break;
            }
            case CardType.ELUDE:
                if (noAttacks && effectiveValue >= 4) {
                    thoughts.push(`Playing Elude (can't beat ${effectiveValue})`);
                    return s;
                }
                break;
            case CardType.UNDEAD:
                const theirUnlocked = getUnlockedCards(state.player.prison);
                const hasHighCards = theirUnlocked.some(u => u.card.type === CardType.ATTACK && u.card.value >= 7);
                if (hasHighCards || (noAttacks && theirUnlocked.length > 0)) {
                    thoughts.push('Playing Undead (opponent has valuable prison cards)');
                    return s;
                }
                break;
        }
    }
    return null;
}

function findBestStack(state, attacks, thoughts) {
    // Group ALL attack cards in hand by value (not just playable ones)
    // so we can find stacks even across the full hand
    const groups = {};
    for (const a of attacks) {
        const v = a.card.value;
        if (!groups[v]) groups[v] = [];
        groups[v].push(a);
    }

    // Find all groups with 2+ cards
    const stackable = [];
    for (const [value, group] of Object.entries(groups)) {
        if (group.length >= 2) {
            stackable.push({ value: parseInt(value), group });
        }
    }

    if (stackable.length === 0) return null;

    const handSize = state.computer.hand.length;
    const inTrouble = handSize > 7;
    const effectiveVal = getEffectiveValue(state);

    // Check: how many DIFFERENT attack values do we have playable?
    const uniqueValues = new Set(attacks.map(a => a.card.value));

    // Sort lowest first
    stackable.sort((a, b) => a.value - b.value);

    for (const s of stackable) {
        // ALWAYS stack low cards (1-5) - no reason to hold them
        if (s.value <= 5) {
            thoughts.push(`Stacking ${s.group.length}x Attack ${s.value} (low cards, dump them)`);
            return s.group.map(g => g.index);
        }
        // Stack high cards if:
        // - We're in trouble (hand > 7), OR
        // - It's the ONLY attack value we have (no reason to play one at a time), OR
        // - The value to beat is close to the stack value (within 3), OR
        // - We have 3+ of them
        if (inTrouble || uniqueValues.size === 1 || s.group.length >= 3 || (s.value - effectiveVal <= 3 && effectiveVal > 0)) {
            const reason = inTrouble ? 'need to dump' : uniqueValues.size === 1 ? 'only attack value' : s.group.length >= 3 ? '3+ cards' : 'close to value';
            thoughts.push(`Stacking ${s.group.length}x Attack ${s.value} (${reason})`);
            return s.group.map(g => g.index);
        }
    }

    // If we have stacks but chose not to use them, return null
    return null;
}

function handleComputerUndead(state, thoughts) {
    const myUnlocked = getUnlockedCards(state.computer.prison);
    const theirUnlocked = getUnlockedCards(state.player.prison);
    if (theirUnlocked.length === 0) {
        thoughts.push('Undead: no opponent cards to take.');
        return;
    }
    let bestTake = null;
    for (const u of theirUnlocked) {
        if (!bestTake) { bestTake = u; continue; }
        if (u.card.type === CardType.ATTACK && bestTake.card.type === CardType.ATTACK) {
            if (u.card.value > bestTake.card.value) bestTake = u;
        } else if (u.card.isSpecial && !bestTake.card.isSpecial) {
            bestTake = u;
        }
    }
    let worstGive = null;
    for (const u of myUnlocked) {
        if (u.card.type === CardType.ATTACK) {
            if (!worstGive || u.card.value < worstGive.card.value) worstGive = u;
        }
    }
    if (bestTake && worstGive) {
        executeUndeadSwap(state, 'computer', { row: worstGive.row, index: worstGive.index }, { row: bestTake.row, index: bestTake.index });
        thoughts.push(`Undead: swapped ${worstGive.card.name} for ${bestTake.card.name}`);
    } else if (bestTake && myUnlocked.length === 0) {
        const card = state.player.prison[bestTake.row][bestTake.index].card;
        state.player.prison[bestTake.row][bestTake.index].card = null;
        state.computer.hand.push(card);
        thoughts.push(`Undead: took ${bestTake.card.name} (nothing to give)`);
    } else {
        thoughts.push('Undead: no beneficial swap found.');
    }
}

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
    const faceUpPlayable = accessible.filter(a => a.faceUp && isValidPlay(a.card, state));
    if (faceUpPlayable.length > 0) {
        const sorted = faceUpPlayable.sort((a, b) => {
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
    const faceDown = accessible.filter(a => !a.faceUp);
    if (faceDown.length > 0) {
        const pick = faceDown[0];
        thoughts.push(`Playing face-down prison card (risky): ${pick.row}[${pick.index}]`);
        const result = playFromPrison(state, 'computer', pick.row, pick.index);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n'), handBefore: '(prison - face down)' };
    }
    thoughts.push('No prison plays possible. Picking up.');
    pickupDiscardPile(state, 'computer');
    drawCard(state, 'computer');
    nextTurn(state);
    return { message: 'Computer picked up the pile.', thoughts: thoughts.join('\n'), handBefore: '(prison)' };
}
