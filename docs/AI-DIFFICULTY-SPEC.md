# Skorch AI — Difficulty Tiers + Lookahead Spec

## Goal

Turn the single AI into three difficulty levels (Easy / Medium / Hard) and make the
Hard tier genuinely strong by adding one-ply opponent lookahead. Today there is one
bot: `computerTurn()` in `js/ai/computer.js`. It card-counts and remembers the
player's hand from turn one, so a brand-new player's first game is against an expert.
There is no difficulty selector anywhere.

The strategy: **build the tiers by degrading the existing Hard brain, not by writing
new bots.** The current logic IS the Hard tier. Easy and Medium turn features off.

---

## 1. Difficulty model

Add a single `difficulty` string to game state: `'easy' | 'medium' | 'hard'`.
Default `'medium'`.

Each tier is defined by which capabilities are enabled:

| Capability | Easy | Medium | Hard |
|---|---|---|---|
| Legal move generation (never plays illegally) | ✅ | ✅ | ✅ |
| Basic scoring (conserve low, save high, avoid overkill, avoid pickup) | ✅ | ✅ | ✅ |
| Card counting (`countCards` probability model) | ❌ | ✅ | ✅ |
| Opponent memory (`_aiMemory.knownOpponentCards` reads) | ❌ | ❌ | ✅ |
| Special-card strategy (Skorch/Undead/Demoter depth) | shallow | ✅ | ✅ |
| One-ply lookahead (new, section 3) | ❌ | ❌ | ✅ |
| Blunder chance (plays a random legal move instead of best) | 25% | 8% | 0% |

**Design intent per tier:**
- **Easy** — a plausible casual human. Plays legally, roughly conserves cards, but
  is blind to counting/memory and misplays ~1 in 4 turns. Beatable by a first-timer,
  not obviously brain-dead.
- **Medium** — competent. Counts cards, plays the odds, rarely blunders. No memory of
  your hand, no lookahead. This is the honest default.
- **Hard** — the current expert brain PLUS lookahead. Deterministic, no blunders.

---

## 2. Implementation approach for tiers

`computerTurn(state)` currently reads `state` and scores moves. Change the signature to
read difficulty from state (no new parameter needed): `const diff = state.difficulty || 'medium'`.

Derive a capability object once at the top of `computerTurn`:

```js
const caps = getCapabilities(state.difficulty || 'medium');
// { counting: bool, memory: bool, lookahead: bool, blunderChance: number, specialDepth: 'shallow'|'full' }
```

Thread `caps` through the scoring functions. Concretely:

- **`scoreMove` / `scoreSpecial`:** wrap every card-counting block in `if (caps.counting)`.
  The existing code already isolates counting behind `if (counting)` checks — pass
  `caps.counting ? counting : null` as the `counting` argument and most of it already
  no-ops correctly. Verify each `if (counting)` site actually short-circuits cleanly.
- **`scoreStrategic`:** this whole function is opponent-memory + counting. Gate it:
  `if (!caps.memory && !caps.counting) return 0;`. Inside, gate the memory-derived
  parts (`knownOpponentCards`, `allKnownThreats` from memory) behind `caps.memory`,
  and keep the probability-based trap behind `caps.counting`.
- **`specialDepth: 'shallow'`** (Easy only): in `scoreSpecial`, skip the deep
  Skorch-vs-Undead reasoning and the counting-based pile-value bonus. Easy should still
  not throw a Skorch on an empty pile, but it doesn't need to hunt Undead. Simplest
  implementation: if `caps.specialDepth === 'shallow'`, return a minimal score
  (play specials only when no attack works, small pile-size bonus for Skorch) and skip
  the rest of the switch's advanced branches.

### Blunder injection (Easy/Medium)

After moves are scored and sorted descending, before executing `best`:

```js
if (caps.blunderChance > 0 && moves.length > 1 && Math.random() < caps.blunderChance) {
    // pick a random NON-pickup legal move if one exists, else fall through to best
    const nonPickup = moves.filter(m => m.type !== 'pickup');
    if (nonPickup.length > 0) {
        best = nonPickup[Math.floor(Math.random() * nonPickup.length)];
    }
}
```

A blunder is "play a suboptimal legal card," never "pick up when you didn't need to"
(that reads as broken, not human). Keep the pickup filter.

---

## 3. One-ply lookahead (Hard only)

This is the one genuinely careful part. Goal: for the top handful of candidate moves,
simulate the opponent's most likely reply and adjust the score so the bot avoids moves
that set the opponent up.

**Algorithm:**
1. After scoring, take the top `N = 3` non-pickup candidate moves.
2. For each candidate:
   a. **Deep-clone the state** (see cloning note below).
   b. Apply the candidate move to the clone via the real engine functions
      (`playFromHand`) so effects/discard/burn all resolve exactly as in a real turn.
      Then `drawCard` + `nextTurn` on the clone, matching what `main.js` does after a play.
   c. Now it's the opponent's turn on the clone. Estimate their best reply value:
      the opponent's hidden cards are unknown, so use the **probability model**, not real
      cards. Compute the effective value the candidate leaves on the pile, then use
      `countCards(clone).canOpponentBeat(thatValue)`. High beat-probability = the move
      hands the opponent an easy continuation = penalize. Low = the move pressures them = reward.
   d. `lookaheadAdjustment = round((0.5 - beatProb) * WEIGHT)` with `WEIGHT ≈ 12`.
      Positive when the opponent probably can't respond, negative when they can.
