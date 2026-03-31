import { getCardImage } from '../engine/cards.js';
import { getUnlockedCards } from '../engine/prison.js';

export function showUndeadModal(state, onSwap, onCancel) {
    const myUnlocked = getUnlockedCards(state.player.prison);
    const theirUnlocked = getUnlockedCards(state.computer.prison);

    if (theirUnlocked.length === 0) { onCancel(); return; }

    const overlay = document.createElement('div');
    overlay.className = 'modal';
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.innerHTML = `
        <h3 class="modal-title">Undead Swap</h3>
        <p style="color:#9ca3af;margin-bottom:1rem;">
            ${myUnlocked.length > 0
                ? 'Select one of YOUR cards to give, and one of THEIR cards to take.'
                : 'You have no unlocked cards. Select one of THEIR cards to take.'}
        </p>
        <div class="modal-grid">
            <div>
                <h4 style="color:#9ca3af;margin-bottom:0.5rem;">Your Cards</h4>
                <div class="modal-cards" id="my-cards"></div>
            </div>
            <div>
                <h4 style="color:#9ca3af;margin-bottom:0.5rem;">Their Cards</h4>
                <div class="modal-cards" id="their-cards"></div>
            </div>
        </div>
        <div style="display:flex;gap:1rem;justify-content:center;margin-top:1.5rem;">
            <button class="btn-play" id="swap-btn" disabled>Swap</button>
            <button class="btn-pickup" id="cancel-btn">Skip</button>
        </div>
    `;
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    let selectedMy = null;
    let selectedTheir = null;

    const myContainer = content.querySelector('#my-cards');
    if (myUnlocked.length > 0) {
        myUnlocked.forEach(u => {
            const card = createModalCard(u.card, u.faceUp);
            card.addEventListener('click', () => {
                myContainer.querySelectorAll('.sk-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedMy = { row: u.row, index: u.index };
                updateBtn();
            });
            myContainer.appendChild(card);
        });
    } else {
        myContainer.innerHTML = '<p style="color:#666;">No unlocked cards</p>';
    }

    const theirContainer = content.querySelector('#their-cards');
    theirUnlocked.forEach(u => {
        // Always show opponent cards as face-up so you can see what you're taking
        const card = createModalCard(u.card, u.faceUp);
        card.addEventListener('click', () => {
            theirContainer.querySelectorAll('.sk-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedTheir = { row: u.row, index: u.index };
            updateBtn();
        });
        theirContainer.appendChild(card);
    });

    function updateBtn() {
        const btn = content.querySelector('#swap-btn');
        const ready = selectedTheir && (selectedMy || myUnlocked.length === 0);
        btn.disabled = !ready;
        btn.classList.toggle('active', ready);
    }

    content.querySelector('#swap-btn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        onSwap(selectedMy, selectedTheir);
    });
    content.querySelector('#cancel-btn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        onCancel();
    });
}

function createModalCard(card, faceUp = true) {
    const div = document.createElement('div');
    if (faceUp) {
        div.className = 'sk-card sk-face-up';
        div.style.backgroundImage = `url('assets/cards/${getCardImage(card)}')`;
    } else {
        div.className = 'sk-card sk-face-down';
        div.style.backgroundImage = `url('assets/cards/Card-Back.png')`;
    }
    div.style.backgroundSize = 'var(--card-width) var(--card-height)';
    div.style.backgroundRepeat = 'no-repeat';
    div.style.backgroundPosition = 'center';
    div.style.cursor = 'pointer';
    return div;
}
