import { esc } from './escape.js';

export async function showPlayerCard(username) {
    if (!username || username === 'Opponent' || username === 'You' || username === 'AI') return;

    // Fetch profile
    let profile;
    try {
        const res = await fetch(`/server/php/api/public-profile.php?u=${encodeURIComponent(username)}`);
        if (!res.ok) return;
        profile = await res.json();
        if (profile.error) return;
    } catch (e) { return; }

    const displayName = profile.display_name || profile.username;
    const wins = profile.wins || 0;
    const losses = profile.losses || 0;
    const gamesPlayed = profile.games_played || 0;
    const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
    const elo = profile.elo_rating || 1200;
    const bestStreak = profile.best_streak || 0;
    const avatarColor = profile.avatar_color || '#b11f24';
    const initial = displayName.charAt(0).toUpperCase();

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.innerHTML = `
        <div style="background:#1a1517;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:1.5rem;width:280px;max-width:90vw;text-align:center;">
            <div style="width:56px;height:56px;border-radius:50%;background:${avatarColor};display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800;color:white;margin:0 auto 0.75rem;">${initial}</div>
            <div style="font-size:1.1rem;font-weight:700;color:white;">${esc(displayName)}</div>
            <div style="font-size:0.8rem;color:#9ca3af;margin-bottom:1rem;">@${esc(profile.username)}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;margin-bottom:1rem;">
                <div>
                    <div style="font-size:1.25rem;font-weight:800;color:#eab308;">${elo}</div>
                    <div style="font-size:0.65rem;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Elo</div>
                </div>
                <div>
                    <div style="font-size:1.25rem;font-weight:800;color:#10b981;">${wins}</div>
                    <div style="font-size:0.65rem;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Wins</div>
                </div>
                <div>
                    <div style="font-size:1.25rem;font-weight:800;color:#ef4444;">${losses}</div>
                    <div style="font-size:0.65rem;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Losses</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;margin-bottom:1.25rem;">
                <div>
                    <div style="font-size:1.25rem;font-weight:800;color:white;">${gamesPlayed}</div>
                    <div style="font-size:0.65rem;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Played</div>
                </div>
                <div>
                    <div style="font-size:1.25rem;font-weight:800;color:white;">${winRate}%</div>
                    <div style="font-size:0.65rem;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Win Rate</div>
                </div>
                <div>
                    <div style="font-size:1.25rem;font-weight:800;color:white;">${bestStreak}</div>
                    <div style="font-size:0.65rem;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Streak</div>
                </div>
            </div>
            <a href="/profile?u=${encodeURIComponent(profile.username)}" style="display:inline-block;font-size:0.8rem;color:#b11f24;text-decoration:none;font-weight:600;">View Full Profile</a>
        </div>
    `;

    document.body.appendChild(overlay);
}
