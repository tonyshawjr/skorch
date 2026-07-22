// js/ui/announcer.js - Game announcements and overlays
import { esc } from './escape.js';

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
export function showGameOver(winner, onRestart, opponentName, opponentUsername) {
    const isWin = winner === 'player';
    const opponent = esc(opponentName || 'The computer');
    const loseSub = opponentName ? `${opponent} got the best of you.` : 'The computer got the best of you.';
    const isMultiplayer = !!opponentUsername;

    const overlay = document.createElement('div');
    overlay.className = 'gameover-overlay';
    overlay.innerHTML = `
        <div class="gameover-content">
            <div class="gameover-title">${isWin ? 'VICTORY' : 'DEFEAT'}</div>
            <div class="gameover-sub">${isWin ? 'You Skorched the competition.' : loseSub}</div>
            ${isMultiplayer ? '<div class="gameover-friend" id="gameover-friend"></div>' : ''}
            <button class="gameover-btn">${isMultiplayer ? 'Rematch' : 'Play Again'}</button>
            ${isMultiplayer ? `<a href="/profile?u=${encodeURIComponent(opponentUsername)}" class="gameover-profile-link">View ${opponent}'s Profile</a>` : ''}
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

    if (!isMultiplayer) {
        let current = 'medium';
        try {
            const d = localStorage.getItem('skorch_ai_difficulty');
            if (d === 'easy' || d === 'medium' || d === 'hard') current = d;
        } catch(e) {}
        const diffRow = document.createElement('div');
        diffRow.className = 'gameover-diff';
        const label = document.createElement('span');
        label.className = 'gameover-diff-label';
        label.textContent = 'Difficulty';
        diffRow.appendChild(label);
        const group = document.createElement('div');
        group.className = 'gameover-diff-group';
        for (const level of ['easy', 'medium', 'hard', 'insane']) {
            const b = document.createElement('button');
            b.className = 'gameover-diff-btn' + (current === level ? ' active' : '') + (level === 'insane' ? ' gameover-diff-btn-insane' : '');
            b.textContent = level.charAt(0).toUpperCase() + level.slice(1);
            b.addEventListener('click', () => {
                overlay.classList.add('exiting');
                setTimeout(() => { overlay.remove(); onRestart(level); }, 300);
            });
            group.appendChild(b);
        }
        diffRow.appendChild(group);
        overlay.querySelector('.gameover-content').appendChild(diffRow);
    }

    // Check friend status and show Add Friend button
    if (isMultiplayer) {
        (async () => {
            try {
                const res = await fetch(`/server/php/api/friends.php?action=status&username=${encodeURIComponent(opponentUsername)}`, { credentials: 'include' });
                const data = await res.json();
                const wrap = document.getElementById('gameover-friend');
                if (!wrap) return;

                if (data.status === 'none') {
                    wrap.innerHTML = `<button class="gameover-add-friend" id="add-friend-go">Add ${opponent} as Friend</button>`;
                    document.getElementById('add-friend-go').addEventListener('click', async function() {
                        this.disabled = true;
                        this.textContent = 'Sending...';
                        const r = await fetch('/server/php/api/friends.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ action: 'send', username: opponentUsername })
                        });
                        const d = await r.json();
                        this.textContent = d.success ? 'Request Sent!' : (d.error || 'Error');
                    });
                } else if (data.status === 'pending_sent') {
                    wrap.innerHTML = '<span style="color:rgba(255,255,255,0.5);font-size:0.85rem;">Friend request pending</span>';
                } else if (data.status === 'friends') {
                    wrap.innerHTML = '<span style="color:rgba(255,255,255,0.5);font-size:0.85rem;">Friends</span>';
                }
            } catch(e) { /* not logged in or error */ }
        })();
    }
}
