// js/site.js — Skorch website logic (all platform pages)

// ── Shared Utilities ──

function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return str.replace(/[&"'<>]/g, function(c) {
        return {'&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;'}[c];
    });
}

(function() {
    var path = window.location.pathname;
    var extra = [{ href: '/clans', label: 'Clans' }, { href: '/friends', label: 'Friends' }];
    var links = document.querySelector('.site-nav__links');
    if (links) {
        var after = links.querySelector('a[href="/leaderboard"]');
        extra.forEach(function(item) {
            if (links.querySelector('a[href="' + item.href + '"]')) return;
            var a = document.createElement('a');
            a.href = item.href;
            a.className = 'site-nav__link' + (path.indexOf(item.href) === 0 ? ' is-active' : '');
            a.textContent = item.label;
            if (after && after.nextSibling) links.insertBefore(a, after.nextSibling);
            else links.appendChild(a);
            after = a;
        });
    }
    var mobile = document.getElementById('mobile-menu');
    if (mobile) {
        var mafter = mobile.querySelector('a[href="/leaderboard"]');
        extra.forEach(function(item) {
            if (mobile.querySelector('a[href="' + item.href + '"]')) return;
            var ma = document.createElement('a');
            ma.href = item.href;
            ma.className = 'site-nav__mobile-link';
            ma.textContent = item.label;
            if (mafter && mafter.nextSibling) mobile.insertBefore(ma, mafter.nextSibling);
            else mobile.appendChild(ma);
            mafter = ma;
        });
    }
})();

(function() {
    fetch('/server/php/api/admin.php?action=check', { credentials: 'include' }).then(function(r) {
        return r.ok ? r.json() : null;
    }).then(function(d) {
        if (!d || !d.is_admin) return;
        var onAdmin = window.location.pathname.indexOf('/admin') === 0;
        var links = document.querySelector('.site-nav__links');
        if (links && !links.querySelector('a[href="/admin"]')) {
            var a = document.createElement('a');
            a.href = '/admin';
            a.className = 'site-nav__link' + (onAdmin ? ' is-active' : '');
            a.textContent = 'Admin';
            links.appendChild(a);
        }
        var mobile = document.getElementById('mobile-menu');
        if (mobile && !mobile.querySelector('a[href="/admin"]')) {
            var ma = document.createElement('a');
            ma.href = '/admin';
            ma.className = 'site-nav__mobile-link';
            ma.textContent = 'Admin';
            mobile.appendChild(ma);
        }
    }).catch(function() {});
})();

function isRecentlyActive(ts) {
    if (!ts) return false;
    var t = new Date(ts.replace(' ', 'T') + 'Z').getTime();
    if (isNaN(t)) return false;
    return (Date.now() - t) < 5 * 60 * 1000;
}

document.addEventListener('focusin', function(e) {
    var t = e.target;
    if (t && t.closest && t.closest('.account-modal') && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) {
        setTimeout(function() { try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (err) {} }, 300);
    }
});

(function() {
    function addBugButton() {
        if (document.getElementById('bug-report-btn') || !document.body) return;
        var btn = document.createElement('button');
        btn.id = 'bug-report-btn';
        btn.className = 'bug-report-btn';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Report a bug');
        btn.innerHTML = '&#128027;';
        btn.addEventListener('click', showBugModal);
        document.body.appendChild(btn);
    }
    if (document.body) addBugButton();
    else document.addEventListener('DOMContentLoaded', addBugButton);
})();

function showBugModal() {
    var overlay = document.createElement('div');
    overlay.className = 'account-overlay';
    overlay.innerHTML = '<div class="account-modal" style="max-width:420px;">' +
        '<button class="account-close">&times;</button>' +
        '<h2 style="color:white;text-align:center;margin-bottom:0.5rem;">Report a Bug</h2>' +
        '<p class="firestorm-status" style="text-align:center;margin-bottom:1rem;">Tell us what went wrong. A screenshot helps a lot.</p>' +
        '<div class="form-group"><textarea class="form-input" id="bug-msg" rows="4" maxlength="2000" placeholder="What happened? What did you expect?"></textarea></div>' +
        '<div class="form-group"><label class="avatar-upload-btn" for="bug-shot">Attach screenshot (optional)</label><input type="file" id="bug-shot" accept="image/*" style="display:none;"><span id="bug-shot-name" style="font-size:0.75rem;color:var(--text-muted);margin-left:0.5rem;"></span></div>' +
        '<button class="btn btn-primary btn-lg" id="bug-submit" style="width:100%;">Send Report</button>' +
        '<div id="bug-error" style="color:var(--danger, #ef4444);font-size:0.85rem;text-align:center;min-height:1.1rem;margin-top:0.6rem;"></div>' +
    '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('visible'); });
    function close() { overlay.remove(); }
    overlay.querySelector('.account-close').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    var fileInput = overlay.querySelector('#bug-shot');
    fileInput.addEventListener('change', function() { overlay.querySelector('#bug-shot-name').textContent = fileInput.files[0] ? fileInput.files[0].name : ''; });
    overlay.querySelector('#bug-submit').addEventListener('click', async function() {
        var msg = overlay.querySelector('#bug-msg').value.trim();
        var err = overlay.querySelector('#bug-error');
        if (msg.length < 3) { err.textContent = 'Please describe the bug'; return; }
        this.disabled = true; this.textContent = 'Sending...';
        var fd = new FormData();
        fd.append('message', msg);
        fd.append('page_url', window.location.href);
        if (fileInput.files[0]) fd.append('screenshot', fileInput.files[0]);
        try {
            var res = await fetch('/server/php/api/report-bug.php', { method: 'POST', credentials: 'include', body: fd });
            if (res.status === 401) { err.textContent = 'Please log in to report a bug.'; this.disabled = false; this.textContent = 'Send Report'; return; }
            var d = await res.json();
            if (d.success) { overlay.querySelector('.account-modal').innerHTML = '<h2 style="color:white;text-align:center;margin-bottom:0.5rem;">Thanks!</h2><p class="firestorm-status" style="text-align:center;">Your report was sent.</p><button class="btn btn-primary btn-lg" style="width:100%;" id="bug-close-ok">Close</button>'; overlay.querySelector('#bug-close-ok').addEventListener('click', close); }
            else { err.textContent = d.error || 'Could not send'; this.disabled = false; this.textContent = 'Send Report'; }
        } catch (e) { err.textContent = 'Connection error'; this.disabled = false; this.textContent = 'Send Report'; }
    });
}

// ── Hamburger Menu (all pages) ──

(function() {
    var hamburger = document.getElementById('nav-hamburger');
    var menu = document.getElementById('mobile-menu');
    var overlay = document.getElementById('nav-overlay');

    if (!hamburger || !menu || !overlay) return;

    function toggleMenu() {
        var isOpen = hamburger.getAttribute('aria-expanded') === 'true';
        hamburger.setAttribute('aria-expanded', !isOpen);
        hamburger.classList.toggle('is-open');
        menu.classList.toggle('is-open');
        overlay.classList.toggle('is-visible');
        document.body.style.overflow = isOpen ? '' : 'hidden';
    }

    function closeMenu() {
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.classList.remove('is-open');
        menu.classList.remove('is-open');
        overlay.classList.remove('is-visible');
        document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', closeMenu);
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeMenu(); });
    menu.querySelectorAll('a').forEach(function(link) { link.addEventListener('click', closeMenu); });
})();

// ── Auth Check (all pages except profile which handles its own) ──

async function checkAuth() {
    try {
        var res = await fetch('/server/php/api/profile.php', { credentials: 'include' });
        if (res.ok) {
            var user = await res.json();
            if (user && user.username) {
                var btn = document.getElementById('nav-auth');
                if (btn) {
                    btn.textContent = user.username;
                    btn.href = '/profile';
                }
            }
        }
    } catch (e) { /* not logged in */ }

    // If not logged in, nav-auth already links to /login page
}

// ── Player Search (shared) ──

function initPlayerSearch() {
    var searchInput = document.getElementById('player-search');
    var searchResults = document.getElementById('search-results');
    if (!searchInput || !searchResults) return;

    var debounceTimer = null;

    searchInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        var q = searchInput.value.trim();

        if (q.length < 2) {
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
            return;
        }

        debounceTimer = setTimeout(function() {
            fetchSearchResults(q);
        }, 300);
    });

    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            searchResults.style.display = 'none';
            searchInput.blur();
        }
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('#search-wrap')) {
            searchResults.style.display = 'none';
        }
    });

    async function fetchSearchResults(q) {
        try {
            var res = await fetch('/server/php/api/search.php?q=' + encodeURIComponent(q) + '&limit=10');
            if (!res.ok) throw new Error('Search failed');
            var data = await res.json();
            renderSearchResults(data.results || []);
        } catch (e) {
            searchResults.innerHTML = '<div class="search-no-results">Search unavailable</div>';
            searchResults.style.display = 'block';
        }
    }

    function renderSearchResults(results) {
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-no-results">No players found</div>';
            searchResults.style.display = 'block';
            return;
        }

        var html = '';
        results.forEach(function(p) {
            var initial = (p.display_name || p.username).charAt(0).toUpperCase();
            var color = p.avatar_color || '#3b82f6';
            var avatarHtml = p.avatar_url
                ? '<div class="search-result-avatar"><img src="' + escapeAttr(p.avatar_url) + '" alt=""></div>'
                : '<div class="search-result-avatar" style="background:' + escapeAttr(color) + ';">' + escapeHtml(initial) + '</div>';

            var location = '';
            if (p.city && p.state_region) location = p.city + ', ' + p.state_region;
            else if (p.city) location = p.city;
            else if (p.state_region) location = p.state_region;

            var meta = [];
            if (location) meta.push(escapeHtml(location));
            var levelText = p.level ? 'Lvl ' + p.level : '';

            html += '<a href="/profile?u=' + encodeURIComponent(p.username) + '" class="search-result-item">' +
                avatarHtml +
                '<div class="search-result-info">' +
                    '<div class="search-result-name">' + escapeHtml(p.display_name || p.username) + '</div>' +
                    (meta.length ? '<div class="search-result-meta">' + meta.join(' ') + '</div>' : '') +
                '</div>' +
                (levelText ? '<div class="search-result-level">' + levelText + '</div>' : '') +
            '</a>';
        });

        searchResults.innerHTML = html;
        searchResults.style.display = 'block';
    }
}

function showLoginModal() {
    var overlay = document.createElement('div');
    overlay.className = 'account-overlay';
    overlay.innerHTML =
        '<div class="account-modal">' +
            '<button class="account-close">&times;</button>' +
            '<div class="account-tabs">' +
                '<button class="account-tab active" data-tab="login">Log In</button>' +
                '<button class="account-tab" data-tab="register">Sign Up</button>' +
            '</div>' +
            '<div class="account-form" id="login-form">' +
                '<input type="text" placeholder="Username" class="account-input" id="login-user" autocapitalize="none" autocorrect="off">' +
                '<input type="password" placeholder="Password" class="account-input" id="login-pass">' +
                '<button class="account-btn account-btn-primary" id="login-btn">Log In</button>' +
                '<div class="account-error" id="login-error"></div>' +
            '</div>' +
            '<div class="account-form" id="register-form" style="display:none;">' +
                '<input type="text" placeholder="Username" class="account-input" id="reg-user" autocapitalize="none" autocorrect="off">' +
                '<input type="email" placeholder="Email" class="account-input" id="reg-email">' +
                '<input type="password" placeholder="Password (6+ chars)" class="account-input" id="reg-pass">' +
                '<button class="account-btn account-btn-primary" id="reg-btn">Create Account</button>' +
                '<div class="account-error" id="reg-error"></div>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('visible'); });

    function closeModal() {
        var focused = overlay.querySelector(':focus');
        if (focused) focused.blur();
        overlay.classList.remove('visible');
        setTimeout(function() { overlay.remove(); window.scrollTo(0, 0); }, 200);
    }

    overlay.querySelector('.account-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeModal(); });

    // Tab switching
    overlay.querySelectorAll('.account-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            overlay.querySelectorAll('.account-tab').forEach(function(t) { t.classList.remove('active'); });
            tab.classList.add('active');
            document.getElementById('login-form').style.display = tab.dataset.tab === 'login' ? '' : 'none';
            document.getElementById('register-form').style.display = tab.dataset.tab === 'register' ? '' : 'none';
        });
    });

    function showError(id, msg) {
        var el = document.getElementById(id);
        if (el) { el.textContent = msg; setTimeout(function() { el.textContent = ''; }, 3000); }
    }

    // Login
    overlay.querySelector('#login-btn').addEventListener('click', async function() {
        var username = overlay.querySelector('#login-user').value.trim();
        var password = overlay.querySelector('#login-pass').value;
        if (!username || !password) { showError('login-error', 'Fill in all fields'); return; }
        try {
            var res = await fetch('/server/php/api/login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username: username, password: password })
            });
            var data = await res.json();
            if (data.success) {
                closeModal();
                location.reload();
            } else {
                showError('login-error', data.error || 'Login failed');
            }
        } catch (e) { showError('login-error', 'Connection error'); }
    });

    // Register
    overlay.querySelector('#reg-btn').addEventListener('click', async function() {
        var username = overlay.querySelector('#reg-user').value.trim();
        var email = overlay.querySelector('#reg-email').value.trim();
        var password = overlay.querySelector('#reg-pass').value;
        if (!username || !email || !password) { showError('reg-error', 'Fill in all fields'); return; }
        try {
            var res = await fetch('/server/php/api/register.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username: username, email: email, password: password })
            });
            var data = await res.json();
            if (data.success) {
                closeModal();
                location.reload();
            } else {
                showError('reg-error', data.error || 'Registration failed');
            }
        } catch (e) { showError('reg-error', 'Connection error'); }
    });
}

// ── Homepage ──

