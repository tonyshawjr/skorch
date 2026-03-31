// js/ui/announcer.js - Game announcements and overlays

const SPECIAL_CONFIG = {
    skorch: { text: 'SKORCH!', sub: 'Discard pile burned', color: '#EB2228', icon: '🔥' },
    shield: { text: 'SHIELD!', sub: 'Turn skipped', color: '#3b82f6', icon: '🛡️' },
    demoter: { text: 'DEMOTER!', sub: 'Value reset to zero', color: '#f59e0b', icon: '⚔️' },
    elude: { text: 'ELUDE!', sub: 'Mirroring value', color: '#8b5cf6', icon: '👤' },
    undead: { text: 'UNDEAD!', sub: 'Card swap', color: '#6b7280', icon: '💀' }
};

/**
 * Show a special card announcement overlay.
 * @param {string} type - 'skorch', 'shield', 'demoter', 'elude', 'undead'
 * @param {string} who - 'player' or 'computer'
 * @param {number} duration - how long to show (ms)
 * @returns {Promise}
 */
export function announceSpecial(type, who, duration = 1200) {
    const config = SPECIAL_CONFIG[type];
    if (!config) return Promise.resolve();

    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'announce-overlay';
        overlay.innerHTML = `
            <div class="announce-card" style="--announce-color: ${config.color}">
                <div class="announce-icon">${config.icon}</div>
                <div class="announce-text">${config.text}</div>
                <div class="announce-sub">${who === 'player' ? 'You played' : 'Computer played'} ${config.sub}</div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Trigger entrance animation
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });

        setTimeout(() => {
            overlay.classList.add('exiting');
            setTimeout(() => {
                overlay.remove();
                resolve();
            }, 300);
        }, duration);
    });
}

/**
 * Show win/lose screen.
 * @param {string} winner - 'player' or 'computer'
 * @param {function} onRestart - callback for restart button
 */
export function showGameOver(winner, onRestart) {
    const isWin = winner === 'player';

    const overlay = document.createElement('div');
    overlay.className = 'gameover-overlay';
    overlay.innerHTML = `
        <div class="gameover-content">
            <div class="gameover-icon">${isWin ? '🏆' : '💀'}</div>
            <div class="gameover-title">${isWin ? 'VICTORY!' : 'DEFEAT'}</div>
            <div class="gameover-sub">${isWin ? 'You scorched the competition!' : 'The computer got the best of you.'}</div>
            <button class="gameover-btn">${isWin ? 'Play Again' : 'Rematch'}</button>
        </div>
    `;

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.classList.add('visible');
    });

    overlay.querySelector('.gameover-btn').addEventListener('click', () => {
        overlay.classList.add('exiting');
        setTimeout(() => {
            overlay.remove();
            onRestart();
        }, 300);
    });
}
