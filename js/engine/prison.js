const BACK_PATTERN = [false, true, false, true, false];
const FRONT_PATTERN = [true, false, true, false, true];

export function createPrison(deck) {
    const prison = { front: [], back: [] };
    for (let i = 0; i < 5; i++) {
        prison.back.push({ card: deck.pop(), faceUp: BACK_PATTERN[i] });
    }
    for (let i = 0; i < 5; i++) {
        prison.front.push({ card: deck.pop(), faceUp: FRONT_PATTERN[i] });
    }
    return prison;
}

export function isPrisonCardAccessible(prison, row, index) {
    const slot = prison[row][index];
    if (!slot || slot.card === null) return false;
    if (row === 'back') {
        if (prison.front[index] && prison.front[index].card !== null) return false;
    }
    return true;
}

export function removePrisonCard(prison, row, index) {
    const slot = prison[row][index];
    if (!slot || slot.card === null) return null;
    const card = slot.card;
    slot.card = null;
    return card;
}

export function isPrisonEmpty(prison) {
    for (const slot of prison.front) { if (slot.card !== null) return false; }
    for (const slot of prison.back) { if (slot.card !== null) return false; }
    return true;
}

export function getUnlockedCards(prison) {
    const unlocked = [];
    // Unlocked = accessible position. Face-up or face-down doesn't matter.
    // Front row cards are always accessible if they exist.
    // Back row cards are accessible when the front card at same index is gone.
    for (let i = 0; i < prison.front.length; i++) {
        const slot = prison.front[i];
        if (slot.card !== null) {
            unlocked.push({ row: 'front', index: i, card: slot.card, faceUp: slot.faceUp });
        }
    }
    for (let i = 0; i < prison.back.length; i++) {
        const slot = prison.back[i];
        if (slot.card !== null) {
            if (prison.front[i] && prison.front[i].card === null) {
                unlocked.push({ row: 'back', index: i, card: slot.card, faceUp: slot.faceUp });
            }
        }
    }
    return unlocked;
}

export function swapPrisonCards(prisonA, rowA, indexA, prisonB, rowB, indexB) {
    const slotA = prisonA[rowA][indexA];
    const slotB = prisonB[rowB][indexB];
    // Swap cards AND their face-up status together
    const tempCard = slotA.card;
    const tempFaceUp = slotA.faceUp;
    slotA.card = slotB.card;
    slotA.faceUp = slotB.faceUp;
    slotB.card = tempCard;
    slotB.faceUp = tempFaceUp;
}
