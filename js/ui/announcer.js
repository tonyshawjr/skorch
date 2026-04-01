// js/ui/announcer.js - Game announcements and overlays

const SPECIAL_CONFIG = {
    skorch: { text: 'SKORCH!', sub: 'Discard pile burned', color: '#b11f24' },
    shield: { text: 'SHIELD!', sub: 'Turn skipped', color: '#3b82f6' },
    demoter: { text: 'DEMOTER!', sub: 'Value reset to zero', color: '#f59e0b' },
    elude: { text: 'ELUDE!', sub: 'Mirroring value', color: '#8b5cf6' },
    undead: { text: 'UNDEAD!', sub: 'Card swap', color: '#6b7280' }
};

/**
 * Show a special card announcement overlay.
 */
export function announceSpecial(type, who, duration = 1200, state = null) {
    const config = SPECIAL_CONFIG[type];
    if (!config) return Promise.resolve();

    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'announce-overlay';

        // Override sub text for Undead if we have swap details
        let subText = config.sub;
        if (type === 'undead' && state && state._lastUndeadSwap) {
            subText = state._lastUndeadSwap.swapMsg;
        }

        let extraHTML = '';
        if (type === 'skorch') {
            // Add flame particles for Skorch
            let flames = '';
            for (let i = 0; i < 20; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 0.6;
                const size = 20 + Math.random() * 40;
                const dur = 0.8 + Math.random() * 0.6;
                flames += `<div class="flame-particle" style="left:${left}%;animation-delay:${delay}s;width:${size}px;height:${size * 2}px;animation-duration:${dur}s;"></div>`;
            }
            extraHTML = `<div class="flames-container">${flames}</div>`;
        }

        overlay.innerHTML = `
            ${extraHTML}
            <div class="announce-card" style="--announce-color: ${config.color}">
                <div class="announce-text">${config.text}</div>
                <div class="announce-sub">${who === 'player' ? 'You' : 'Computer'} - ${subText}</div>
            </div>
        `;

        document.body.appendChild(overlay);

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
 */
export function showGameOver(winner, onRestart) {
    const isWin = winner === 'player';

    const overlay = document.createElement('div');
    overlay.className = 'gameover-overlay';
    overlay.innerHTML = `
        <div class="gameover-content">
            <div class="gameover-title">${isWin ? 'VICTORY' : 'DEFEAT'}</div>
            <div class="gameover-sub">${isWin ? 'You Skorched the competition.' : 'The computer got the best of you.'}</div>
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
