# Skorch Database Migration Plan — SQLite → MySQL

Plain-language plan for moving the game's database off SQLite onto a real database server, while the app is still small and the move is safe. Nothing here is built yet — this is the plan to review first.

---

## The short version

- **Recommendation: MySQL, not Postgres.** Both are excellent; for *what Skorch actually does*, MySQL is the better fit — mainly because it's already running on the VPS (WordPress uses it), so this move costs **$0 in new infrastructure** and adds **zero new things to maintain**. More on the choice below.
- **Why now:** you have ~4 users and a handful of matches. Copying that is trivial and risk-free. The same move under real traffic later is a scary, downtime-prone operation. Doing it now means you *never* have to do the scary version.
- **The work is real but contained:** it's a code job, not a hardware job. About **2 focused days**, done in safe phases where the live game keeps running on SQLite the whole time until we flip one switch at the very end.
- **The multiplayer server is unaffected** — it doesn't touch the database at all. This only touches the game's PHP backend.

---

## MySQL vs Postgres — the honest call for us

The reflex answer in tech is "use Postgres." It's a great database. But the right question is *what does Skorch need*, and the answer points to MySQL:

| What matters here | MySQL | Postgres |
|---|---|---|
| **Already on the VPS?** | ✅ Yes — WordPress runs on it. Reuse it, nothing new to install, back up, or babysit. | ❌ No — a second database engine to install, run, and back up separately. |
| **The actual workload** (logins, matches, leaderboards, clans) | Plain, everyday database work. MySQL does this in its sleep. | Also easy — but no feature here needs Postgres's extra power. |
| **Case-insensitive name lookups** (clan/user names) | ✅ This is MySQL's *default* behavior — the current `COLLATE NOCASE` code basically maps to "how MySQL already works." | Needs an extra extension or `LOWER()` rewrites. |
| **The one JSON field** (profile social links) | ✅ Native JSON type, fine. | ✅ Slightly richer JSON — but we have exactly one field, so it doesn't matter. |
| **Management tools** | ✅ phpMyAdmin already available in CloudPanel; same engine you already use. | More manual on this box. |
| **Ops simplicity** | ✅ One database engine for the whole VPS. One backup routine. One thing to reason about. | Two engines, two backup strategies, two things that can break. |

**Bottom line:** Postgres would be the pick if we expected heavy analytics, complex data types, or a data-hungry backend service down the road. We don't — Skorch is straightforward game data. MySQL is already there, fits the workload perfectly, and keeps the whole server to one database engine. That's the win.

> If you ever *did* want to switch to Postgres later, the plan below uses PHP's **PDO** database layer, which is the portable one — so that door stays open. We're not locking ourselves in.

---

## What we're actually moving (the real picture)

The database has **16 tables**: players (`users`, `stats`), games (`matches`), social (`friends`, `password_resets`), gamification (`badges`, `user_badges`), and the whole Clans/Firestorm/Seasons system (`clans`, `clan_members`, `clan_requests`, `firestorms`, `firestorm_lineups`, `firestorm_matches`, `seasons`, `clan_season_history`, `bug_reports`).

The game's PHP makes about **181 database calls across 22 files**. Every one of those calls uses SQLite's specific commands, so each needs to be rewritten to speak MySQL. That's the bulk of the work — mechanical, but it has to be done carefully and tested.

