import { getCardImage } from '../engine/cards.js';
import { getUnlockedCards } from '../engine/prison.js';

export function showUndeadModal(state, onSwap, onCancel) {
    const myUnlocked = getUnlockedCards(state.player.prison);
    const theirUnlocked = getUnlockedCards(state.computer.prison);

    if (theirUnlocked.length === 0) { onCancel(); return; }

    const overlay = document.createElement('div');
    overlay.className = 'undead-overlay';
    overlay.innerHTML = `
        <div class="undead-modal">
            <div class="undead-header">
                <h3>Undead Swap</h3>
                <p>${myUnlocked.length > 0
                    ? 'Tap one of yours to give, one of theirs to take.'
                    : 'Tap one of their cards to take.'}</p>
            </div>
            <div class="undead-cards-scroll">
                <div class="undead-columns">
                    <div class="undead-column">
                        <h4>Yours</h4>
                        <div class="undead-card-list" id="my-cards"></div>
                    </div>
                    <div class="undead-column">
                        <h4>Theirs</h4>
                        <div class="undead-card-list" id="their-cards"></div>
                    </div>
                </div>
            </div>
            <div class="undead-footer">
                <button class="undead-swap-btn" id="swap-btn" disabled>Swap</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    let selectedMy = null;
    let selectedTheir = null;

    const myContainer = overlay.querySelector('#my-cards');
    if (myUnlocked.length > 0) {
        myUnlocked.forEach(u => {
            const card = createModalCard(u.card, u.faceUp);
            card.addEventListener('click', () => {
                myContainer.querySelectorAll('.undead-card').forEach(c => c.classList.remove('picked'));
                card.classList.add('picked');
                selectedMy = { row: u.row, index: u.index };
                updateBtn();
            });
            myContainer.appendChild(card);
        });
    } else {
        myContainer.innerHTML = '<p style="color:#666;text-align:center;padding:1rem;">No unlocked cards</p>';
    }

    const theirContainer = overlay.querySelector('#their-cards');
    theirUnlocked.forEach(u => {
        const card = createModalCard(u.card, u.faceUp);
        card.addEventListener('click', () => {
            theirContainer.querySelectorAll('.undead-card').forEach(c => c.classList.remove('picked'));
            card.classList.add('picked');
            selectedTheir = { row: u.row, index: u.index };
            updateBtn();
        });
        theirContainer.appendChild(card);
    });

    function updateBtn() {
        const btn = overlay.querySelector('#swap-btn');
        const ready = selectedTheir && (selectedMy || myUnlocked.length === 0);
        btn.disabled = !ready;
        if (ready) btn.classList.add('ready');
        else btn.classList.remove('ready');
    }

    overlay.querySelector('#swap-btn').addEventListener('click', () => {
        overlay.remove();
        onSwap(selectedMy, selectedTheir);
    });
}

function createModalCard(card, faceUp = true) {
    const div = document.createElement('div');
    div.className = 'undead-card';
    if (faceUp) {
        div.style.backgroundImage = `url('assets/cards/${getCardImage(card)}')`;
    } else {
        div.style.backgroundImage = `url('assets/cards/Card-Back.png')`;
    }
    div.style.backgroundSize = 'cover';
    div.style.backgroundPosition = 'center';
    div.style.backgroundRepeat = 'no-repeat';
    return div;
}
