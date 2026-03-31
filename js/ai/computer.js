import { CardType } from '../engine/cards.js';
import { isValidPlay, getEffectiveValue, playFromHand, playFromPrison, pickupDiscardPile, drawCard, nextTurn, checkWin, getPlayableHandCards, executeUndeadSwap } from '../engine/game.js';
import { isPrisonCardAccessible, getUnlockedCards } from '../engine/prison.js';

export function computerTurn(state) {
    const thoughts = [];
    const hand = state.computer.hand;
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
        return { message: result.message, thoughts: thoughts.join('\n') };
    }

    const specialPlay = evaluateSpecialCards(state, specials, attacks, thoughts);
    if (specialPlay) {
        const result = playFromHand(state, 'computer', [specialPlay.index]);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n') };
    }

    const stackPlay = findBestStack(state, attacks, thoughts);
    if (stackPlay) {
        const result = playFromHand(state, 'computer', stackPlay);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n') };
    }

    if (attacks.length > 0) {
        const sorted = [...attacks].sort((a, b) => a.card.value - b.card.value);
        const lowest = sorted[0];
        thoughts.push(`Playing lowest: Attack ${lowest.card.value}`);
        const result = playFromHand(state, 'computer', [lowest.index]);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n') };
    }

    if (specials.length > 0) {
        thoughts.push(`Fallback: playing ${specials[0].card.name}`);
        const result = playFromHand(state, 'computer', [specials[0].index]);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n') };
    }

    thoughts.push('No moves available (unexpected).');
    nextTurn(state);
    return { message: 'Computer passed.', thoughts: thoughts.join('\n') };
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
                if (discardSize >= 5 || (noAttacks && discardSize >= 3)) {
                    thoughts.push(`Playing Skorch (${discardSize} cards in pile)`);
                    return s;
                }
                break;
            case CardType.DEMOTER:
                if (noAttacks && effectiveValue >= 5) {
                    thoughts.push(`Playing Demoter (value ${effectiveValue} too high)`);
                    return s;
                }
                break;
            case CardType.SHIELD:
                if (playerHandSize <= 2 || (noAttacks && effectiveValue >= 7)) {
                    thoughts.push(`Playing Shield (player has ${playerHandSize} cards)`);
                    return s;
                }
                break;
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
    const groups = {};
    for (const a of attacks) {
        const v = a.card.value;
        if (!groups[v]) groups[v] = [];
        groups[v].push(a);
    }
    let bestGroup = null;
    let bestValue = -1;
    for (const [value, group] of Object.entries(groups)) {
        if (group.length >= 2) {
            const v = parseInt(value);
            if (bestGroup === null || v < bestValue) {
                bestGroup = group;
                bestValue = v;
            }
        }
    }
    if (bestGroup) {
        thoughts.push(`Stacking ${bestGroup.length}x Attack ${bestValue}`);
        return bestGroup.map(g => g.index);
    }
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
        return { message: 'Computer picked up the pile.', thoughts: thoughts.join('\n') };
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
        return { message: result.message, thoughts: thoughts.join('\n') };
    }
    const faceDown = accessible.filter(a => !a.faceUp);
    if (faceDown.length > 0) {
        const pick = faceDown[0];
        thoughts.push(`Playing face-down prison card (risky): ${pick.row}[${pick.index}]`);
        const result = playFromPrison(state, 'computer', pick.row, pick.index);
        handlePostPlay(state, result, thoughts);
        return { message: result.message, thoughts: thoughts.join('\n') };
    }
    thoughts.push('No prison plays possible. Picking up.');
    pickupDiscardPile(state, 'computer');
    drawCard(state, 'computer');
    nextTurn(state);
    return { message: 'Computer picked up the pile.', thoughts: thoughts.join('\n') };
}