function initHomepage() {
    // Fetch Leaderboard
    async function loadLeaderboard() {
        try {
            var res = await fetch('/server/php/api/leaderboard.php?sort=elo_rating&limit=5');
            if (!res.ok) throw new Error('Failed to load');
            var data = await res.json();
            var players = data.leaderboard || data;

            if (!players || players.length === 0) {
                document.getElementById('leaderboard-content').innerHTML = '<p class="lb-empty">No players yet. Be the first!</p>';
                document.getElementById('king-content').innerHTML = '<p class="king-empty">No king yet. Claim the throne!</p>';
                return;
            }

            // King
            var king = players[0];
            document.getElementById('king-content').innerHTML =
                '<div class="king-name"><a href="/profile?u=' + encodeURIComponent(king.username) + '" style="color:inherit;text-decoration:none;">' + escapeHtml(king.username) + '</a></div>' +
                '<div class="king-stats">' +
                    '<div class="king-stat">' +
                        '<span class="king-stat-value">' + (king.elo_rating || 1200) + '</span>' +
                        '<span class="king-stat-label">ELO</span>' +
                    '</div>' +
                    '<div class="king-stat">' +
                        '<span class="king-stat-value">' + (king.wins || 0) + '</span>' +
                        '<span class="king-stat-label">Wins</span>' +
                    '</div>' +
                    '<div class="king-stat">' +
                        '<span class="king-stat-value">' + (king.games_played || 0) + '</span>' +
                        '<span class="king-stat-label">Games</span>' +
                    '</div>' +
                '</div>';

            // Table (top 5)
            var html = '<table class="lb-table">' +
                '<thead><tr>' +
                    '<th>#</th><th>Player</th><th style="text-align:right">ELO</th><th style="text-align:right">W</th>' +
                '</tr></thead><tbody>';

            players.slice(0, 5).forEach(function(p, i) {
                var rankClass = i < 3 ? ' lb-rank-' + (i + 1) : '';
                html += '<tr>' +
                    '<td class="lb-rank' + rankClass + '">' + (i + 1) + '</td>' +
                    '<td class="lb-name"><a href="/profile?u=' + encodeURIComponent(p.username) + '" style="color:inherit;text-decoration:none;">' + escapeHtml(p.username) + '</a></td>' +
                    '<td class="lb-elo">' + (p.elo_rating || 1200) + '</td>' +
                    '<td class="lb-wins">' + (p.wins || 0) + '</td>' +
                '</tr>';
            });

            html += '</tbody></table>';
            document.getElementById('leaderboard-content').innerHTML = html;

        } catch (e) {
            document.getElementById('leaderboard-content').innerHTML = '<p class="lb-empty">Could not load leaderboard.</p>';
            document.getElementById('king-content').innerHTML = '<p class="king-empty">Could not load king data.</p>';
        }
    }

    // Join Room
    var joinInput = document.getElementById('home-room-code');
    var joinBtn = document.getElementById('home-join-btn');

    if (joinInput && joinBtn) {
        joinInput.addEventListener('input', function() {
            joinInput.value = joinInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });

        joinBtn.addEventListener('click', async function() {
            var code = joinInput.value.trim();
            if (code.length !== 4) { joinInput.focus(); return; }
            // Check if logged in first
            try {
                var res = await fetch('/server/php/api/profile.php', { credentials: 'include' });
                if (!res.ok) throw new Error();
                var user = await res.json();
                if (!user || !user.username) throw new Error();
                window.location.href = '/play?join=' + code;
            } catch(e) {
                window.location.href = '/login?return=' + encodeURIComponent('/play?join=' + code);
            }
        });

        joinInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') joinBtn.click();
        });
    }

    // Live Games
    async function loadLiveGames() {
        var container = document.getElementById('live-games-content');
        if (!container) return;
        try {
            var res = await fetch('https://skorch-multiplayer.onrender.com/rooms');
            if (!res.ok) throw new Error('Failed to load');
            var rooms = await res.json();

            if (!rooms || rooms.length === 0) {
                container.innerHTML = '<p class="live-games-empty">No open games right now. <a href="/play#create" style="color:var(--brand-gold, #F5A623);">Create one!</a></p>';
                return;
            }

            var html = '';
            rooms.forEach(function(room) {
                html += '<div class="live-game-item">' +
                    '<div>' +
                        '<div class="live-game-host">' + escapeHtml(room.host) + '</div>' +
                        '<div class="live-game-code">' + escapeHtml(room.code) + '</div>' +
                    '</div>' +
                    '<a href="#" class="live-game-join" data-code="' + escapeAttr(room.code) + '">Join</a>' +
                '</div>';
            });
            container.innerHTML = html;
            // Wire join buttons with auth check
            container.querySelectorAll('.live-game-join').forEach(function(btn) {
                btn.addEventListener('click', async function(e) {
                    e.preventDefault();
                    var code = this.dataset.code;
                    try {
                        var r = await fetch('/server/php/api/profile.php', { credentials: 'include' });
                        if (!r.ok) throw new Error();
                        var u = await r.json();
                        if (!u || !u.username) throw new Error();
                        window.location.href = '/play?join=' + code;
                    } catch(err) {
                        window.location.href = '/login?return=' + encodeURIComponent('/play?join=' + code);
                    }
                });
            });
        } catch (e) {
            container.innerHTML = '<p class="live-games-empty">No open games right now. <a href="/play#create" style="color:var(--brand-gold, #F5A623);">Create one!</a></p>';
        }
    }

    // Init
    loadLeaderboard();
    loadLiveGames();
    setInterval(loadLiveGames, 15000);
    checkAuth();
    initPlayerSearch();
}

// ── Leaderboard Page ──

function initLeaderboard() {
    // Filter Tabs
    document.querySelectorAll('.filter-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.filter-tab').forEach(function(t) { t.classList.remove('active'); });
            tab.classList.add('active');
            loadLeaderboard();
        });
    });

    // Fetch Leaderboard
    async function loadLeaderboard() {
        try {
            var res = await fetch('/server/php/api/leaderboard.php?sort=elo_rating&limit=50');
            if (!res.ok) throw new Error('Failed to load');
            var data = await res.json();
            var players = data.leaderboard || data;

            if (!players || players.length === 0) {
                document.getElementById('king-content').innerHTML =
                    '<div class="king-crown">&#128081;</div><p class="king-empty">No king yet. Play a game and claim the throne!</p>';
                document.getElementById('rankings-content').innerHTML =
                    '<p class="empty-state">No players yet. Be the first to play!</p>';
                return;
            }

            // King Spotlight
            var king = players[0];
            var kingName = king.username;
            var kingInitial = kingName.charAt(0).toUpperCase();
            var kingColor = king.avatar_color || '#eab308';
            var kingWinRate = king.games_played > 0
                ? Math.round((king.wins / king.games_played) * 100)
                : 0;

            document.getElementById('king-content').innerHTML =
                '<div class="king-crown">&#128081;</div>' +
                '<div class="king-label">Skorch King</div>' +
                '<div class="king-avatar" style="background:' + escapeAttr(kingColor) + ';">' + escapeHtml(kingInitial) + '</div>' +
                '<div class="king-name"><a href="/profile?u=' + encodeURIComponent(king.username) + '">' + escapeHtml(kingName) + '</a></div>' +
                '<div class="king-stats">' +
                    '<div><span class="king-stat-value">' + (king.elo_rating || 1200) + '</span>Elo</div>' +
                    '<div><span class="king-stat-value">' + (king.wins || 0) + '</span>Wins</div>' +
                    '<div><span class="king-stat-value">' + (king.losses || 0) + '</span>Losses</div>' +
                    '<div><span class="king-stat-value">' + kingWinRate + '%</span>Win Rate</div>' +
                    '<div><span class="king-stat-value">' + (king.best_streak || 0) + '</span>Best Streak</div>' +
                '</div>';

            // Rankings Table
            var html = '<table class="rankings-table">' +
                '<thead><tr>' +
                    '<th>#</th>' +
                    '<th>Player</th>' +
                    '<th class="right">Elo</th>' +
                    '<th class="right">W / L</th>' +
                    '<th class="right th-winrate">Win %</th>' +
                    '<th class="right th-games">Games</th>' +
                '</tr></thead><tbody>';

            players.forEach(function(p, i) {
                var rank = i + 1;
                var name = p.username;
                var initial = name.charAt(0).toUpperCase();
                var color = p.avatar_color || '#3b82f6';
                var winRate = p.games_played > 0
                    ? Math.round((p.wins / p.games_played) * 100)
                    : 0;

                var rankClass = rank <= 3 ? ' rank-' + rank : '';
                var rowClass = rank === 1 ? ' row-king' : '';
                var kingBadge = rank === 1
                    ? '<span class="player-king-badge">&#128081; Skorch King</span>'
                    : '';

                html += '<tr class="' + rowClass + '">' +
                    '<td class="col-rank' + rankClass + '">' + (rank === 1 ? '&#128081;' : rank) + '</td>' +
                    '<td class="col-player">' +
                        '<div class="player-cell">' +
                            '<div class="player-avatar" style="background:' + escapeAttr(color) + ';">' + escapeHtml(initial) + '</div>' +
                            '<div class="player-info">' +
                                '<a href="/profile?u=' + encodeURIComponent(p.username) + '" class="player-name">' + escapeHtml(name) + '</a>' +
                                kingBadge +
                            '</div>' +
                        '</div>' +
                    '</td>' +
                    '<td class="col-elo" style="font-weight:600;color:#eab308;">' + (p.elo_rating || 1200) + '</td>' +
                    '<td class="col-record">' + (p.wins || 0) + ' / ' + (p.losses || 0) + '</td>' +
                    '<td class="col-winrate th-winrate">' + winRate + '%</td>' +
                    '<td class="col-games th-games">' + (p.games_played || 0) + '</td>' +
                '</tr>';
            });

            html += '</tbody></table>';
            document.getElementById('rankings-content').innerHTML = html;

        } catch (e) {
            document.getElementById('king-content').innerHTML =
                '<div class="king-crown">&#128081;</div><p class="king-empty">Could not load leaderboard data.</p>';
            document.getElementById('rankings-content').innerHTML =
                '<p class="empty-state">Could not load rankings. Please try again later.</p>';
        }
    }

    // Init
    loadLeaderboard();
    checkAuth();
    initPlayerSearch();
}

// ── Profile Page ──

