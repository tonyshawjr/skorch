// js/ui/leaderboard.js
import { getLeaderboard } from '../multiplayer/auth.js';

export async function showLeaderboard() {
    const overlay = document.createElement('div');
    overlay.className = 'account-overlay'; // Reuse account overlay style
    overlay.innerHTML = `
        <div class="account-modal leaderboard-modal">
            <button class="account-close">&times;</button>
            <h2 class="leaderboard-title">Leaderboard</h2>
            <div class="leaderboard-loading">Loading...</div>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    overlay.querySelector('.account-close').addEventListener('click', () => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 200);
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 200);
        }
    });

    try {
        const data = await getLeaderboard('wins', 20);
        const content = overlay.querySelector('.leaderboard-modal');
        const loading = content.querySelector('.leaderboard-loading');

        if (!data || data.length === 0) {
            loading.textContent = 'No players yet. Be the first!';
            return;
        }

        const list = document.createElement('div');
        list.className = 'leaderboard-list';

        data.forEach((player, index) => {
            const rank = index + 1;
            const winRate = player.games_played > 0 ? Math.round((player.wins / player.games_played) * 100) : 0;
            const isKing = rank === 1;
            const color = player.avatar_color || '#b11f24';
            const displayName = player.display_name || player.username;
            const initial = displayName.charAt(0).toUpperCase();

            let rankLabel = `#${rank}`;
            let rankClass = 'lb-rank';
            if (rank === 1) { rankLabel = 'SKORCH KING'; rankClass = 'lb-rank lb-king'; }
            else if (rank === 2) { rankClass = 'lb-rank lb-silver'; }
            else if (rank === 3) { rankClass = 'lb-rank lb-bronze'; }

            const row = document.createElement('div');
            row.className = `lb-row${isKing ? ' lb-row-king' : ''}`;
            row.innerHTML = `
                <div class="${rankClass}">${rankLabel}</div>
                <div class="lb-avatar" style="background:${color}">${initial}</div>
                <div class="lb-info">
                    <div class="lb-name">${displayName}</div>
                    <div class="lb-username">@${player.username}</div>
                </div>
                <div class="lb-stats-col">
                    <div class="lb-wins">${player.wins}W / ${player.losses}L</div>
                    <div class="lb-winrate">${winRate}%</div>
                </div>
            `;
            list.appendChild(row);
        });

        loading.replaceWith(list);
    } catch (e) {
        overlay.querySelector('.leaderboard-loading').textContent = 'Failed to load leaderboard';
    }
}
