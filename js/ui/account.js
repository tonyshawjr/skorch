// js/ui/account.js
import { login, register, getProfile, logout, isLoggedIn, getUser } from '../multiplayer/auth.js';

export function showAccountModal(onClose) {
    const overlay = document.createElement('div');
    overlay.className = 'account-overlay';

    const user = getUser();

    if (user) {
        // Show profile
        overlay.innerHTML = `
            <div class="account-modal">
                <button class="account-close">&times;</button>
                <div class="account-profile">
                    <div class="profile-avatar">${user.username.charAt(0).toUpperCase()}</div>
                    <h2 class="profile-name">${user.username}</h2>
                    <div class="profile-stats">
                        <div class="stat-item">
                            <div class="stat-value">${user.wins || 0}</div>
                            <div class="stat-label">Wins</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${user.losses || 0}</div>
                            <div class="stat-label">Losses</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${user.games_played || 0}</div>
                            <div class="stat-label">Played</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${user.best_streak || 0}</div>
                            <div class="stat-label">Best Streak</div>
                        </div>
                    </div>
                    <button class="account-btn account-btn-logout" id="account-logout">Log Out</button>
                </div>
            </div>
        `;
    } else {
        // Show login/register tabs
        overlay.innerHTML = `
            <div class="account-modal">
                <button class="account-close">&times;</button>
                <div class="account-tabs">
                    <button class="account-tab active" data-tab="login">Log In</button>
                    <button class="account-tab" data-tab="register">Sign Up</button>
                </div>
                <div class="account-form" id="login-form">
                    <input type="text" placeholder="Username" class="account-input" id="login-user" autocapitalize="none" autocorrect="off">
                    <input type="password" placeholder="Password" class="account-input" id="login-pass">
                    <button class="account-btn account-btn-primary" id="login-btn">Log In</button>
                    <div class="account-error" id="login-error"></div>
                </div>
                <div class="account-form" id="register-form" style="display:none;">
                    <input type="text" placeholder="Username" class="account-input" id="reg-user" autocapitalize="none" autocorrect="off">
                    <input type="email" placeholder="Email" class="account-input" id="reg-email">
                    <input type="password" placeholder="Password (6+ chars)" class="account-input" id="reg-pass">
                    <button class="account-btn account-btn-primary" id="reg-btn">Create Account</button>
                    <div class="account-error" id="reg-error"></div>
                </div>
            </div>
        `;
    }

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    // Close button
    overlay.querySelector('.account-close').addEventListener('click', () => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 200);
        if (onClose) onClose();
    });

    // Click outside to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 200);
            if (onClose) onClose();
        }
    });

    if (user) {
        // Logout
        overlay.querySelector('#account-logout').addEventListener('click', async () => {
            await logout();
            overlay.remove();
            showAccountModal(onClose);
        });
    } else {
        // Tab switching
        overlay.querySelectorAll('.account-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                overlay.querySelectorAll('.account-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('login-form').style.display = tab.dataset.tab === 'login' ? '' : 'none';
                document.getElementById('register-form').style.display = tab.dataset.tab === 'register' ? '' : 'none';
            });
        });

        // Login
        overlay.querySelector('#login-btn').addEventListener('click', async () => {
            const username = overlay.querySelector('#login-user').value.trim();
            const password = overlay.querySelector('#login-pass').value;
            if (!username || !password) { showError('login-error', 'Fill in all fields'); return; }
            const result = await login(username, password);
            if (result.success) {
                overlay.remove();
                showAccountModal(onClose);
            } else {
                showError('login-error', result.error || 'Login failed');
            }
        });

        // Register
        overlay.querySelector('#reg-btn').addEventListener('click', async () => {
            const username = overlay.querySelector('#reg-user').value.trim();
            const email = overlay.querySelector('#reg-email').value.trim();
            const password = overlay.querySelector('#reg-pass').value;
            if (!username || !email || !password) { showError('reg-error', 'Fill in all fields'); return; }
            const result = await register(username, email, password);
            if (result.success) {
                overlay.remove();
                showAccountModal(onClose);
            } else {
                showError('reg-error', result.error || 'Registration failed');
            }
        });
    }

    function showError(id, msg) {
        const el = document.getElementById(id);
        if (el) { el.textContent = msg; setTimeout(() => el.textContent = '', 3000); }
    }
}