function initProfile() {
    var currentUser = null;
    var viewingUsername = null;
    var isOwnProfile = false;

    async function init() {
        var params = new URLSearchParams(window.location.search);
        viewingUsername = params.get('u');

        // Check auth state
        try {
            var res = await fetch('/server/php/api/profile.php', { credentials: 'include' });
            if (res.ok) {
                currentUser = await res.json();
                var btn = document.getElementById('nav-auth');
                if (btn) {
                    btn.textContent = currentUser.username;
                    btn.href = '/profile';
                }
            }
        } catch (e) { /* not logged in */ }

        if (viewingUsername) {
            isOwnProfile = currentUser && currentUser.username === viewingUsername;
            await loadPublicProfile(viewingUsername);
        } else if (currentUser) {
            isOwnProfile = true;
            renderProfile(currentUser);
            loadMatchHistory();
        } else {
            renderError('Not Logged In', 'Log in to view your profile, or use a direct profile link.', '/');
        }
    }

    async function loadPublicProfile(username) {
        try {
            var res = await fetch('/server/php/api/public-profile.php?u=' + encodeURIComponent(username));
            if (res.status === 404) {
                renderError('Player Not Found', 'No player with username "' + escapeHtml(username) + '" exists.', '/leaderboard');
                return;
            }
            if (!res.ok) throw new Error('Failed to load profile');
            var profile = await res.json();
            renderProfile(profile);
            if (isOwnProfile) loadMatchHistory();
        } catch (e) {
            renderError('Error Loading Profile', 'Something went wrong. Please try again.', '/');
        }
    }

    async function loadMatchHistory(username) {
        try {
            var url = username
                ? '/server/php/api/history.php?u=' + encodeURIComponent(username) + '&limit=20'
                : '/server/php/api/history.php?limit=20';
            var opts = username ? {} : { credentials: 'include' };
            var res = await fetch(url, opts);
            if (!res.ok) return;
            var matches = await res.json();
            renderMatchHistory(matches);
        } catch (e) { /* silently fail */ }
    }

    // Rank Calculation (Elo-based)
    function getRank(elo, gamesPlayed, leaderboardPosition) {
        if (!gamesPlayed || gamesPlayed === 0) return { name: 'Unranked', icon: '&#9898;', class: 'rank-unranked' };
        if (leaderboardPosition === 1) return { name: 'Skorch King', icon: '&#128081;', class: 'rank-king' };
        if (elo >= 1600) return { name: 'Platinum', icon: '&#128142;', class: 'rank-platinum' };
        if (elo >= 1400) return { name: 'Gold', icon: '&#11088;', class: 'rank-gold' };
        if (elo >= 1300) return { name: 'Silver', icon: '&#9898;', class: 'rank-silver' };
        if (elo >= 1200) return { name: 'Bronze', icon: '&#129352;', class: 'rank-bronze' };
        return { name: 'Iron', icon: '&#128737;', class: 'rank-iron' };
    }

    async function getLeaderboardPosition(username) {
        try {
            var res = await fetch('/server/php/api/leaderboard.php?sort=elo_rating&limit=100');
            if (!res.ok) return null;
            var data = await res.json();
            var players = data.leaderboard || data;
            var idx = players.findIndex(function(p) { return p.username === username; });
            return idx >= 0 ? idx + 1 : null;
        } catch (e) { return null; }
    }

    // XP calculation for level progress
    function xpForLevel(level) {
        var total = 0;
        for (var i = 1; i < level; i++) {
            if (i <= 10) total += 100;
            else if (i <= 25) total += 250;
            else if (i <= 50) total += 500;
            else if (i <= 75) total += 1000;
            else total += 2000;
        }
        return total;
    }

    // Render Profile
    async function renderProfile(profile) {
        var wins = profile.wins || 0;
        var losses = profile.losses || 0;
        var gamesPlayed = profile.games_played || 0;
        var winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
        var bestStreak = profile.best_streak || 0;
        var elo = profile.elo_rating || 1200;
        var displayName = profile.display_name || profile.username;
        var avatarColor = profile.avatar_color || '#b11f24';
        var avatarUrl = profile.avatar_url || null;
        var bio = profile.bio || '';
        var region = profile.region || '';
        var playStyle = profile.play_style || '';
        var age = profile.age || null;
        // Calculate age from birthday if available
        if (profile.birthday) {
            var bday = new Date(profile.birthday);
            var now = new Date();
            age = now.getFullYear() - bday.getFullYear();
            if (now.getMonth() < bday.getMonth() || (now.getMonth() === bday.getMonth() && now.getDate() < bday.getDate())) age--;
        }
        var socialLinks = profile.social_links || {};
        var lastActive = profile.last_active || null;
        var initial = profile.username.charAt(0).toUpperCase();
        var memberSince = profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

        // Level & XP
        var playerLevel = profile.level || 1;
        var playerXp = profile.xp || 0;
        var currentLevelXp = xpForLevel(playerLevel);
        var nextLevelXp = xpForLevel(playerLevel + 1);
        var progressXp = playerXp - currentLevelXp;
        var neededXp = nextLevelXp - currentLevelXp;
        var progressPercent = neededXp > 0 ? Math.min(100, Math.round((progressXp / neededXp) * 100)) : 100;

        // Calculate "last seen"
        var lastSeenText = '';
        if (lastActive) {
            var diff = Date.now() - new Date(lastActive + 'Z').getTime();
            var mins = Math.floor(diff / 60000);
            if (mins < 5) lastSeenText = 'Online now';
            else if (mins < 60) lastSeenText = mins + 'm ago';
            else if (mins < 1440) lastSeenText = Math.floor(mins / 60) + 'h ago';
            else lastSeenText = Math.floor(mins / 1440) + 'd ago';
        }

        var position = await getLeaderboardPosition(profile.username);
        var rank = getRank(elo, gamesPlayed, position);

        document.title = profile.username + ' - Skorch Profile';

        // Avatar: image or letter
        var avatarHtml = avatarUrl
            ? '<img src="' + escapeAttr(avatarUrl) + '" alt="' + escapeAttr(profile.username) + '" class="avatar avatar-img">'
            : '<div class="avatar" style="background:' + escapeAttr(avatarColor) + ';">' + escapeHtml(initial) + '</div>';

        // Info pills (region, play style, online status)
        var pillsHtml = '';
        if (region || playStyle || lastSeenText) {
            pillsHtml = '<div class="profile-pills">';
            if (region) pillsHtml += '<span class="profile-pill">&#127760; ' + escapeHtml(region) + '</span>';
            if (playStyle) {
                var styleClass = playStyle === 'Competitive' ? 'pill-competitive' : (playStyle === 'Casual' ? 'pill-casual' : 'pill-fun');
                pillsHtml += '<span class="profile-pill ' + styleClass + '">' + escapeHtml(playStyle) + '</span>';
            }
            if (lastSeenText) {
                var onlineClass = lastSeenText === 'Online now' ? 'pill-online' : '';
                pillsHtml += '<span class="profile-pill ' + onlineClass + '">' + escapeHtml(lastSeenText) + '</span>';
            }
            pillsHtml += '</div>';
        }

        // Quick info bar (age, member since)
        var infoBarHtml = '<div class="profile-info-bar">';
        if (age) infoBarHtml += '<div class="info-item"><div class="info-value">' + age + '</div><div class="info-label">Age</div></div>';
        if (memberSince) infoBarHtml += '<div class="info-item"><div class="info-value">' + memberSince + '</div><div class="info-label">Member Since</div></div>';
        if (position) infoBarHtml += '<div class="info-item"><div class="info-value">#' + position + '</div><div class="info-label">Rank</div></div>';
        infoBarHtml += '</div>';

        // Social links
        var socialHtml = '';
        var socialPlatforms = {
            youtube: { icon: '&#9654;', color: '#FF0000', prefix: 'youtube.com/' },
            twitch: { icon: '&#9670;', color: '#9146FF', prefix: 'twitch.tv/' },
            instagram: { icon: '&#9673;', color: '#E1306C', prefix: 'instagram.com/' },
            discord: { icon: '&#9678;', color: '#5865F2', prefix: '' },
            twitter: { icon: '&#10005;', color: '#1DA1F2', prefix: 'x.com/' },
            tiktok: { icon: '&#9835;', color: '#00f2ea', prefix: 'tiktok.com/@' }
        };
        var hasSocial = Object.keys(socialLinks).length > 0;
        if (hasSocial) {
            socialHtml = '<div class="card"><div class="card-title">Socials</div><div class="social-links-list">';
            for (var platform in socialLinks) {
                var info = socialPlatforms[platform] || { icon: '&#128279;', color: '#666', prefix: '' };
                var handle = socialLinks[platform];
                var url = info.prefix ? 'https://' + info.prefix + handle : '';
                socialHtml += '<div class="social-link-item">' +
                    '<span class="social-icon" style="color:' + info.color + '">' + info.icon + '</span>' +
                    '<span class="social-platform">' + platform.charAt(0).toUpperCase() + platform.slice(1) + '</span>' +
                    '<span class="social-handle">' + (url ? '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener">' + escapeHtml(handle) + '</a>' : escapeHtml(handle)) + '</span>' +
                '</div>';
            }
            socialHtml += '</div></div>';
        }

        // Full name line (own profile only)
        var fullNameHtml = '';
        if (isOwnProfile && profile.first_name) {
            var fullName = profile.first_name + (profile.last_name ? ' ' + profile.last_name : '');
            fullNameHtml = '<div class="profile-full-name">' + escapeHtml(fullName) + '</div>';
        }

        // Location line
        var locationHtml = '';
        if (profile.city) {
            locationHtml = '<div class="profile-location">' + escapeHtml(profile.city + (profile.state_region ? ', ' + profile.state_region : '') + (profile.country && profile.country !== 'US' ? ', ' + profile.country : '')) + '</div>';
        }

        // Level & XP bar
        var levelHtml =
            '<div class="level-display">' +
                '<div class="level-number">Level ' + playerLevel + '</div>' +
                '<div class="xp-bar">' +
                    '<div class="xp-fill" style="width:' + progressPercent + '%"></div>' +
                '</div>' +
                '<div class="xp-text">' + progressXp + ' / ' + neededXp + ' XP</div>' +
            '</div>';

        var root = document.getElementById('profile-root');
        root.innerHTML =
            '<div class="profile-header">' +
                avatarHtml +
                '<div class="rank-badge ' + rank.class + '">' +
                    '<span class="rank-icon">' + rank.icon + '</span>' +
                    rank.name +
                '</div>' +
                levelHtml +
                '<div class="display-name">' + escapeHtml(profile.username) + '</div>' +
                fullNameHtml +
                locationHtml +
                pillsHtml +
                (bio ? '<div class="profile-bio">' + escapeHtml(bio) + '</div>' : '') +
                (isOwnProfile ? '<a href="/profile/edit" class="edit-profile-btn">Edit Profile</a>' : '') +
                (isOwnProfile ? '<button class="logout-btn" id="profile-logout">Log Out</button>' : '') +
                (!isOwnProfile ? '<div id="friend-btn-wrap" style="margin-top:0.75rem;"></div>' : '') +
            '</div>' +
            '<div class="profile-content">' +
                // Friends section
                '<div class="card" id="friends-card" style="display:none;">' +
                    '<div class="card-title">Friends <span id="friend-count-badge" style="color:var(--text-muted);font-weight:400;"></span></div>' +
                    '<div id="friends-avatars" class="friends-avatar-row"></div>' +
                '</div>' +
                // Friend requests (own profile only)
                (isOwnProfile ? '<div class="card" id="friend-requests-card" style="display:none;"><div class="card-title">Friend Requests <span id="request-count-badge" style="color:var(--brand-red);font-weight:700;"></span></div><div id="friend-requests-list"></div></div>' : '') +
                infoBarHtml +
                '<div class="card">' +
                    '<div class="card-title"><span class="icon">&#128200;</span> Stats</div>' +
                    '<div class="stats-grid">' +
                        '<div class="stat-item"><div class="stat-value" style="color:#eab308;font-size:1.8rem;">' + elo + '</div><div class="stat-label">Elo Rating</div></div>' +
                        '<div class="stat-item"><div class="stat-value wins">' + wins + '</div><div class="stat-label">Wins</div></div>' +
                        '<div class="stat-item"><div class="stat-value losses">' + losses + '</div><div class="stat-label">Losses</div></div>' +
                        '<div class="stat-item"><div class="stat-value">' + gamesPlayed + '</div><div class="stat-label">Played</div></div>' +
                        '<div class="stat-item"><div class="stat-value winrate">' + winRate + '%</div><div class="stat-label">Win Rate</div></div>' +
                        '<div class="stat-item"><div class="stat-value streak">' + bestStreak + '</div><div class="stat-label">Best Streak</div></div>' +
                    '</div>' +
                '</div>' +
                // Badges section
                '<div class="card">' +
                    '<div class="card-title">Badges <span class="badge-count" id="badge-count"></span></div>' +
                    '<div class="badges-grid" id="badges-grid">' +
                        '<div class="shimmer"></div>' +
                    '</div>' +
                '</div>' +
                socialHtml +
                '<div class="card" id="history-card">' +
                    '<div class="card-title"><span class="icon">&#9876;</span> Match History</div>' +
                    '<div id="match-history"><div class="shimmer"></div><div class="shimmer"></div><div class="shimmer"></div></div>' +
                '</div>' +
            '</div>';

        var logoutBtn = document.getElementById('profile-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async function() {
                logoutBtn.disabled = true;
                logoutBtn.textContent = 'Logging out...';
                await fetch('/server/php/api/logout.php', { method: 'POST', credentials: 'include' }).catch(function() {});
                window.location.href = '/';
            });
        }

        // Load match history for everyone
        loadMatchHistory(profile.username);

        // Load badges
        fetch('/server/php/api/badges.php?action=user&username=' + encodeURIComponent(profile.username))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var grid = document.getElementById('badges-grid');
                var countEl = document.getElementById('badge-count');
                if (!data.badges || data.badges.length === 0) {
                    grid.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No badges yet. Keep playing!</p>';
                    if (countEl) countEl.textContent = '0';
                    return;
                }
                if (countEl) countEl.textContent = data.badges.length;
                grid.innerHTML = data.badges.map(function(b) {
                    return '<div class="badge-item">' +
                        '<div class="badge-icon">' + (b.icon || '&#9733;') + '</div>' +
                        '<div class="badge-name">' + escapeHtml(b.name) + '</div>' +
                        '<div class="badge-desc">' + escapeHtml(b.description) + '</div>' +
                    '</div>';
                }).join('');
            })
            .catch(function() {
                var grid = document.getElementById('badges-grid');
                if (grid) grid.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Could not load badges.</p>';
            });

        // Edit profile handler
        var editLink = document.getElementById('edit-profile-link');
        if (editLink) {
            editLink.addEventListener('click', function(e) {
                e.preventDefault();
                showEditProfileModal(profile);
            });
        }

        // Friends: show top friends from profile data
        var topFriends = profile.top_friends || [];
        var friendCount = profile.friend_count || 0;
        if (friendCount > 0 || topFriends.length > 0) {
            var friendsCard = document.getElementById('friends-card');
            if (friendsCard) {
                friendsCard.style.display = '';
                document.getElementById('friend-count-badge').textContent = '(' + friendCount + ')';
                var avatarsHtml = '';
                topFriends.forEach(function(f) {
                    var av = f.avatar_url
                        ? '<img src="' + escapeAttr(f.avatar_url) + '" class="friend-avatar friend-avatar-img">'
                        : '<div class="friend-avatar" style="background:' + escapeAttr(f.avatar_color || '#b11f24') + ';">' + escapeHtml(f.username.charAt(0).toUpperCase()) + '</div>';
                    avatarsHtml += '<a href="/profile?u=' + encodeURIComponent(f.username) + '" class="friend-item">' + av + '<span class="friend-name">' + escapeHtml(f.username) + '</span></a>';
                });
                document.getElementById('friends-avatars').innerHTML = avatarsHtml;
            }
        }

        // Friend button (other profiles)
        var friendBtnWrap = document.getElementById('friend-btn-wrap');
        if (friendBtnWrap && currentUser) {
            try {
                var fRes = await fetch('/server/php/api/friends.php?action=status&username=' + encodeURIComponent(profile.username), { credentials: 'include' });
                var fData = await fRes.json();
                if (fData.status === 'friends') {
                    friendBtnWrap.innerHTML = '<button class="btn btn-ghost btn-sm" disabled>Friends</button>';
                } else if (fData.status === 'pending_sent') {
                    friendBtnWrap.innerHTML = '<button class="btn btn-ghost btn-sm" disabled>Request Sent</button>';
                } else if (fData.status === 'pending_received') {
                    friendBtnWrap.innerHTML = '<button class="btn btn-primary btn-sm" id="accept-friend-btn">Accept Friend Request</button>';
                    document.getElementById('accept-friend-btn').addEventListener('click', async function() {
                        await fetch('/server/php/api/friends.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'accept', request_id: fData.request_id }) });
                        location.reload();
                    });
                } else {
                    friendBtnWrap.innerHTML = '<button class="btn btn-primary btn-sm" id="add-friend-btn">Add Friend</button>';
                    document.getElementById('add-friend-btn').addEventListener('click', async function() {
                        this.disabled = true;
                        this.textContent = 'Sending...';
                        var r = await fetch('/server/php/api/friends.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'send', username: profile.username }) });
                        var d = await r.json();
                        this.textContent = d.success ? 'Request Sent' : (d.error || 'Error');
                    });
                }
            } catch(e) {}
        }

        // Friend requests (own profile)
        if (isOwnProfile) {
            try {
                var rRes = await fetch('/server/php/api/friends.php?action=requests', { credentials: 'include' });
                var rData = await rRes.json();
                if (rData.requests && rData.requests.length > 0) {
                    var reqCard = document.getElementById('friend-requests-card');
                    if (reqCard) {
                        reqCard.style.display = '';
                        document.getElementById('request-count-badge').textContent = rData.requests.length;
                        var reqHtml = '';
                        rData.requests.forEach(function(req) {
                            var av = req.avatar_url
                                ? '<img src="' + escapeAttr(req.avatar_url) + '" class="friend-avatar friend-avatar-img">'
                                : '<div class="friend-avatar" style="background:' + escapeAttr(req.avatar_color || '#b11f24') + ';">' + escapeHtml(req.username.charAt(0).toUpperCase()) + '</div>';
                            reqHtml += '<div class="friend-request-item" data-id="' + req.request_id + '">' +
                                av +
                                '<div class="friend-request-info"><span class="friend-request-name">' + escapeHtml(req.username) + '</span></div>' +
                                '<button class="btn btn-primary btn-sm friend-accept-btn">Accept</button>' +
                                '<button class="btn btn-ghost btn-sm friend-decline-btn">Decline</button>' +
                            '</div>';
                        });
                        document.getElementById('friend-requests-list').innerHTML = reqHtml;

                        // Wire up accept/decline buttons
                        reqCard.querySelectorAll('.friend-accept-btn').forEach(function(btn) {
                            btn.addEventListener('click', async function() {
                                var id = this.closest('.friend-request-item').dataset.id;
                                await fetch('/server/php/api/friends.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'accept', request_id: parseInt(id) }) });
                                location.reload();
                            });
                        });
                        reqCard.querySelectorAll('.friend-decline-btn').forEach(function(btn) {
                            btn.addEventListener('click', async function() {
                                var id = this.closest('.friend-request-item').dataset.id;
                                await fetch('/server/php/api/friends.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'decline', request_id: parseInt(id) }) });
                                this.closest('.friend-request-item').remove();
                            });
                        });
                    }
                }
            } catch(e) {}
        }
    }

    function showEditProfileModal(profile) {
        var overlay = document.createElement('div');
        overlay.className = 'account-overlay';
        var avatarUrl = profile.avatar_url || null;
        var avatarColor = profile.avatar_color || '#b11f24';
        var initial = (profile.display_name || profile.username).charAt(0).toUpperCase();
        var avatarPreview = avatarUrl
            ? '<img src="' + escapeAttr(avatarUrl) + '" class="edit-avatar-preview edit-avatar-img">'
            : '<div class="edit-avatar-preview" style="background:' + escapeAttr(avatarColor) + ';">' + escapeHtml(initial) + '</div>';

        var socialLinks = profile.social_links || {};
        var regionOptions = ['', 'NA-East', 'NA-West', 'EU-West', 'EU-East', 'Asia', 'Oceania', 'South America', 'Africa', 'Middle East'];
        var styleOptions = ['', 'Competitive', 'Casual', 'Just for Fun'];

        overlay.innerHTML =
            '<div class="account-modal" style="max-width:420px;max-height:90vh;overflow-y:auto;">' +
                '<button class="account-close">&times;</button>' +
                '<h2 style="color:white;text-align:center;margin-bottom:1.5rem;">Edit Profile</h2>' +

                // Avatar
                '<div style="text-align:center;margin-bottom:1.25rem;">' +
                    '<div id="avatar-preview-wrap">' + avatarPreview + '</div>' +
                    '<label class="avatar-upload-btn" for="avatar-file-input">Change Avatar</label>' +
                    '<input type="file" id="avatar-file-input" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none;">' +
                    '<p style="color:rgba(255,255,255,0.3);font-size:0.65rem;margin-top:0.25rem;">Max 2MB</p>' +
                '</div>' +

                // Display Name
                '<div class="edit-field">' +
                    '<label class="edit-label">Display Name</label>' +
                    '<input type="text" class="account-input" id="edit-display-name" placeholder="Display Name" value="' + escapeAttr(profile.display_name || '') + '" maxlength="50">' +
                '</div>' +

                // Bio
                '<div class="edit-field">' +
                    '<label class="edit-label">About</label>' +
                    '<textarea class="account-input" id="edit-bio" placeholder="Tell the world about your Skorch game..." maxlength="200" rows="3" style="resize:vertical;font-family:inherit;">' + escapeHtml(profile.bio || '') + '</textarea>' +
                    '<p style="color:rgba(255,255,255,0.3);font-size:0.65rem;text-align:right;margin-top:0.15rem;"><span id="bio-count">' + (profile.bio || '').length + '</span>/200</p>' +
                '</div>' +

                // Region + Play Style (side by side)
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem;">' +
                    '<div>' +
                        '<label class="edit-label">Region</label>' +
                        '<select class="account-input" id="edit-region">' +
                            regionOptions.map(function(r) {
                                return '<option value="' + r + '"' + (r === (profile.region || '') ? ' selected' : '') + '>' + (r || 'Select Region') + '</option>';
                            }).join('') +
                        '</select>' +
                    '</div>' +
                    '<div>' +
                        '<label class="edit-label">Play Style</label>' +
                        '<select class="account-input" id="edit-play-style">' +
                            styleOptions.map(function(s) {
                                return '<option value="' + s + '"' + (s === (profile.play_style || '') ? ' selected' : '') + '>' + (s || 'Select Style') + '</option>';
                            }).join('') +
                        '</select>' +
                    '</div>' +
                '</div>' +

                // Age
                '<div class="edit-field">' +
                    '<label class="edit-label">Age</label>' +
                    '<input type="number" class="account-input" id="edit-age" placeholder="Age" min="13" max="120" value="' + (profile.age || '') + '" style="width:100px;">' +
                '</div>' +

                // Social Links
                '<div class="edit-field">' +
                    '<label class="edit-label">Social Links</label>' +
                    '<div style="display:flex;flex-direction:column;gap:0.5rem;">' +
                        '<div style="display:flex;gap:0.5rem;align-items:center;"><span style="width:70px;color:rgba(255,255,255,0.5);font-size:0.75rem;">YouTube</span><input type="text" class="account-input social-input" id="social-youtube" placeholder="channel name" value="' + escapeAttr(socialLinks.youtube || '') + '"></div>' +
                        '<div style="display:flex;gap:0.5rem;align-items:center;"><span style="width:70px;color:rgba(255,255,255,0.5);font-size:0.75rem;">Twitch</span><input type="text" class="account-input social-input" id="social-twitch" placeholder="username" value="' + escapeAttr(socialLinks.twitch || '') + '"></div>' +
                        '<div style="display:flex;gap:0.5rem;align-items:center;"><span style="width:70px;color:rgba(255,255,255,0.5);font-size:0.75rem;">Instagram</span><input type="text" class="account-input social-input" id="social-instagram" placeholder="username" value="' + escapeAttr(socialLinks.instagram || '') + '"></div>' +
                        '<div style="display:flex;gap:0.5rem;align-items:center;"><span style="width:70px;color:rgba(255,255,255,0.5);font-size:0.75rem;">Discord</span><input type="text" class="account-input social-input" id="social-discord" placeholder="username#0000" value="' + escapeAttr(socialLinks.discord || '') + '"></div>' +
                        '<div style="display:flex;gap:0.5rem;align-items:center;"><span style="width:70px;color:rgba(255,255,255,0.5);font-size:0.75rem;">X/Twitter</span><input type="text" class="account-input social-input" id="social-twitter" placeholder="handle" value="' + escapeAttr(socialLinks.twitter || '') + '"></div>' +
                        '<div style="display:flex;gap:0.5rem;align-items:center;"><span style="width:70px;color:rgba(255,255,255,0.5);font-size:0.75rem;">TikTok</span><input type="text" class="account-input social-input" id="social-tiktok" placeholder="username" value="' + escapeAttr(socialLinks.tiktok || '') + '"></div>' +
                    '</div>' +
                '</div>' +

                // Avatar Color
                '<div class="edit-field">' +
                    '<label class="edit-label">Avatar Color (no image fallback)</label>' +
                    '<div class="avatar-colors" id="avatar-colors">' +
                        ['#b11f24','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316'].map(function(c) {
                            return '<button class="avatar-color-btn' + (c === avatarColor ? ' selected' : '') + '" data-color="' + c + '" style="background:' + c + '"></button>';
                        }).join('') +
                    '</div>' +
                '</div>' +

                '<button class="account-btn account-btn-primary" id="save-profile-btn">Save Changes</button>' +
                '<div id="edit-profile-status" style="text-align:center;margin-top:0.5rem;font-size:0.8rem;"></div>' +
            '</div>';

        document.body.appendChild(overlay);
        requestAnimationFrame(function() { overlay.classList.add('visible'); });

        // Close handlers
        function closeModal() {
            var focused = overlay.querySelector(':focus');
            if (focused) focused.blur();
            overlay.classList.remove('visible');
            setTimeout(function() { overlay.remove(); window.scrollTo(0, 0); }, 200);
        }
        overlay.querySelector('.account-close').addEventListener('click', closeModal);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) closeModal(); });

        // Bio character count
        var bioInput = overlay.querySelector('#edit-bio');
        var bioCount = overlay.querySelector('#bio-count');
        bioInput.addEventListener('input', function() {
            bioCount.textContent = bioInput.value.length;
        });

        // Avatar color selection
        var selectedColor = avatarColor;
        overlay.querySelectorAll('.avatar-color-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                overlay.querySelectorAll('.avatar-color-btn').forEach(function(b) { b.classList.remove('selected'); });
                btn.classList.add('selected');
                selectedColor = btn.dataset.color;
            });
        });

        // Avatar file upload preview
        var fileInput = overlay.querySelector('#avatar-file-input');
        var pendingFile = null;
        fileInput.addEventListener('change', function() {
            var file = fileInput.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                overlay.querySelector('#edit-profile-status').textContent = 'Image must be under 2MB';
                overlay.querySelector('#edit-profile-status').style.color = '#ef4444';
                return;
            }
            pendingFile = file;
            var reader = new FileReader();
            reader.onload = function(e) {
                overlay.querySelector('#avatar-preview-wrap').innerHTML =
                    '<img src="' + e.target.result + '" class="edit-avatar-preview edit-avatar-img">';
            };
            reader.readAsDataURL(file);
        });

        // Save
        overlay.querySelector('#save-profile-btn').addEventListener('click', async function() {
            var statusEl = overlay.querySelector('#edit-profile-status');
            statusEl.textContent = 'Saving...';
            statusEl.style.color = 'rgba(255,255,255,0.6)';

            // Upload avatar if changed
            if (pendingFile) {
                var formData = new FormData();
                formData.append('avatar', pendingFile);
                try {
                    var avatarRes = await fetch('/server/php/api/upload-avatar.php', {
                        method: 'POST',
                        credentials: 'include',
                        body: formData
                    });
                    var avatarData = await avatarRes.json();
                    if (!avatarData.success) {
                        statusEl.textContent = avatarData.error || 'Avatar upload failed';
                        statusEl.style.color = '#ef4444';
                        return;
                    }
                } catch (e) {
                    statusEl.textContent = 'Avatar upload failed';
                    statusEl.style.color = '#ef4444';
                    return;
                }
            }

            // Update profile data
            try {
                var socials = {};
                ['youtube','twitch','instagram','discord','twitter','tiktok'].forEach(function(p) {
                    var val = overlay.querySelector('#social-' + p).value.trim();
                    if (val) socials[p] = val;
                });

                var ageVal = overlay.querySelector('#edit-age').value;

                var updateRes = await fetch('/server/php/api/update-profile.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        display_name: overlay.querySelector('#edit-display-name').value.trim(),
                        bio: bioInput.value.trim(),
                        avatar_color: selectedColor,
                        region: overlay.querySelector('#edit-region').value,
                        play_style: overlay.querySelector('#edit-play-style').value,
                        age: ageVal ? parseInt(ageVal) : null,
                        social_links: socials
                    })
                });
                var updateData = await updateRes.json();
                if (updateData.success) {
                    closeModal();
                    // Reload profile
                    location.reload();
                } else {
                    statusEl.textContent = 'Failed to save';
                    statusEl.style.color = '#ef4444';
                }
            } catch (e) {
                statusEl.textContent = 'Failed to save';
                statusEl.style.color = '#ef4444';
            }
        });
    }

    function renderMatchHistory(matches) {
        var container = document.getElementById('match-history');
        if (!container) return;

        if (!matches || matches.length === 0) {
            container.innerHTML = '<p class="match-empty">No matches played yet. Time to jump in!</p>';
            return;
        }

        var html = '<div class="match-list">';
        matches.forEach(function(m) {
            var won = m.won;
            var profileUser = viewingUsername || (currentUser && currentUser.username);
            var isP1 = m.player1 === profileUser;
            var opponentUsername = isP1 ? m.player2 : m.player1;
            var opponent = opponentUsername || 'AI';
            var isAI = !opponentUsername;
            var diffColors = { easy: 'var(--text-muted)', medium: 'var(--text-muted)', hard: 'var(--brand-red-light)', insane: 'var(--brand-gold)' };
            var diffLabel = m.difficulty ? (m.difficulty.charAt(0).toUpperCase() + m.difficulty.slice(1)) : 'AI Opponent';
            var diffColor = m.difficulty ? (diffColors[m.difficulty] || 'var(--text-muted)') : 'var(--text-muted)';
            var opponentLink = isAI
                ? '<span style="color:' + diffColor + ';font-weight:600;">' + escapeHtml(diffLabel) + '</span>'
                : '<a href="/profile?u=' + encodeURIComponent(opponentUsername) + '">' + escapeHtml(opponent) + '</a>';
            var duration = m.duration_seconds
                ? Math.floor(m.duration_seconds / 60) + ':' + String(m.duration_seconds % 60).padStart(2, '0')
                : '';
            var date = m.played_at
                ? new Date(m.played_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '';
            var gameType = m.game_type || 'pvp';

            html +=
                '<div class="match-item">' +
                    '<span class="match-result ' + (won ? 'match-win' : 'match-loss') + '">' + (won ? 'Win' : 'Loss') + '</span>' +
                    '<span class="match-opponent">vs ' + opponentLink + '</span>' +
                    '<div class="match-meta">' +
                        '<span class="match-type">' + escapeHtml(gameType) + '</span>' +
                        (duration ? '<span>' + duration + '</span>' : '') +
                        (date ? '<span>' + date + '</span>' : '') +
                    '</div>' +
                '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }

    function renderError(title, message, linkHref) {
        document.getElementById('profile-root').innerHTML =
            '<div class="error-state">' +
                '<div class="error-icon">&#128683;</div>' +
                '<h2>' + title + '</h2>' +
                '<p>' + message + '</p>' +
                '<a href="' + linkHref + '">&larr; Go Back</a>' +
            '</div>';
    }

    // Start
    init();
}

// ── Rules Page ──

function initRules() {
    checkAuth();
}

function initFriends() {
    (async function() {
        var user = null;
        try {
            var res = await fetch('/server/php/api/profile.php', { credentials: 'include' });
            if (res.ok) user = await res.json();
        } catch (e) {}
        if (!user || !user.username) {
            window.location.replace('/login?return=' + encodeURIComponent('/friends'));
            return;
        }
        var navBtn = document.getElementById('nav-auth');
        if (navBtn) { navBtn.textContent = user.username; navBtn.href = '/profile'; }
        window.__me = user.username;
        initFriendsInlineSearch();
        runFriendBrowse();
        loadFriendRequests();
        loadFriendsList();
    })();
}

function initFriendsInlineSearch() {
    var input = document.getElementById('player-search');
    if (!input) return;
    var timer = null;
    input.addEventListener('input', function() {
        clearTimeout(timer);
        var q = input.value.trim();
        if (q.length < 2) { timer = setTimeout(runFriendBrowse, 200); return; }
        timer = setTimeout(function() { runFriendSearch(q); }, 300);
    });
}

async function runFriendBrowse() {
    var section = document.getElementById('search-results-section');
    if (!section) return;
    try {
        var d = await (await fetch('/server/php/api/leaderboard.php?sort=elo_rating&limit=50', { credentials: 'include' })).json();
        var players = (d.leaderboard || d || []).filter(function(p) { return p.username !== window.__me; });
        section.innerHTML = renderFriendPlayerRows(players, 'All Players');
        wireFriendAddButtons(section);
    } catch (e) { section.innerHTML = ''; }
}

async function runFriendSearch(q) {
    var section = document.getElementById('search-results-section');
    if (!section) return;
    section.innerHTML = '<div class="card"><div class="shimmer"></div></div>';
    try {
        var d = await (await fetch('/server/php/api/search.php?q=' + encodeURIComponent(q) + '&limit=25', { credentials: 'include' })).json();
        var players = (d.results || []).filter(function(p) { return p.username !== window.__me; });
        section.innerHTML = renderFriendPlayerRows(players, 'Search Results');
        wireFriendAddButtons(section);
    } catch (e) { section.innerHTML = '<div class="card"><p class="empty-state">Search unavailable.</p></div>'; }
}

function renderFriendPlayerRows(players, title) {
    if (players.length === 0) return '<div class="card"><div class="card-title">' + title + '</div><p class="empty-state">No players found.</p></div>';
    var html = '<div class="card"><div class="card-title">' + title + ' <span style="color:var(--text-muted);font-weight:400;">(' + players.length + ')</span></div><div class="friends-list">';
    players.forEach(function(p) {
        var name = p.display_name || p.username;
        var initial = (name || '?').charAt(0).toUpperCase();
        var av = p.avatar_url
            ? '<img src="' + escapeAttr(p.avatar_url) + '" class="friend-row-avatar friend-avatar-img">'
            : '<div class="friend-row-avatar" style="background:' + escapeAttr(p.avatar_color || '#b11f24') + ';">' + escapeHtml(initial) + '</div>';
        var meta = 'Elo ' + (p.elo_rating || 1200) + (p.level ? ' &middot; Lvl ' + p.level : '') + (typeof p.wins !== 'undefined' ? ' &middot; ' + p.wins + 'W' : '');
        html += '<div class="friend-row">' +
            '<a href="/profile?u=' + encodeURIComponent(p.username) + '" class="friend-row-main">' + av +
                '<div class="friend-row-info"><span class="friend-row-name">' + escapeHtml(name) + '</span><span class="friend-row-meta">' + meta + '</span></div>' +
            '</a>' +
            '<button class="btn btn-primary btn-sm friend-add-btn" data-username="' + escapeAttr(p.username) + '">Add</button>' +
        '</div>';
    });
    html += '</div></div>';
    return html;
}

function wireFriendAddButtons(section) {
    section.querySelectorAll('.friend-add-btn').forEach(function(btn) {
        btn.addEventListener('click', async function() {
            var self = this;
            self.disabled = true; self.textContent = '...';
            try {
                var r = await (await fetch('/server/php/api/friends.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'send', username: self.dataset.username }) })).json();
                if (r.success) self.textContent = 'Sent';
                else if (r.error === 'Already friends') self.textContent = 'Friends';
                else if (r.error === 'Request already pending') self.textContent = 'Pending';
                else { self.textContent = r.error || 'Error'; }
            } catch (e) { self.textContent = 'Error'; self.disabled = false; }
        });
    });
}

async function loadFriendRequests() {
    var card = document.getElementById('requests-card');
    var list = document.getElementById('requests-list');
    var countEl = document.getElementById('requests-count');
    if (!list) return;
    try {
        var res = await fetch('/server/php/api/friends.php?action=requests', { credentials: 'include' });
        var data = await res.json();
        var requests = data.requests || [];
        if (requests.length === 0) { if (card) card.style.display = 'none'; return; }
        if (card) card.style.display = '';
        if (countEl) countEl.textContent = requests.length;
        list.innerHTML = requests.map(function(req) {
            var name = req.display_name || req.username;
            var av = req.avatar_url
                ? '<img src="' + escapeAttr(req.avatar_url) + '" class="friend-avatar friend-avatar-img">'
                : '<div class="friend-avatar" style="background:' + escapeAttr(req.avatar_color || '#b11f24') + ';">' + escapeHtml(name.charAt(0).toUpperCase()) + '</div>';
            return '<div class="friend-request-item" data-id="' + req.request_id + '">' +
                av +
                '<div class="friend-request-info"><span class="friend-request-name">' + escapeHtml(name) + '</span></div>' +
                '<button class="btn btn-primary btn-sm friend-accept-btn">Accept</button>' +
                '<button class="btn btn-ghost btn-sm friend-decline-btn">Decline</button>' +
            '</div>';
        }).join('');
        list.querySelectorAll('.friend-accept-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var id = this.closest('.friend-request-item').dataset.id;
                await fetch('/server/php/api/friends.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'accept', request_id: parseInt(id) }) });
                location.reload();
            });
        });
        list.querySelectorAll('.friend-decline-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var id = this.closest('.friend-request-item').dataset.id;
                await fetch('/server/php/api/friends.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'decline', request_id: parseInt(id) }) });
                var item = this.closest('.friend-request-item');
                item.parentNode.removeChild(item);
            });
        });
    } catch (e) { if (card) card.style.display = 'none'; }
}

async function loadFriendsList() {
    var container = document.getElementById('friends-list');
    var countEl = document.getElementById('friends-count');
    if (!container) return;
    try {
        var res = await fetch('/server/php/api/friends.php?action=list', { credentials: 'include' });
        var data = await res.json();
        var friends = data.friends || [];
        if (countEl) countEl.textContent = '(' + friends.length + ')';
        if (friends.length === 0) {
            container.innerHTML = '<p class="empty-state">No friends yet. Search above to find players and send requests.</p>';
            return;
        }
        container.innerHTML = friends.map(function(f) {
            var name = f.display_name || f.username;
            var initial = name.charAt(0).toUpperCase();
            var av = f.avatar_url
                ? '<img src="' + escapeAttr(f.avatar_url) + '" class="friend-row-avatar friend-avatar-img">'
                : '<div class="friend-row-avatar" style="background:' + escapeAttr(f.avatar_color || '#b11f24') + ';">' + escapeHtml(initial) + '</div>';
            var online = isRecentlyActive(f.last_active);
            var together = f.games_together ? ' &middot; ' + f.games_together + ' game' + (f.games_together == 1 ? '' : 's') + ' together' : '';
            return '<div class="friend-row">' +
                '<a href="/profile?u=' + encodeURIComponent(f.username) + '" class="friend-row-main">' +
                    av +
                    '<div class="friend-row-info">' +
                        '<span class="friend-row-name">' + escapeHtml(name) + (online ? '<span class="friend-online-dot" title="Online now"></span>' : '') + '</span>' +
                        '<span class="friend-row-meta">Elo ' + (f.elo_rating || 1200) + together + '</span>' +
                    '</div>' +
                '</a>' +
                '<button class="btn btn-ghost btn-sm friend-remove-btn" data-username="' + escapeAttr(f.username) + '">Remove</button>' +
            '</div>';
        }).join('');
        container.querySelectorAll('.friend-remove-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                if (!confirm('Remove this friend?')) return;
                var u = this.dataset.username;
                this.disabled = true;
                await fetch('/server/php/api/friends.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'remove', username: u }) }).catch(function() {});
                var row = this.closest('.friend-row');
                row.parentNode.removeChild(row);
            });
        });
    } catch (e) {
        container.innerHTML = '<p class="empty-state">Could not load friends.</p>';
    }
}

