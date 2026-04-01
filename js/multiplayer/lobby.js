// js/multiplayer/lobby.js - Lobby UI for creating/joining rooms

export function showLobby(onBack) {
    const overlay = document.createElement('div');
    overlay.className = 'lobby-overlay';
    overlay.innerHTML = `
        <div class="lobby-content">
            <h2 class="lobby-title">Multiplayer</h2>

            <div class="lobby-section">
                <h3>Create a Room</h3>
                <div class="lobby-field">
                    <input type="text" id="lobby-username-create" placeholder="Your name" maxlength="20" class="lobby-input" />
                </div>
                <button id="lobby-create-btn" class="lobby-btn lobby-btn-primary">Create Room</button>
            </div>

            <div class="lobby-divider"><span>OR</span></div>

            <div class="lobby-section">
                <h3>Join a Room</h3>
                <div class="lobby-field">
                    <input type="text" id="lobby-username-join" placeholder="Your name" maxlength="20" class="lobby-input" />
                </div>
                <div class="lobby-field">
                    <input type="text" id="lobby-room-code" placeholder="Room code (e.g. FIRE)" maxlength="4" class="lobby-input lobby-code-input" />
                </div>
                <button id="lobby-join-btn" class="lobby-btn lobby-btn-secondary">Join Room</button>
            </div>

            <button id="lobby-back-btn" class="lobby-btn lobby-btn-back">Back to Single Player</button>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    // Auto-uppercase room code
    const codeInput = overlay.querySelector('#lobby-room-code');
    codeInput.addEventListener('input', () => {
        codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });

    overlay.querySelector('#lobby-back-btn').addEventListener('click', () => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300);
        if (onBack) onBack();
    });

    return {
        overlay,
        onCreateClick(handler) {
            overlay.querySelector('#lobby-create-btn').addEventListener('click', () => {
                const username = overlay.querySelector('#lobby-username-create').value.trim();
                if (!username) { alert('Enter your name'); return; }
                handler(username);
            });
        },
        onJoinClick(handler) {
            overlay.querySelector('#lobby-join-btn').addEventListener('click', () => {
                const username = overlay.querySelector('#lobby-username-join').value.trim();
                const code = overlay.querySelector('#lobby-room-code').value.trim();
                if (!username) { alert('Enter your name'); return; }
                if (code.length !== 4) { alert('Enter a 4-letter room code'); return; }
                handler(username, code);
            });
        },
        showWaiting(code) {
            overlay.querySelector('.lobby-content').innerHTML = `
                <h2 class="lobby-title">Waiting for Opponent</h2>
                <div class="lobby-room-display">
                    <p>Share this code:</p>
                    <div class="lobby-code">${code}</div>
                    <p class="lobby-hint">Waiting for someone to join...</p>
                </div>
                <button id="lobby-cancel-btn" class="lobby-btn lobby-btn-back">Cancel</button>
            `;
            overlay.querySelector('#lobby-cancel-btn').addEventListener('click', () => {
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
                if (onBack) onBack();
            });
        },
        showJoining() {
            overlay.querySelector('.lobby-content').innerHTML = `
                <h2 class="lobby-title">Joining...</h2>
                <p class="lobby-hint">Connecting to room...</p>
            `;
        },
        close() {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        },
        showError(msg) {
            const existing = overlay.querySelector('.lobby-error');
            if (existing) existing.remove();
            const err = document.createElement('div');
            err.className = 'lobby-error';
            err.textContent = msg;
            overlay.querySelector('.lobby-content').appendChild(err);
            setTimeout(() => err.remove(), 3000);
        }
    };
}
