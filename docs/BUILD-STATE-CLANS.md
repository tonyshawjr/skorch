# Skorch Gamification Build — State

## Naming (locked)
- Groups = **Clans** (C, never K)
- Clan-vs-clan battle = **Firestorm** (default; "Firefight" is an alt swap)

## Plan (5 features, in order)
1. Friends (fix + finish) — DONE, live
2. Clans + clan points — DONE, live
3. Firestorm (clan wars) — DONE, live (backend + UI). LIVE 2-PLAYER MATCH FLOW needs owner test (can't self-test).
4. Seasons — DONE, live (admin-controlled: start/end, snapshot, champion badge, reset). Verified backend.
5. Admin + bug reports — DONE, live (/admin page gated by is_admin; site-wide bug button). Verified backend + pages.

## Feature 4-5 files (live)
- `server/php/api/admin.php` — check/stats/users/clans/rename_clan/delete_clan/bug_reports/resolve_bug/season_current/season_start/season_end/toggle_admin. Gated by users.is_admin.
- `server/php/api/report-bug.php` — POST message + page_url + optional screenshot (reuses avatar upload pattern → /server/php/uploads/bugs/).
- `admin/index.html` — admin page (site.js?v=3), reachable at /admin (only admins see content).
- `js/site.js` — initAdmin + loadAdminOverview/Bugs/Clans/Users, showBugModal, site-wide floating bug button (🐛), router case /admin.
- Season champion badge id='clan_champion' inserted on first season_end.
- NOTE: bug button appears on all site.js pages (not on /play, which uses main.js only).

## Firestorm files (Feature 3, live)
- `server/php/api/firestorm.php` — open/mine/get/create/accept/random/cancel/publish_room/get_room/report + auto-finalize + 24h expiry. room_code column added to firestorm_matches.
- `js/site.js` — Firestorm section on clan detail page (loadFirestormSection, renderFirestormActive/MatchRow, showFirestormLineupModal, showFirestormBrowseModal, wireFirestormMatch, fsTimeLeft). Uses window.__me for host/guest.
- `js/main.js` — ALL gated behind `?firestorm=`/`_firestormMatch` (normal play untouched): module var `_firestormMatch` + `reportFirestorm()`; onRoomCreated publishes room code; both onGameOver call reportFirestorm; bootstrap parses ?firestorm&seed&role, host auto-creates room.
- Rendezvous: host = challenger side (deterministic). Host `/play?firestorm=X&seed=N&role=host` auto-creates room + publishes code. Guest card polls get_room → `/play?join=CODE&firestorm=X&seed=N`. Both report result at game-over.
- CACHING: main.js has no version query — returning players may need a hard-refresh of /play to get firestorm hooks. Normal play unaffected either way.

## Deploy method (IMPORTANT — host SSH throttles rapid connections)
- Host SSH (port 18765) blocks rapid successive connections (fail2ban-style). ONE spaced connection works; the multi-connection `deploy.sh` gets throttled.
- Deploy via single tar-pipe with retries:
  `tar czf - <files> | ssh -p 18765 HOST "cd REMOTE && tar xzf -"`
- Run DB migrations in ONE ssh connection (base64-encode SQL inline, or pipe).
- HTTPS (curl to the site, port 443) is NOT throttled — use it for verification.
- Host: `u1045-zotpfpmgzcoh@ssh.skorchthegame.com`, REMOTE `~/www/play.skorchthegame.com/public_html`
- sqlite3 CLI IS available on the host. Live DB at `server/php/db/skorch.db`.
- Shell here is zsh: unquoted `$VAR` does NOT word-split — pass file lists literally to tar.
- Server responses intermittently come back empty (0 bytes) — retry past it.

## DB state (live, migrated)
- Migration `server/php/db/migrations/001_clans_firestorms.sql` RAN on live DB.
- Tables added: clans, clan_members, clan_requests, firestorms, firestorm_lineups, firestorm_matches, seasons, clan_season_history, bug_reports.
- `users.is_admin` column added; `tonyshawjr` = 1 (admin). Others = 0.
- Users: 2 tonyshawjr, 3 tester, 4 DarkFox, 5 sKorchQUEEN222.

## Clan points (in match.php, on win)
easy=1, medium=2, hard=4, insane=8, pvp/multiplayer=10, loss=0. Credits clans.season_points/total_points + clan_members.season_points/total_points.

## Files (Features 1-2)
- `friends/index.html`, `clans/index.html` — new pages (site.js?v=3)
- `js/site.js` — nav-inject IIFE (Clans+Friends links), isRecentlyActive(), initFriends + loaders, initClans + renderClanHub/Detail/etc., router cases for /friends and /clans
- `server/php/api/clans.php` — full clan endpoint (list/mine/get/create/join/requests/approve/decline/leave/kick/promote/demote/update/disband)
- `server/php/api/friends.php` — fixed status query (added `id`)
- `server/php/api/search.php` — removed city/state (privacy)
- `server/php/api/match.php` — clan-points hook
- `css/styles.css` — friend-row + clan-* styles appended
- `deploy.sh` — added friends/ and clans/ dirs + scp lines

## Verified (to auth boundary)
- /friends and /clans render; site.js v3 has the code; search.php no longer leaks location; clans.php + match.php run clean (proper 401/405). NOT click-tested logged-in (no owner credentials) — owner should playtest create/join.

## Firestorm (Feature 3) — design (from owner)
- Leader starts a Firestorm, sets seeded lineup of N (default 5). Status=open, appears in open-wars list.
- Another leader browses open list OR hits Random (match to clan of similar member_count). Picks it, sets lineup → active, ends_at = now +24h.
- Seed-vs-seed relay: each seed pair plays one live PvP match within 24h. Majority of seed wins = Firestorm winner. Updates clans.firestorm_wins/losses + clan points bonus.
- Integration: live multiplayer server is `server/ws/` (Socket.io, deployed to skorch-multiplayer.onrender.com). A firestorm match must tag its room with firestorm_id+seed so the result reports back. NEEDS investigation of server/ws/ before building.

## Seasons (Feature 4) — design
- Monthly. Admin start/end. On end: snapshot standings to clan_season_history, crown top clan (seasons.champion_clan_id), award champion badge (reuse badges/user_badges), reset clans.season_points + clan_members.season_points to 0.

## Admin + Bug reports (Feature 5) — design
- `is_admin` flag exists. Build `/admin` page (vanilla) gated by is_admin: list/manage users + clans (rename/nuke), start/end seasons, read bug_reports.
- Bug report: site-wide button → message + optional screenshot (reuse upload-avatar plumbing) → bug_reports table → admin page.

## ✅ CUTOVER COMPLETE (2026-07-21) — everything off SiteGround
Full SiteGround→Hostinger VPS migration is DONE and LIVE on DNS. Authoritative hosting map + deploy steps + creds pointers live in ProjectOS memory `infra_skorch_hosting.md`. Summary:
- **Game** `play.skorchthegame.com` → VPS `2.25.83.53` (`/home/skorch/htdocs/...`), live SQLite DB + avatars, create-clan verified, real LE SSL, ~0.15s.
- **Marketing WP** `skorchthegame.com` → VPS (`skorchwp` site/db, prefix `ktb_`), Elementor intact, SG plugins removed, real LE SSL, ~0.59s.
- **DNS** → name.com (vanity NS ns1mpz/ns2hjl/ns3qtx/ns4jpz.name.com), A records → 2.25.83.53.
- **Email** → MXroute, `marketing@skorchthegame.com` (send+receive verified).
- **Multiplayer** → still on Render (unchanged).
- **Old-mail migration: NOT NEEDED** (old mailbox = closed MailChimp only). SiteGround still active as fallback — cancel after Tony confirms; verify account `u1045` hosts nothing else first.
- **Next (optional):** WP caching+security plugins; move multiplayer off Render to VPS.

## VPS Migration (history — done, see checkpoint above)
- **Target VPS:** Hostinger id 1822492, IP `2.25.83.53`, Ubuntu 24.04 + CloudPanel 6.0.8, PHP 8.4 (sqlite3/gd/fileinfo/curl all present), 4CPU/16GB. SSH: `ssh -i ~/.ssh/hostinger_vps_ed25519 root@2.25.83.53`.
- **Current host:** SiteGround (throttles hard). SSH `u1045-zotpfpmgzcoh@ssh.skorchthegame.com:18765`. Sites under `~/www/`.
- **DNS:** at **name.com** (user will do cutover later; NOT changing yet).
- **DONE:** CloudPanel PHP site `play.skorchthegame.com` created (siteUser `skorch`, docroot `/home/skorch/htdocs/play.skorchthegame.com`, pw in scratchpad/vps-creds.txt). App deployed from LOCAL copy (latest, has all today's fixes). Test/scaffold DB in place (from 12:45 backup + migration applied). nginx DB-deny rule added (`location ^~ /server/php/db/`). Self-signed cert active. VERIFIED via `curl -k --resolve play.skorchthegame.com:443:2.25.83.53`: homepage 0.15s, all pages 200, register+create-clan full flow works, DB file 404-blocked.
- **REMAINING:** (1) pull LIVE skorch.db from SiteGround → replace scaffold DB (needs SiteGround responsive — throttled now). (2) migrate marketing site skorchthegame.com (survey on SiteGround first — WP?). (3) move multiplayer Node/Socket.io off Render to VPS (site:add:nodejs) + update hardcoded URL. (4) DNS cutover at name.com + real Let's Encrypt SSL (`clpctl` / CloudPanel). 
- Test via: `curl -k --resolve play.skorchthegame.com:443:2.25.83.53 https://play.skorchthegame.com/`

## VPS Migration — UPDATE (both sites migrated & working, staged)
- GAME (play.skorchthegame.com): app + LIVE DB swapped (4 users, 14 matches, real data) + avatars copied. 0.15s. register+create-clan verified working. DB web-blocked.
- MARKETING (skorchthegame.com): WordPress site created (siteUser skorchwp, PHP 8.2, DB skorchwp), 18262 files + DB imported, wp-config repointed to VPS MySQL (prefix ktb_), siteurl->https, wp search-replace http->https (500 repls, Elementor-safe), deactivated SG plugins (sg-cachepress/sg-security/sg-ai-studio). 0.59s. homepage/how-to-play/wp-login all 200.
- Both tested via `curl -k --resolve <domain>:443:2.25.83.53` — live DNS UNTOUCHED.
- REMAINING: (1) name.com DNS cutover (USER): A records skorchthegame.com + www + play.skorchthegame.com -> 2.25.83.53. (2) After DNS: real Let's Encrypt SSL via CloudPanel (both domains). (3) Optional: move multiplayer Node off Render to VPS + update hardcoded URL. (4) Optional: WP caching + general security plugin (replaced SG ones).
- Creds in scratchpad/vps-creds.txt (skorch + skorchwp site/db passwords).