function clanEmblem(c, size) {
    var cls = 'clan-emblem' + (size === 'sm' ? ' clan-emblem-sm' : (size === 'lg' ? ' clan-emblem-lg' : ''));
    var label = c.tag ? escapeHtml(c.tag.slice(0, 3)) : escapeHtml((c.name || '?').charAt(0).toUpperCase());
    return '<div class="' + cls + '" style="background:' + escapeAttr(c.color || '#b11f24') + ';">' + label + '</div>';
}

function initClans() {
    (async function() {
        var user = null;
        try {
            var res = await fetch('/server/php/api/profile.php', { credentials: 'include' });
            if (res.ok) user = await res.json();
        } catch (e) {}
        if (!user || !user.username) {
            window.location.replace('/login?return=' + encodeURIComponent(window.location.pathname + window.location.search));
            return;
        }
        var navBtn = document.getElementById('nav-auth');
        if (navBtn) { navBtn.textContent = user.username; navBtn.href = '/profile'; }
        window.__me = user.username;
        var id = new URLSearchParams(window.location.search).get('id');
        if (id) renderClanDetail(parseInt(id));
        else renderClanHub();
    })();
}

async function renderClanHub() {
    var root = document.getElementById('clans-root');
    var mineData = {}, listData = {}, invData = { invites: [] };
    try { mineData = await (await fetch('/server/php/api/clans.php?action=mine', { credentials: 'include' })).json(); } catch (e) {}
    try { listData = await (await fetch('/server/php/api/clans.php?action=list', { credentials: 'include' })).json(); } catch (e) {}
    if (!mineData.clan) { try { invData = await (await fetch('/server/php/api/clans.php?action=my_invites', { credentials: 'include' })).json(); } catch (e) {} }
    var html = '';
    if (mineData.clan) {
        var c = mineData.clan;
        html += '<div class="card clan-mine-card">' +
            clanEmblem(c) +
            '<div class="clan-mine-info">' +
                '<div class="clan-mine-name">' + escapeHtml(c.name) + (c.tag ? ' <span class="clan-tag">[' + escapeHtml(c.tag) + ']</span>' : '') + '</div>' +
                '<div class="clan-mine-meta">' + c.member_count + ' member' + (c.member_count == 1 ? '' : 's') + ' &middot; ' + c.season_points + ' pts this season</div>' +
            '</div>' +
            '<a href="/clans?id=' + c.id + '" class="btn btn-primary btn-sm">View' + (c.pending_count ? ' (' + c.pending_count + ')' : '') + '</a>' +
        '</div>';
    } else {
        html += '<div class="card clan-create-cta">' +
            '<div><div class="clan-cta-title">You\'re not in a clan yet</div><div class="clan-cta-sub">Start one and earn clan points, or join an existing clan below.</div></div>' +
            '<button class="btn btn-primary" id="create-clan-btn">Create a Clan</button>' +
        '</div>';
    }
    if (!mineData.clan && (invData.invites || []).length) {
        html += '<div class="card"><div class="card-title">Clan Invitations <span style="color:var(--brand-red);font-weight:700;">' + invData.invites.length + '</span></div><div class="clan-rank-list">';
        invData.invites.forEach(function(iv) {
            html += '<div class="clan-rank-row clan-invite-row">' +
                clanEmblem(iv, 'sm') +
                '<div class="clan-rank-info"><span class="clan-rank-name">' + escapeHtml(iv.name) + (iv.tag ? ' <span class="clan-tag">[' + escapeHtml(iv.tag) + ']</span>' : '') + '</span>' +
                '<span class="clan-rank-meta">' + iv.member_count + ' member' + (iv.member_count == 1 ? '' : 's') + (iv.invited_by ? ' &middot; invited by ' + escapeHtml(iv.invited_by) : '') + '</span></div>' +
                '<div class="clan-member-controls"><button class="btn btn-primary btn-sm clan-inv-accept" data-id="' + iv.clan_id + '">Accept</button><button class="btn btn-ghost btn-sm clan-inv-decline" data-id="' + iv.clan_id + '">Decline</button></div>' +
            '</div>';
        });
        html += '</div></div>';
    }
    var clans = listData.clans || [];
    html += '<div class="card"><div class="card-title">Clan Rankings</div>';
    if (clans.length === 0) {
        html += '<p class="empty-state">No clans yet. Be the first to start one!</p>';
    } else {
        html += '<div class="clan-rank-list">';
        clans.forEach(function(cl) {
            html += '<a href="/clans?id=' + cl.id + '" class="clan-rank-row">' +
                '<span class="clan-rank-num">' + cl.rank + '</span>' +
                clanEmblem(cl, 'sm') +
                '<div class="clan-rank-info"><span class="clan-rank-name">' + escapeHtml(cl.name) + (cl.tag ? ' <span class="clan-tag">[' + escapeHtml(cl.tag) + ']</span>' : '') + '</span>' +
                '<span class="clan-rank-meta">' + cl.member_count + ' member' + (cl.member_count == 1 ? '' : 's') + (cl.firestorm_wins ? ' &middot; ' + cl.firestorm_wins + ' Firestorm win' + (cl.firestorm_wins == 1 ? '' : 's') : '') + '</span></div>' +
                '<span class="clan-rank-pts">' + cl.season_points + '<span class="clan-rank-pts-label">pts</span></span>' +
            '</a>';
        });
        html += '</div>';
    }
    html += '</div>';
    root.innerHTML = html;
    var cb = document.getElementById('create-clan-btn');
    if (cb) cb.addEventListener('click', showCreateClanModal);
    root.querySelectorAll('.clan-inv-accept').forEach(function(b) {
        b.addEventListener('click', async function() {
            this.disabled = true; this.textContent = '...';
            var d = await (await fetch('/server/php/api/clans.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'accept_invite', clan_id: parseInt(this.dataset.id) }) })).json();
            if (d.success) location.reload(); else this.textContent = d.error || 'Error';
        });
    });
    root.querySelectorAll('.clan-inv-decline').forEach(function(b) {
        b.addEventListener('click', async function() {
            await fetch('/server/php/api/clans.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'decline_invite', clan_id: parseInt(this.dataset.id) }) });
            location.reload();
        });
    });
}

async function renderClanDetail(id) {
    var root = document.getElementById('clans-root');
    var data = {};
    try { data = await (await fetch('/server/php/api/clans.php?action=get&id=' + id, { credentials: 'include' })).json(); } catch (e) {}
    if (!data.clan) { root.innerHTML = '<div class="card"><p class="empty-state">Clan not found. <a href="/clans">Back to clans</a></p></div>'; return; }
    var c = data.clan;
    var isMember = c.relation === 'member';
    var isLeader = c.my_role === 'leader';
    var isOfficer = isLeader || c.my_role === 'officer';

    var html = '<a href="/clans" class="clan-back">&larr; All Clans</a>';
    html += '<div class="card clan-detail-header">' +
        clanEmblem(c, 'lg') +
        '<div class="clan-detail-name">' + escapeHtml(c.name) + (c.tag ? ' <span class="clan-tag">[' + escapeHtml(c.tag) + ']</span>' : '') + '</div>' +
        (c.description ? '<p class="clan-detail-desc">' + escapeHtml(c.description) + '</p>' : '') +
        '<div class="clan-detail-stats">' +
            '<div><span class="clan-stat-val">' + c.season_points + '</span><span class="clan-stat-lbl">Season Pts</span></div>' +
            '<div><span class="clan-stat-val">' + c.member_count + '/20</span><span class="clan-stat-lbl">Members</span></div>' +
            '<div><span class="clan-stat-val">' + (c.firestorm_wins || 0) + '</span><span class="clan-stat-lbl">Firestorm W</span></div>' +
            '<div><span class="clan-stat-val">' + c.total_points + '</span><span class="clan-stat-lbl">All-Time</span></div>' +
        '</div>' +
        '<div class="clan-detail-actions" id="clan-actions"></div>' +
    '</div>';
    if (isMember) html += '<div id="firestorm-section"><div class="shimmer"></div></div>';
    if (isOfficer) html += '<div class="card" id="clan-requests-card" style="display:none;"><div class="card-title">Join Requests <span id="clan-req-count" style="color:var(--brand-red);font-weight:700;"></span></div><div id="clan-requests-list"></div></div>';
    if (isOfficer) html += '<div class="card"><div class="card-title">Invite Players</div>' +
        '<div class="friends-search-wrap" style="margin:0 0 0.75rem;"><input type="text" class="search-input" id="clan-invite-search" placeholder="Search players to invite..." autocomplete="off"></div>' +
        '<div id="clan-invite-results"></div>' +
        '<div id="clan-sent-invites"></div></div>';
    html += '<div class="card"><div class="card-title">Roster</div><div class="clan-roster">';
    c.members.forEach(function(mem) { html += renderClanMemberRow(mem, isLeader, isOfficer); });
    html += '</div></div>';
    root.innerHTML = html;

    renderClanActionButton(c);
    if (isMember) {
        wireRosterActions();
        loadFirestormSection(id, c, isOfficer);
        if (isOfficer) { loadClanRequests(); initClanInvite(c); }
    }
}

function renderClanMemberRow(mem, isLeader, isOfficer) {
    var name = mem.display_name || mem.username;
    var av = mem.avatar_url
        ? '<img src="' + escapeAttr(mem.avatar_url) + '" class="friend-row-avatar friend-avatar-img">'
        : '<div class="friend-row-avatar" style="background:' + escapeAttr(mem.avatar_color || '#b11f24') + ';">' + escapeHtml(name.charAt(0).toUpperCase()) + '</div>';
    var online = isRecentlyActive(mem.last_active);
    var roleBadge = mem.role === 'leader' ? '<span class="clan-role clan-role-leader">Leader</span>' : (mem.role === 'officer' ? '<span class="clan-role clan-role-officer">Officer</span>' : '');
    var controls = '';
    if (isOfficer && mem.role !== 'leader') {
        controls = '<div class="clan-member-controls">';
        if (isLeader && mem.role === 'member') controls += '<button class="btn btn-ghost btn-sm clan-promote-btn" data-u="' + escapeAttr(mem.username) + '">Promote</button>';
        if (isLeader && mem.role === 'officer') controls += '<button class="btn btn-ghost btn-sm clan-demote-btn" data-u="' + escapeAttr(mem.username) + '">Demote</button>';
        if (isLeader || mem.role === 'member') controls += '<button class="btn btn-ghost btn-sm clan-kick-btn" data-u="' + escapeAttr(mem.username) + '">Remove</button>';
        controls += '</div>';
    }
    return '<div class="friend-row clan-member-row">' +
        '<a href="/profile?u=' + encodeURIComponent(mem.username) + '" class="friend-row-main">' +
            av +
            '<div class="friend-row-info"><span class="friend-row-name">' + escapeHtml(name) + (online ? '<span class="friend-online-dot"></span>' : '') + roleBadge + '</span>' +
            '<span class="friend-row-meta">' + mem.season_points + ' pts &middot; Elo ' + (mem.elo_rating || 1200) + '</span></div>' +
        '</a>' + controls +
    '</div>';
}

function renderClanActionButton(c) {
    var el = document.getElementById('clan-actions');
    if (!el) return;
    if (c.relation === 'can_join') {
        el.innerHTML = '<button class="btn btn-primary" id="clan-join-btn">' + (c.is_open == 1 ? 'Join Clan' : 'Request to Join') + '</button>';
        document.getElementById('clan-join-btn').addEventListener('click', async function() {
            this.disabled = true; this.textContent = '...';
            var d = await (await fetch('/server/php/api/clans.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'join', clan_id: c.id }) })).json();
            if (d.joined) location.reload();
            else if (d.requested) this.textContent = 'Request Sent';
            else { this.textContent = d.error || 'Error'; }
        });
    } else if (c.relation === 'invited') {
        el.innerHTML = '<button class="btn btn-primary btn-sm" id="clan-accept-inv">Accept Invite</button> <button class="btn btn-ghost btn-sm" id="clan-decline-inv">Decline</button>';
        document.getElementById('clan-accept-inv').addEventListener('click', async function() {
            this.disabled = true; this.textContent = '...';
            var d = await (await fetch('/server/php/api/clans.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'accept_invite', clan_id: c.id }) })).json();
            if (d.success) location.reload(); else this.textContent = d.error || 'Error';
        });
        document.getElementById('clan-decline-inv').addEventListener('click', async function() {
            await fetch('/server/php/api/clans.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'decline_invite', clan_id: c.id }) });
            window.location.href = '/clans';
        });
    } else if (c.relation === 'requested') {
        el.innerHTML = '<button class="btn btn-ghost" disabled>Request Pending</button>';
    } else if (c.relation === 'in_other_clan') {
        el.innerHTML = '<button class="btn btn-ghost" disabled>You\'re in another clan</button>';
    } else if (c.relation === 'member') {
        var btns = '';
        if (c.my_role === 'leader') {
            btns += '<button class="btn btn-ghost btn-sm" id="clan-edit-btn">Edit</button>';
            btns += '<button class="btn btn-ghost btn-sm" id="clan-disband-btn">Disband</button>';
        }
        btns += '<button class="btn btn-ghost btn-sm" id="clan-leave-btn">Leave Clan</button>';
        el.innerHTML = btns;
        var lb = document.getElementById('clan-leave-btn');
        if (lb) lb.addEventListener('click', async function() {
            if (!confirm('Leave this clan?')) return;
            await fetch('/server/php/api/clans.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'leave' }) });
            window.location.href = '/clans';
        });
        var disb = document.getElementById('clan-disband-btn');
        if (disb) disb.addEventListener('click', async function() {
            if (!confirm('Disband the clan permanently? This cannot be undone.')) return;
            await fetch('/server/php/api/clans.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'disband' }) });
            window.location.href = '/clans';
        });
        var eb = document.getElementById('clan-edit-btn');
        if (eb) eb.addEventListener('click', function() { showEditClanModal(c); });
    }
}

function wireRosterActions() {
    var root = document.getElementById('clans-root');
    function act(action, username) {
        return fetch('/server/php/api/clans.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: action, username: username }) });
    }
    root.querySelectorAll('.clan-kick-btn').forEach(function(b) { b.addEventListener('click', async function() { if (!confirm('Remove ' + this.dataset.u + ' from the clan?')) return; await act('kick', this.dataset.u); location.reload(); }); });
    root.querySelectorAll('.clan-promote-btn').forEach(function(b) { b.addEventListener('click', async function() { await act('promote', this.dataset.u); location.reload(); }); });
    root.querySelectorAll('.clan-demote-btn').forEach(function(b) { b.addEventListener('click', async function() { await act('demote', this.dataset.u); location.reload(); }); });
}

function initClanInvite(c) {
    var memberSet = {};
    (c.members || []).forEach(function(m) { memberSet[m.username] = true; });
    var input = document.getElementById('clan-invite-search');
    if (input) {
        var timer = null;
        input.addEventListener('input', function() {
            clearTimeout(timer);
            var q = input.value.trim();
            var results = document.getElementById('clan-invite-results');
            if (q.length < 2) { if (results) results.innerHTML = ''; return; }
            timer = setTimeout(function() { runClanInviteSearch(q, memberSet); }, 300);
        });
    }
    loadSentInvites();
}

async function runClanInviteSearch(q, memberSet) {
    var section = document.getElementById('clan-invite-results');
    if (!section) return;
    try {
        var d = await (await fetch('/server/php/api/search.php?q=' + encodeURIComponent(q) + '&limit=20', { credentials: 'include' })).json();
        var players = (d.results || []).filter(function(p) { return p.username !== window.__me && !memberSet[p.username]; });
        if (players.length === 0) { section.innerHTML = '<p class="empty-state">No players found.</p>'; return; }
        var html = '<div class="friends-list">';
        players.forEach(function(p) {
            var name = p.display_name || p.username;
            var initial = (name || '?').charAt(0).toUpperCase();
            var av = p.avatar_url
                ? '<img src="' + escapeAttr(p.avatar_url) + '" class="friend-row-avatar friend-avatar-img">'
                : '<div class="friend-row-avatar" style="background:' + escapeAttr(p.avatar_color || '#b11f24') + ';">' + escapeHtml(initial) + '</div>';
            html += '<div class="friend-row">' +
                '<a href="/profile?u=' + encodeURIComponent(p.username) + '" class="friend-row-main">' + av +
                    '<div class="friend-row-info"><span class="friend-row-name">' + escapeHtml(name) + '</span><span class="friend-row-meta">Elo ' + (p.elo_rating || 1200) + '</span></div>' +
                '</a>' +
                '<button class="btn btn-primary btn-sm clan-invite-btn" data-username="' + escapeAttr(p.username) + '">Invite</button>' +
            '</div>';
        });
        html += '</div>';
        section.innerHTML = html;
        section.querySelectorAll('.clan-invite-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var self = this; self.disabled = true; self.textContent = '...';
                try {
                    var r = await (await fetch('/server/php/api/clans.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'invite', username: self.dataset.username }) })).json();
                    if (r.success) { self.textContent = 'Invited'; loadSentInvites(); }
                    else { self.textContent = r.error || 'Error'; }
                } catch (e) { self.textContent = 'Error'; }
            });
        });
    } catch (e) { section.innerHTML = ''; }
}

async function loadSentInvites() {
    var el = document.getElementById('clan-sent-invites');
    if (!el) return;
    try {
        var d = await (await fetch('/server/php/api/clans.php?action=sent_invites', { credentials: 'include' })).json();
        var invites = d.invites || [];
        if (invites.length === 0) { el.innerHTML = ''; return; }
        var html = '<div class="clan-sent-title">Pending Invites (' + invites.length + ')</div><div class="friends-list">';
        invites.forEach(function(iv) {
            var name = iv.display_name || iv.username;
            var av = iv.avatar_url
                ? '<img src="' + escapeAttr(iv.avatar_url) + '" class="friend-row-avatar friend-avatar-img">'
                : '<div class="friend-row-avatar" style="background:' + escapeAttr(iv.avatar_color || '#b11f24') + ';">' + escapeHtml(name.charAt(0).toUpperCase()) + '</div>';
            html += '<div class="friend-row">' +
                '<div class="friend-row-main">' + av + '<div class="friend-row-info"><span class="friend-row-name">' + escapeHtml(name) + '</span><span class="friend-row-meta">Elo ' + (iv.elo_rating || 1200) + '</span></div></div>' +
                '<button class="btn btn-ghost btn-sm clan-cancel-inv-btn" data-username="' + escapeAttr(iv.username) + '">Cancel</button>' +
            '</div>';
        });
        html += '</div>';
        el.innerHTML = html;
        el.querySelectorAll('.clan-cancel-inv-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var self = this; self.disabled = true; self.textContent = '...';
                await fetch('/server/php/api/clans.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'cancel_invite', username: self.dataset.username }) });
                loadSentInvites();
            });
        });
    } catch (e) { el.innerHTML = ''; }
}

async function loadClanRequests() {
    var card = document.getElementById('clan-requests-card');
    var list = document.getElementById('clan-requests-list');
    var countEl = document.getElementById('clan-req-count');
    if (!list) return;
    try {
        var data = await (await fetch('/server/php/api/clans.php?action=requests', { credentials: 'include' })).json();
        var reqs = data.requests || [];
        if (reqs.length === 0) { if (card) card.style.display = 'none'; return; }
        if (card) card.style.display = '';
        if (countEl) countEl.textContent = reqs.length;
        list.innerHTML = reqs.map(function(req) {
            var name = req.display_name || req.username;
            var av = req.avatar_url
                ? '<img src="' + escapeAttr(req.avatar_url) + '" class="friend-avatar friend-avatar-img">'
                : '<div class="friend-avatar" style="background:' + escapeAttr(req.avatar_color || '#b11f24') + ';">' + escapeHtml(name.charAt(0).toUpperCase()) + '</div>';
            return '<div class="friend-request-item" data-id="' + req.request_id + '">' + av +
                '<div class="friend-request-info"><span class="friend-request-name">' + escapeHtml(name) + '</span></div>' +
                '<button class="btn btn-primary btn-sm clan-approve-btn">Approve</button>' +
                '<button class="btn btn-ghost btn-sm clan-req-decline-btn">Decline</button></div>';
        }).join('');
        list.querySelectorAll('.clan-approve-btn').forEach(function(b) {
            b.addEventListener('click', async function() {
                var rid = this.closest('.friend-request-item').dataset.id;
                await fetch('/server/php/api/clans.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'approve', request_id: parseInt(rid) }) });
                location.reload();
            });
        });
        list.querySelectorAll('.clan-req-decline-btn').forEach(function(b) {
            b.addEventListener('click', async function() {
                var rid = this.closest('.friend-request-item').dataset.id;
                await fetch('/server/php/api/clans.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'decline', request_id: parseInt(rid) }) });
                var item = this.closest('.friend-request-item'); item.parentNode.removeChild(item);
            });
        });
    } catch (e) { if (card) card.style.display = 'none'; }
}

var CLAN_COLORS = ['#b11f24', '#e8792b', '#f5a623', '#3fb950', '#2dd4bf', '#3b82f6', '#8b5cf6', '#ec4899'];

function buildColorSwatches(wrap, initial, onPick) {
    var selected = initial || CLAN_COLORS[0];
    CLAN_COLORS.forEach(function(col) {
        var sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'color-swatch' + (col.toLowerCase() === selected.toLowerCase() ? ' selected' : '');
        sw.style.background = col;
        sw.addEventListener('click', function() {
            selected = col;
            wrap.querySelectorAll('.color-swatch').forEach(function(x) { x.classList.remove('selected'); });
            sw.classList.add('selected');
            onPick(col);
        });
        wrap.appendChild(sw);
    });
    return selected;
}

function showCreateClanModal() {
    var selectedColor = CLAN_COLORS[0];
    var overlay = document.createElement('div');
    overlay.className = 'account-overlay';
    overlay.innerHTML = '<div class="account-modal" style="max-width:420px;">' +
        '<button class="account-close">&times;</button>' +
        '<h2 style="color:white;text-align:center;margin-bottom:0.25rem;">Create a Clan</h2>' +
        '<p class="firestorm-status" style="text-align:center;margin-bottom:1.25rem;">Name it, pick a color, and you\'re in.</p>' +
        '<div class="form-group"><label class="form-label" for="cc-name">Clan Name</label><input class="form-input" id="cc-name" maxlength="24" placeholder="3-24 characters"></div>' +
        '<div class="form-group"><label class="form-label" for="cc-tag">Tag (optional)</label><input class="form-input" id="cc-tag" maxlength="5" placeholder="e.g. ASH" style="text-transform:uppercase;"></div>' +
        '<div class="form-group"><label class="form-label">Clan Color</label><div class="color-swatches" id="cc-swatches"></div></div>' +
        '<div class="form-group"><label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;color:var(--text-secondary);"><input type="checkbox" id="cc-open" checked> Anyone can join instantly</label></div>' +
        '<button class="btn btn-primary btn-lg" id="cc-submit" style="width:100%;">Create Clan</button>' +
        '<div id="cc-error" style="color:var(--danger, #ef4444);font-size:0.85rem;text-align:center;min-height:1.1rem;margin-top:0.6rem;"></div>' +
    '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('visible'); });
    buildColorSwatches(overlay.querySelector('#cc-swatches'), selectedColor, function(col) { selectedColor = col; });
    function close() { overlay.remove(); }
    overlay.querySelector('.account-close').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    overlay.querySelector('#cc-submit').addEventListener('click', async function() {
        var name = overlay.querySelector('#cc-name').value.trim();
        var err = overlay.querySelector('#cc-error');
        if (name.length < 3) { err.textContent = 'Name must be at least 3 characters'; return; }
        this.disabled = true; this.textContent = 'Creating...';
        var body = { action: 'create', name: name, tag: overlay.querySelector('#cc-tag').value.trim(), description: '', color: selectedColor, is_open: overlay.querySelector('#cc-open').checked ? 1 : 0 };
        try {
            var d = await (await fetch('/server/php/api/clans.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify(body) })).json();
            if (d.success) window.location.href = '/clans?id=' + d.clan_id;
            else { err.textContent = d.error || 'Could not create clan'; this.disabled = false; this.textContent = 'Create Clan'; }
        } catch (e) { err.textContent = 'Connection error'; this.disabled = false; this.textContent = 'Create Clan'; }
    });
}

function showEditClanModal(c) {
    var overlay = document.createElement('div');
    overlay.className = 'account-overlay';
    overlay.innerHTML = '<div class="account-modal" style="max-width:420px;">' +
        '<button class="account-close">&times;</button>' +
        '<h2 style="color:white;text-align:center;margin-bottom:1.25rem;">Edit Clan</h2>' +
        '<div class="form-group"><label class="form-label" for="ec-desc">Description</label><textarea class="form-input" id="ec-desc" maxlength="200" rows="2">' + escapeHtml(c.description || '') + '</textarea></div>' +
        '<div class="form-group"><label class="form-label">Clan Color</label><div class="color-swatches" id="ec-swatches"></div></div>' +
        '<div class="form-group"><label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;color:var(--text-secondary);"><input type="checkbox" id="ec-open" ' + (c.is_open == 1 ? 'checked' : '') + '> Anyone can join instantly</label></div>' +
        '<button class="btn btn-primary btn-lg" id="ec-submit" style="width:100%;">Save Changes</button>' +
    '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('visible'); });
    var selectedColor = c.color || CLAN_COLORS[0];
    buildColorSwatches(overlay.querySelector('#ec-swatches'), selectedColor, function(col) { selectedColor = col; });
    function close() { overlay.remove(); }
    overlay.querySelector('.account-close').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    overlay.querySelector('#ec-submit').addEventListener('click', async function() {
        this.disabled = true; this.textContent = 'Saving...';
        await fetch('/server/php/api/clans.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'update', description: overlay.querySelector('#ec-desc').value.trim(), color: selectedColor, is_open: overlay.querySelector('#ec-open').checked ? 1 : 0 }) });
        location.reload();
    });
}

function fsTimeLeft(ends) {
    var t = new Date(ends.replace(' ', 'T') + 'Z').getTime();
    var diff = t - Date.now();
    if (isNaN(t) || diff <= 0) return 'ending';
    var h = Math.floor(diff / 3600000);
    var mnt = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? (h + 'h ' + mnt + 'm') : (mnt + 'm');
}

async function loadFirestormSection(clanId, clan, isOfficer) {
    var el = document.getElementById('firestorm-section');
    if (!el) return;
    var data = {};
    try { data = await (await fetch('/server/php/api/firestorm.php?action=mine', { credentials: 'include' })).json(); } catch (e) {}
    var list = data.firestorms || [];
    var active = null, open = null, recent = null;
    list.forEach(function(f) {
        if (f.status === 'active' && !active) active = f;
        else if (f.status === 'open' && !open) open = f;
        else if (f.status === 'complete' && !recent) recent = f;
    });
    var html = '<div class="card firestorm-card"><div class="card-title">&#128293; Firestorm</div>';
    if (active) {
        html += renderFirestormActive(active);
    } else if (open) {
        html += '<p class="firestorm-status">Waiting for a challenger to accept your Firestorm&hellip;</p>';
        if (isOfficer) html += '<div class="clan-detail-actions"><button class="btn btn-ghost btn-sm" id="fs-cancel-btn" data-id="' + open.id + '">Cancel Firestorm</button></div>';
    } else {
        html += '<p class="firestorm-status">No active Firestorm. Challenge another clan to a 24-hour war &mdash; your Seed 1 faces their Seed 1, and the clan that wins the most matchups wins.</p>';
        if (isOfficer) html += '<div class="clan-detail-actions"><button class="btn btn-primary btn-sm" id="fs-start-btn">Start a Firestorm</button><button class="btn btn-ghost btn-sm" id="fs-browse-btn">Find a Firestorm</button></div>';
        else html += '<p class="firestorm-status" style="font-size:0.8rem;">Only a leader or officer can start one.</p>';
        if (recent) html += renderFirestormResult(recent);
    }
    html += '</div>';
    el.innerHTML = html;
    var startBtn = document.getElementById('fs-start-btn');
    if (startBtn) startBtn.addEventListener('click', function() { showFirestormLineupModal(clan, 'create', null); });
    var browseBtn = document.getElementById('fs-browse-btn');
    if (browseBtn) browseBtn.addEventListener('click', function() { showFirestormBrowseModal(clan); });
    var cancelBtn = document.getElementById('fs-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', async function() {
        if (!confirm('Cancel this Firestorm?')) return;
        await fetch('/server/php/api/firestorm.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'cancel', firestorm_id: parseInt(this.dataset.id) }) });
        location.reload();
    });
    if (active) wireFirestormMatch();
}

function renderFirestormActive(fs) {
    var oppName = fs.is_challenger ? (fs.opponent_name || 'Opponent') : (fs.challenger_name || 'Challenger');
    var myScore = fs.is_challenger ? fs.challenger_score : fs.opponent_score;
    var oppScore = fs.is_challenger ? fs.opponent_score : fs.challenger_score;
    var ends = fs.ends_at ? fsTimeLeft(fs.ends_at) : '';
    var h = '<div class="firestorm-vs"><span class="firestorm-score">' + myScore + '</span><span class="firestorm-vs-mid">vs ' + escapeHtml(oppName) + (ends ? '<br>' + ends + ' left' : '') + '</span><span class="firestorm-score">' + oppScore + '</span></div>';
    h += '<div class="firestorm-matches">';
    (fs.matches || []).forEach(function(m) { m._fid = fs.id; h += renderFirestormMatchRow(m); });
    h += '</div>';
    return h;
}

function renderFirestormMatchRow(m) {
    var me = window.__me;
    var amChallenger = (me === m.challenger_name);
    var amOpponent = (me === m.opponent_name);
    var cName = escapeHtml(m.challenger_name || 'TBD');
    var oName = escapeHtml(m.opponent_name || 'TBD');
    var label = 'Seed ' + m.seed + ': ' + cName + ' vs ' + oName;
    var right;
    if (m.status === 'complete') {
        var challengerWon = (m.winner_user_id && m.winner_user_id == m.challenger_user_id);
        var winnerName = challengerWon ? cName : oName;
        var iWon = (amChallenger && challengerWon) || (amOpponent && !challengerWon);
        right = '<span class="firestorm-result-tag ' + (iWon ? 'firestorm-won' : '') + '">' + winnerName + ' won</span>';
    } else if (amChallenger) {
        right = '<a href="/play?firestorm=' + m._fid + '&seed=' + m.seed + '&role=host" class="btn btn-primary btn-sm">Play (host)</a>';
    } else if (amOpponent) {
        right = '<button class="btn btn-primary btn-sm fs-join-btn" data-fid="' + m._fid + '" data-seed="' + m.seed + '">Join Match</button>';
    } else {
        right = '<span class="firestorm-result-tag">' + (m.room_code ? 'in progress' : 'pending') + '</span>';
    }
    return '<div class="firestorm-match-row"><span class="firestorm-match-label">' + label + '</span>' + right + '</div>';
}

function wireFirestormMatch() {
    document.querySelectorAll('.fs-join-btn').forEach(function(btn) {
        btn.addEventListener('click', async function() {
            var fid = this.dataset.fid, seed = this.dataset.seed, self = this;
            self.disabled = true; self.textContent = 'Checking...';
            try {
                var d = await (await fetch('/server/php/api/firestorm.php?action=get_room&firestorm_id=' + fid + '&seed=' + seed, { credentials: 'include' })).json();
                if (d.room_code) { window.location.href = '/play?join=' + d.room_code + '&firestorm=' + fid + '&seed=' + seed; }
                else { self.textContent = 'Host not ready yet'; setTimeout(function() { self.disabled = false; self.textContent = 'Join Match'; }, 2500); }
            } catch (e) { self.disabled = false; self.textContent = 'Join Match'; }
        });
    });
}

function renderFirestormResult(fs) {
    var myScore = fs.is_challenger ? fs.challenger_score : fs.opponent_score;
    var oppScore = fs.is_challenger ? fs.opponent_score : fs.challenger_score;
    var oppName = fs.is_challenger ? (fs.opponent_name || 'Opponent') : (fs.challenger_name || 'Challenger');
    var myClanWon = fs.winner_clan_id && ((fs.is_challenger && fs.winner_clan_id == fs.challenger_clan_id) || (!fs.is_challenger && fs.winner_clan_id == fs.opponent_clan_id));
    var outcome = fs.winner_clan_id ? (myClanWon ? 'Victory' : 'Defeat') : 'Draw';
    return '<div class="firestorm-recent"><strong>Last Firestorm: ' + outcome + '</strong> vs ' + escapeHtml(oppName) + ' (' + myScore + '&ndash;' + oppScore + ')</div>';
}

function showFirestormLineupModal(clan, mode, firestorm) {
    var members = clan.members || [];
    var maxRoster = Math.min(10, members.length);
    var fixedSize = (firestorm && firestorm.roster_size) ? firestorm.roster_size : null;
    var overlay = document.createElement('div');
    overlay.className = 'account-overlay';
    function memberOptions(sel) {
        return members.map(function(m) { return '<option value="' + escapeAttr(m.username) + '"' + (sel === m.username ? ' selected' : '') + '>' + escapeHtml(m.display_name || m.username) + '</option>'; }).join('');
    }
    function seedSelects(n) {
        var h = '';
        for (var i = 1; i <= n; i++) {
            h += '<div class="form-group"><label class="form-label">Seed ' + i + (i === 1 ? ' (strongest)' : '') + '</label><select class="form-input fs-seed-select" data-seed="' + i + '"><option value="">&mdash; pick a member &mdash;</option>' + memberOptions(members[i - 1] ? members[i - 1].username : '') + '</select></div>';
        }
        return h;
    }
    var title = mode === 'create' ? 'Start a Firestorm' : (mode === 'random' ? 'Random Firestorm' : 'Accept Firestorm');
    var submitLabel = mode === 'create' ? 'Create Firestorm' : (mode === 'random' ? 'Find & Start' : 'Accept & Start');
    var sizeControl = fixedSize ? '<p class="firestorm-status" style="text-align:center;">Roster size: <strong>' + fixedSize + 'v' + fixedSize + '</strong></p>' : '<div class="form-group"><label class="form-label" for="fs-roster">Roster size</label><select class="form-input" id="fs-roster"></select></div>';
    overlay.innerHTML = '<div class="account-modal" style="max-width:420px;max-height:90vh;overflow-y:auto;">' +
        '<button class="account-close">&times;</button>' +
        '<h2 style="color:white;text-align:center;margin-bottom:0.5rem;">' + title + '</h2>' +
        '<p class="firestorm-status" style="text-align:center;margin-bottom:1rem;">Pick your lineup in seed order. Seed 1 faces their Seed 1.</p>' +
        sizeControl +
        '<div id="fs-seeds">' + seedSelects(fixedSize || Math.min(5, maxRoster)) + '</div>' +
        '<button class="btn btn-primary btn-lg" id="fs-submit" style="width:100%;">' + submitLabel + '</button>' +
        '<div id="fs-error" style="color:var(--danger, #ef4444);font-size:0.85rem;text-align:center;min-height:1.1rem;margin-top:0.6rem;"></div>' +
    '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('visible'); });
    function close() { overlay.remove(); }
    overlay.querySelector('.account-close').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    if (!fixedSize) {
        var rosterSel = overlay.querySelector('#fs-roster');
        for (var s = 1; s <= maxRoster; s++) {
            var opt = document.createElement('option');
            opt.value = s; opt.textContent = s + 'v' + s;
            if (s === Math.min(5, maxRoster)) opt.selected = true;
            rosterSel.appendChild(opt);
        }
        rosterSel.addEventListener('change', function() { overlay.querySelector('#fs-seeds').innerHTML = seedSelects(parseInt(this.value)); });
    }
    overlay.querySelector('#fs-submit').addEventListener('click', async function() {
        var selects = overlay.querySelectorAll('.fs-seed-select');
        var lineup = [], used = {}, ok = true;
        selects.forEach(function(sel) { var v = sel.value; if (!v || used[v]) ok = false; used[v] = true; lineup.push(v); });
        var err = overlay.querySelector('#fs-error');
        if (!ok) { err.textContent = 'Pick a different member for each seed'; return; }
        this.disabled = true; this.textContent = 'Working...';
        var body = mode === 'create' ? { action: 'create', roster_size: lineup.length, lineup: lineup }
            : (mode === 'random' ? { action: 'random', lineup: lineup } : { action: 'accept', firestorm_id: firestorm.id, lineup: lineup });
        try {
            var d = await (await fetch('/server/php/api/firestorm.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify(body) })).json();
            if (d.success) location.reload();
            else { err.textContent = d.error || 'Error'; this.disabled = false; this.textContent = submitLabel; }
        } catch (e) { err.textContent = 'Connection error'; this.disabled = false; this.textContent = submitLabel; }
    });
}

async function showFirestormBrowseModal(clan) {
    var overlay = document.createElement('div');
    overlay.className = 'account-overlay';
    overlay.innerHTML = '<div class="account-modal" style="max-width:460px;max-height:90vh;overflow-y:auto;">' +
        '<button class="account-close">&times;</button>' +
        '<h2 style="color:white;text-align:center;margin-bottom:0.5rem;">Find a Firestorm</h2>' +
        '<div class="clan-detail-actions" style="margin-bottom:1rem;"><button class="btn btn-primary btn-sm" id="fs-random-btn">Random Match</button></div>' +
        '<div id="fs-open-list"><div class="shimmer"></div></div>' +
    '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('visible'); });
    function close() { overlay.remove(); }
    overlay.querySelector('.account-close').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    overlay.querySelector('#fs-random-btn').addEventListener('click', function() { close(); showFirestormLineupModal(clan, 'random', null); });
    var listEl = overlay.querySelector('#fs-open-list');
    try {
        var d = await (await fetch('/server/php/api/firestorm.php?action=open', { credentials: 'include' })).json();
        var opens = d.firestorms || [];
        if (opens.length === 0) { listEl.innerHTML = '<p class="empty-state">No open Firestorms right now. Start your own, or check back later.</p>'; return; }
        listEl.innerHTML = opens.map(function(f) {
            return '<div class="firestorm-open-row"><div><div class="clan-rank-name">' + escapeHtml(f.name) + (f.tag ? ' <span class="clan-tag">[' + escapeHtml(f.tag) + ']</span>' : '') + '</div><div class="clan-rank-meta">' + f.member_count + ' members &middot; ' + f.roster_size + 'v' + f.roster_size + '</div></div><button class="btn btn-primary btn-sm fs-accept-btn" data-id="' + f.id + '" data-roster="' + f.roster_size + '">Accept</button></div>';
        }).join('');
        listEl.querySelectorAll('.fs-accept-btn').forEach(function(b) {
            b.addEventListener('click', function() {
                close();
                showFirestormLineupModal(clan, 'accept', { id: parseInt(this.dataset.id), roster_size: parseInt(this.dataset.roster) });
            });
        });
    } catch (e) { listEl.innerHTML = '<p class="empty-state">Could not load Firestorms.</p>'; }
}

function initAdmin() {
    (async function() {
        var user = null;
        try { var r = await fetch('/server/php/api/profile.php', { credentials: 'include' }); if (r.ok) user = await r.json(); } catch (e) {}
        if (!user || !user.username) { window.location.replace('/login?return=/admin'); return; }
        var navBtn = document.getElementById('nav-auth');
        if (navBtn) { navBtn.textContent = user.username; navBtn.href = '/profile'; }
        var root = document.getElementById('admin-root');
        var chk = {};
        try { chk = await (await fetch('/server/php/api/admin.php?action=check', { credentials: 'include' })).json(); } catch (e) {}
        if (!chk.is_admin) { root.innerHTML = '<div class="card"><p class="empty-state">You don\'t have admin access.</p></div>'; return; }
        root.innerHTML = '<div id="admin-overview"><div class="shimmer"></div></div><div id="admin-bugs"></div><div id="admin-clans"></div><div id="admin-users"></div>';
        loadAdminOverview();
        loadAdminBugs();
        loadAdminClans();
        loadAdminUsers();
    })();
}

function adminStatBox(v, l) {
    return '<div class="stat-item"><div class="stat-value">' + (v || 0) + '</div><div class="stat-label">' + l + '</div></div>';
}

async function loadAdminOverview() {
    var el = document.getElementById('admin-overview');
    if (!el) return;
    var stats = {}, season = {};
    try { stats = await (await fetch('/server/php/api/admin.php?action=stats', { credentials: 'include' })).json(); } catch (e) {}
    try { season = await (await fetch('/server/php/api/admin.php?action=season_current', { credentials: 'include' })).json(); } catch (e) {}
    var html = '<div class="card"><div class="card-title">Overview</div><div class="stats-grid">' +
        adminStatBox(stats.users, 'Users') + adminStatBox(stats.clans, 'Clans') +
        adminStatBox(stats.active_firestorms, 'Active Firestorms') + adminStatBox(stats.new_bugs, 'New Bugs') +
        '</div></div>';
    html += '<div class="card"><div class="card-title">Season</div>';
    if (season.season) {
        html += '<p class="firestorm-status">Active: <strong>' + escapeHtml(season.season.name) + '</strong>' + (season.season.started_at ? ' (started ' + escapeHtml(season.season.started_at) + ')' : '') + '</p>' +
            '<div class="clan-detail-actions"><button class="btn btn-primary btn-sm" id="admin-end-season">End Season &amp; Crown Champion</button></div>';
    } else {
        html += '<p class="firestorm-status">No active season.' + (season.last_champion ? ' Last champion: <strong>' + escapeHtml(season.last_champion.clan_name || '') + '</strong> (' + escapeHtml(season.last_champion.name || '') + ').' : '') + '</p>' +
            '<div class="clan-detail-actions"><button class="btn btn-primary btn-sm" id="admin-start-season">Start New Season</button></div>';
    }
    html += '</div>';
    el.innerHTML = html;
    var startBtn = document.getElementById('admin-start-season');
    if (startBtn) startBtn.addEventListener('click', async function() {
        var name = prompt('Season name (leave blank for auto):', '') || '';
        this.disabled = true;
        await fetch('/server/php/api/admin.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'season_start', name: name }) });
        location.reload();
    });
    var endBtn = document.getElementById('admin-end-season');
    if (endBtn) endBtn.addEventListener('click', async function() {
        if (!confirm('End the season now? This crowns the top clan, awards the champion badge to its members, and resets all season points to 0.')) return;
        this.disabled = true;
        await fetch('/server/php/api/admin.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'season_end' }) });
        location.reload();
    });
}

async function loadAdminBugs() {
    var el = document.getElementById('admin-bugs');
    if (!el) return;
    var d = {};
    try { d = await (await fetch('/server/php/api/admin.php?action=bug_reports', { credentials: 'include' })).json(); } catch (e) {}
    var bugs = d.bugs || [];
    var html = '<div class="card"><div class="card-title">Bug Reports <span style="color:var(--text-muted);font-weight:400;">(' + bugs.length + ')</span></div>';
    if (bugs.length === 0) { html += '<p class="empty-state">No bug reports.</p>'; }
    else {
        html += '<div class="admin-bug-list">';
        bugs.forEach(function(b) {
            html += '<div class="admin-bug' + (b.status === 'new' ? ' admin-bug-new' : '') + '">' +
                '<div class="admin-bug-head"><span class="admin-bug-user">' + escapeHtml(b.username || 'unknown') + '</span><span class="admin-bug-date">' + escapeHtml(b.created_at || '') + '</span></div>' +
                '<div class="admin-bug-msg">' + escapeHtml(b.message) + '</div>' +
                (b.page_url ? '<div class="admin-bug-page">' + escapeHtml(b.page_url) + '</div>' : '') +
                (b.screenshot_url ? '<a href="' + escapeAttr(b.screenshot_url) + '" target="_blank" rel="noopener" class="admin-bug-shot">View screenshot</a>' : '') +
                '<div class="clan-detail-actions"><button class="btn btn-ghost btn-sm admin-bug-toggle" data-id="' + b.id + '" data-status="' + (b.status === 'new' ? 'resolved' : 'new') + '">' + (b.status === 'new' ? 'Mark Resolved' : 'Reopen') + '</button></div>' +
            '</div>';
        });
        html += '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('.admin-bug-toggle').forEach(function(btn) {
        btn.addEventListener('click', async function() {
            await fetch('/server/php/api/admin.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'resolve_bug', bug_id: parseInt(this.dataset.id), status: this.dataset.status }) });
            loadAdminBugs();
        });
    });
}

async function loadAdminClans() {
    var el = document.getElementById('admin-clans');
    if (!el) return;
    var d = {};
    try { d = await (await fetch('/server/php/api/admin.php?action=clans', { credentials: 'include' })).json(); } catch (e) {}
    var clans = d.clans || [];
    var html = '<div class="card"><div class="card-title">Clans (' + clans.length + ')</div>';
    if (clans.length === 0) html += '<p class="empty-state">No clans.</p>';
    else {
        html += '<div class="clan-rank-list">';
        clans.forEach(function(c) {
            html += '<div class="firestorm-open-row"><div><div class="clan-rank-name">' + escapeHtml(c.name) + (c.tag ? ' <span class="clan-tag">[' + escapeHtml(c.tag) + ']</span>' : '') + '</div><div class="clan-rank-meta">' + c.member_count + ' members &middot; ' + c.season_points + ' pts &middot; by ' + escapeHtml(c.founder || '?') + '</div></div>' +
                '<div class="clan-member-controls"><button class="btn btn-ghost btn-sm admin-clan-rename" data-id="' + c.id + '" data-name="' + escapeAttr(c.name) + '">Rename</button><button class="btn btn-ghost btn-sm admin-clan-delete" data-id="' + c.id + '" data-name="' + escapeAttr(c.name) + '">Delete</button></div></div>';
        });
        html += '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('.admin-clan-rename').forEach(function(b) {
        b.addEventListener('click', async function() {
            var nn = prompt('New clan name:', this.dataset.name);
            if (!nn) return;
            var r = await (await fetch('/server/php/api/admin.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'rename_clan', clan_id: parseInt(this.dataset.id), name: nn }) })).json();
            if (r.error) alert(r.error);
            loadAdminClans();
        });
    });
    el.querySelectorAll('.admin-clan-delete').forEach(function(b) {
        b.addEventListener('click', async function() {
            if (!confirm('Delete clan "' + this.dataset.name + '" permanently? This removes all members and its Firestorms.')) return;
            await fetch('/server/php/api/admin.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'delete_clan', clan_id: parseInt(this.dataset.id) }) });
            loadAdminClans();
        });
    });
}

async function loadAdminUsers() {
    var el = document.getElementById('admin-users');
    if (!el) return;
    var d = {};
    try { d = await (await fetch('/server/php/api/admin.php?action=users', { credentials: 'include' })).json(); } catch (e) {}
    var users = d.users || [];
    var html = '<div class="card"><div class="card-title">Users (' + users.length + ')</div><div class="admin-user-list">';
    users.forEach(function(u) {
        html += '<div class="firestorm-open-row"><div><div class="clan-rank-name">' + escapeHtml(u.username) + (u.is_admin ? ' <span class="clan-role clan-role-leader">Admin</span>' : '') + '</div><div class="clan-rank-meta">' + escapeHtml(u.email || '') + ' &middot; Elo ' + (u.elo_rating || 1200) + ' &middot; ' + (u.games_played || 0) + ' games</div></div>' +
            '<button class="btn btn-ghost btn-sm admin-user-toggle" data-id="' + u.id + '">' + (u.is_admin ? 'Remove Admin' : 'Make Admin') + '</button></div>';
    });
    html += '</div></div>';
    el.innerHTML = html;
    el.querySelectorAll('.admin-user-toggle').forEach(function(b) {
        b.addEventListener('click', async function() {
            var r = await (await fetch('/server/php/api/admin.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ action: 'toggle_admin', user_id: parseInt(this.dataset.id) }) })).json();
            if (r.error) alert(r.error);
            loadAdminUsers();
        });
    });
}

// ── Router ──

(function() {
    var path = window.location.pathname;

    if (path === '/' || path === '/index.html') {
        initHomepage();
    } else if (path.startsWith('/leaderboard')) {
        initLeaderboard();
    } else if (path.startsWith('/profile')) {
        initProfile();
    } else if (path.startsWith('/rules')) {
        initRules();
    } else if (path.startsWith('/friends')) {
        initFriends();
    } else if (path.startsWith('/clans')) {
        initClans();
    } else if (path.startsWith('/admin')) {
        initAdmin();
    } else {
        // Unknown page — still run auth check
        checkAuth();
    }
})();