**The catch we found:** the schema files in the repo are out of date — real tables and columns were added directly to the live database over time and never written back. So we start by capturing the *real* current shape from the live VPS database, not from the repo. (Bonus: when we're done, the repo will finally have an accurate, up-to-date schema again.)

---

## The plan, in phases

Each phase is a safe checkpoint. **The live game runs on SQLite the entire time** — we build and test the MySQL version alongside it, and only switch over at the very end. If anything looks wrong, we flip back instantly.

**Phase 1 — Capture the truth ✅ DONE (2026-07-21)**
Pulled the live database from the VPS, dumped its *real* schema (all 16 tables + the columns missing from the repo), and wrote a clean MySQL version to `server/php/db/schema.mysql.sql` — now the accurate source of truth.

**Phase 2 — Build the new database ✅ DONE (2026-07-21)**
Created MySQL db `skorchgame` on the VPS, loaded all 16 tables, copied the live data in and verified every table's row count AND spot-checked values (users, is_admin, Elo, clan, badges) against the live SQLite source — all match. The live game still runs on SQLite; MySQL is staged alongside it, unused until the rewire.

**Phase 3 — Rewrite the code ✅ DONE (2026-07-21)**
Ported the PHP data layer SQLite3 → native PDO/MySQL. `getDB()` returns a PDO connection (creds in gitignored `server/php/db-secrets.php`). All 21 API files converted via a guarded swarm (convert + adversarial verify per file), plus the foundational `config.php`/`auth.php`/`init.php` by hand. SQLite-only bits handled: auto-increment, `INSERT OR IGNORE`→`INSERT IGNORE`, `datetime('now')`→`NOW()`, `COLLATE NOCASE` removed, `LIMIT` placeholders, `lastInsertRowID`→`lastInsertId`, `changes()`→`rowCount()`. Grep-gate confirmed zero leftover SQLite-isms; all files pass `php -l`. Transactions deferred (kept behavior-identical for a lower-risk cut). **3 latent bugs found + fixed** (all surfaced by MySQL's stricter error handling): `MAX(a,b)`→`GREATEST(a,b)` in match.php; two obsolete runtime `CREATE TABLE` blocks removed; a pre-existing `matches.created_at`→`played_at` column bug SQLite had been silently swallowing.

**Phase 4 — Test everything ✅ DONE (2026-07-21)**
Deployed to an isolated staging server on the VPS pointed at a throwaway copy DB (`skorchgametest`), then exercised every endpoint end-to-end: register/login/profile, match (win/insane → badges/XP/level-up), friends, search, leaderboard, history, xp, badges, clans (create/mine/list), Firestorm (create), admin (stats/users/clans/bug_reports/season_current), and the destructive lifecycle (season_end → champion crowned + snapshot + reset, season_start, rename_clan). All green. Complex untested-dynamically paths (firestorm accept/report, clan management, reset-password) statically audited column-by-column against the schema — clean.

**Phase 5 — Flip the switch ✅ DONE (2026-07-21)**
Backed up live code to `server/php.sqlite-bak` (instant rollback), deployed the PDO code to the live docroot pointed at production `skorchgame`, chowned to `skorch`. Smoke-tested the live site over HTTPS — all endpoints 200 on real data, auth/sessions work, throwaway test user cleaned up. Production data verified intact (4 users, 15 matches, 1 clan, 31 badges). Staging scaffolding torn down. SQLite file + code backup kept ~1 week, then delete.

## Status: ✅ COMPLETE — the game runs on MySQL as of 2026-07-21.
Rollback if ever needed: `rm -rf server/php && mv server/php.sqlite-bak server/php` on the VPS (restores the SQLite version); the old `skorch.db` is untouched.
Optional follow-ups: strip the inconsistent pre-existing code comments (some files lost them during conversion, some kept them); add DB transactions to the multi-step operations.

---

## What could go wrong — and how we're protected

- **A rewritten query behaves differently.** → That's exactly why Phase 4 tests every endpoint against near-zero data, where mistakes are obvious and harmless. And the live game isn't switched over until it all passes.
- **Data doesn't copy correctly.** → Phase 2 verifies the copied data against the original before anything depends on it.
- **The switch-over goes bad.** → It's one config line. Flipping back to SQLite is instant, and the SQLite file is left fully intact.
- **The hidden schema drift bites us.** → Phase 1 exists specifically to catch it — we build from the live database, not the stale repo files.

There is **no risky moment** in this plan. That's the whole point of doing it now instead of later.

---

## Effort & cost

- **Time:** ~2 focused days, phased.
- **New infrastructure cost:** **$0** — reuses the MySQL already running on the VPS.
- **Ongoing:** the same VPS, one database engine for everything, one backup routine (`mysqldump`) instead of copying a file.

---

## What I need from you to start

1. **Confirm MySQL** (my recommendation) — or say Postgres if you'd rather, and I'll adjust.
2. **A "go"** — then I start at Phase 1. I'll report at the end of each phase, and nothing touches the live game until the final switch, which we do together.
