# Bucket 2 — Server-Authoritative Match Results (design)

## The problem
`match.php` trusts whatever the client sends (`won`, `opponent_id`, `skorches`, `game_type`). Two distinct abuses:
- **PvP/multiplayer (CRITICAL):** a client can POST a fake result naming another player as the loser, driving *anyone's* Elo to the floor without them playing, and can farm clan points/XP. This affects other people.
- **AI/single-player:** a client can self-report wins vs. the AI to farm its own Elo/XP/badges. Affects only the cheater.

These need different solutions because the AI game runs entirely in the browser — no server ever witnesses it — while PvP runs on the Node server, which *does* know the real game.

## Root cause (from the audit)
The multiplayer server has **no authenticated identity** — clients send a bare `username` string. Even if we wanted the Node server to report results, it doesn't reliably know *who* the players are. So step one is identity.

## Design

### Part A — PvP becomes server-authoritative
1. **Identity ticket.** New PHP endpoint `GET /api/ws-ticket.php`: for the logged-in session, returns a short-lived signed ticket = `HMAC_SHA256(user_id . ':' . username . ':' . expiry, SHARED_SECRET)` plus the raw fields. The client sends this ticket when it creates/joins a room. The Node server verifies the HMAC with the shared secret and now knows each socket's real `user_id` (no cross-origin session sharing needed — the identity is carried and signed).
2. **Authoritative reporting.** When the Node server hits `checkWin` (it already does), it POSTs the result to a new PHP endpoint `POST /api/report-match.php` with a shared-secret header: `{player1_id, player2_id, winner_id, game_type:'multiplayer', nonce}`. PHP verifies the secret, dedupes by `nonce`, and applies the match + Elo + clan points exactly once. **The client stops reporting PvP results.**
3. **Lock it down.** `match.php` rejects `game_type` of `multiplayer`/`pvp` from clients entirely — only the Node server (via `report-match.php`) can create ranked PvP results. This also fixes the Firestorm "first-to-report wins" race (Firestorm reporting rides the same authoritative path).

### Part B — AI matches get clamped (can't be authoritative)
Keep client-reported (nothing else can witness a browser-only game), but:
- Clamp every counter (`skorches`, `shields`, etc.) to a per-match maximum; reject impossible values.
- Rate-limit match submissions per user (a real game takes minutes; block rapid-fire farming).
- Cap AI-match clan points / XP.
This **bounds** self-farming without eliminating it. Acceptable because AI cheating only inflates the cheater's own numbers.

### Shared secret
A new secret added to `db-secrets.php` (PHP side) and a Render environment variable (Node side). HMAC-SHA256, never in the repo.

## Deployment (coordinated, 3 surfaces)
1. **VPS/PHP first** (backward-compatible): `ws-ticket.php`, `report-match.php`, `match.php` clamps.
2. **Node → Render** (git push): verify ticket, POST authoritative result. **Requires a push to `github.com/tonyshawjr/skorch` → Render auto-deploy.**
3. **Client → VPS**: send the ticket on create/join; stop reporting PvP results.

## Testing reality (the hard part)
A real PvP game needs **two live browser clients** — I can't exercise that solo. Options:
- **(a)** You playtest one live multiplayer game after deploy while I watch logs, or
- **(b)** I first build a scripted two-socket test client that simulates two players end-to-end (more work, but lets me verify before you touch it).

## Decisions I need before building
1. **Approve this approach?** (Node-authoritative PvP via signed ticket + report endpoint; AI clamped.)
2. **Render deploy:** OK for me to push to GitHub `main` (triggers Render), or will you deploy the Node side?
3. **Testing:** option (a) you playtest, or (b) I build the scripted two-client harness first?