3. Add `lookaheadAdjustment` to each candidate's score, re-sort, pick the new best.

**Do NOT** try to simulate the opponent's actual card choice with real hidden cards —
we don't know them, and faking it invites cheating-feeling behavior. The probability
model is the honest signal and it's already built.

### Cloning note (the sharp edge)

`scoreMove`/lookahead must never mutate the live `state`. Use a structured deep clone:

```js
function cloneState(state) {
    return {
        deck: state.deck.map(c => ({...c})),
        discardPile: state.discardPile.map(c => ({...c})),
        burnedCards: (state.burnedCards || []).map(c => ({...c})),
        player: { hand: state.player.hand.map(c => ({...c})), prison: clonePrison(state.player.prison) },
        computer: { hand: state.computer.hand.map(c => ({...c})), prison: clonePrison(state.computer.prison) },
        currentTurn: state.currentTurn,
        turnCount: state.turnCount,
        gameOver: state.gameOver,
        winner: state.winner,
        // _aiMemory deliberately omitted — lookahead must not read/write real memory
    };
}
```

`structuredClone(state)` is acceptable IF `_aiMemory` and any functions are stripped
first — but the explicit clone above is safer and self-documenting. Whichever is used,
**write a test that runs lookahead and then asserts the original `state` is byte-identical
to a snapshot taken before** (deep-equal on a JSON copy). This is the regression that
matters most.

Performance: N=3 candidates × one clone + one `countCards` each = trivial. No recursion,
no deeper plies. Keep it one-ply.

---

## 4. UI — difficulty selector

`onRestart()` in `js/main.js:460` and `createGameState()` in `js/engine/game.js:5` are
the seams.

1. **`createGameState`** takes an optional difficulty: `createGameState(difficulty = 'medium')`
   and stores it on state: `difficulty`. (Multiplayer's `game-engine.js` copy is
   unaffected — no AI there. Leave it alone.)
2. **Persist choice** in `localStorage` under a new key (e.g. `skorch_ai_difficulty`),
   separate from the `SAVE_KEY` game-state blob. Read it when creating a new game so the
   player's last choice sticks across sessions.
3. **Selector UI:** a three-way segmented control (Easy / Medium / Hard) shown:
   - on the game-over screen next to "Restart Game" (so they can change and replay), and
   - in the mobile drawer near the existing restart item (`renderer.js:463`).
   Changing difficulty starts a new game (calls `onRestart` with the new value). Match the
   existing button styling — no new design language. Follow the project's CSS rules
   (no inline `<style>` in content; styles go in `css/styles.css`).
4. **Saved-game caveat:** `loadState()` restores an in-progress game including its stored
   `difficulty`. If an older save has no `difficulty`, default to `'medium'` on load.

---

## 5. Code-standards & constraints

- Zero comments in shipped code (the inline snippets above are spec illustration only —
  do not carry the `//` notes into `computer.js`).
- No `console.log` left behind (the AI's `thoughts` array stays — that's an existing
  intentional debug channel logged from `main.js`; don't expand it).
- Keep everything in `js/ai/computer.js` + the two seams (`game.js` signature, `main.js`
  wiring) + `renderer.js` for UI + `css/styles.css`. Don't scatter difficulty logic.
- The multiplayer server (`server/ws/`) has NO AI and must not be touched.

---

## 6. Test plan (must pass before "done")

Write a small Node harness (like the existing `verify-engine.mjs` pattern) that imports
the real engine + AI and asserts:

1. **Legality:** across 500 simulated AI turns at each difficulty, every executed move is
   a legal move (or a legitimate pickup). No exceptions thrown, no stuck state.
2. **State purity:** taking a JSON snapshot before `computerTurn` on Hard, running it, and
   confirming lookahead did not mutate anything except through the normal single executed
   move. (Snapshot the clone path specifically.)
3. **Tier differentiation:** simulate 200 full Easy games and 200 full Hard games vs a
   fixed baseline policy (e.g. "always play lowest legal card"); Hard's win rate must be
   materially higher than Easy's. This proves the tiers actually differ in strength, not
   just in config.
4. **Blunder rate:** over many Easy turns with >1 legal move, the fraction where the bot
   played a non-best move is within a sane band of 25% (e.g. 15–35%).
5. **Elude/reset still correct** (guards the earlier fix): AI never treats a
   Demoter/Skorch-reset pile as having the old value.

Report the numbers from runs 1–4. Do not claim done on "it compiles."

---

## Build order

1. Capability model + thread `caps` through scoring (tiers work, no lookahead yet).
2. Blunder injection.
3. Lookahead + cloning + state-purity test.
4. `createGameState` signature + `main.js` wiring + localStorage persistence.
5. Selector UI in `renderer.js` + `css/styles.css`.
6. Run the full test harness, report numbers, deploy.
