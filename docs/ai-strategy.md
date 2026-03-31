# Skorch AI Strategy Design

## Philosophy

The AI should think like a competitive card player. Every play is a decision that considers:
- What do I know?
- What does my opponent have?
- What play hurts them most?
- What play protects me best?
- What's left in the game that could change things?

---

## Layer 1: Knowledge Tracking (WHAT DO I KNOW?)

### Known Information (always available)
- My hand (exactly)
- Both prisons - face-up cards (exactly)
- Discard pile contents (exactly)
- Burned cards from Skorch (exactly, removed from game)
- Deck size (exactly)
- Opponent's hand SIZE (exactly)

### Derived Information (calculated)
- Cards remaining in deck + opponent hand + face-down prisons (card counting)
- Probability opponent holds specific card values

### Observed Information (tracked over the game)
- **Opponent pickup tracking**: When opponent picks up the discard pile, we know EXACTLY what cards they got. These are KNOWN cards in their hand (until they play them).
- **Opponent play tracking**: When opponent plays a card, remove it from their known cards.
- **Draw tracking**: When opponent draws from deck, they got an UNKNOWN card.

### Data Structure
```javascript
state._aiMemory = {
    // Cards we KNOW are in opponent's hand (from observed pickups)
    knownOpponentCards: [],  // array of card objects

    // Cards opponent has drawn from deck (unknown values)
    unknownOpponentDraws: 0,

    // Total opponent hand = knownOpponentCards.length + unknownOpponentDraws

    // History of what opponent has played (patterns)
    opponentPlayHistory: [],
}
```

### When to Update
- **Opponent picks up discard**: Add ALL discard pile cards to `knownOpponentCards`
- **Opponent plays a card**: Remove that card from `knownOpponentCards` (if it was known)
- **Opponent draws**: Increment `unknownOpponentDraws`
- **Game reset**: Clear everything

---

## Layer 2: Opponent Modeling (WHAT WILL THEY DO?)

### Given known cards, predict opponent's capabilities:

```javascript
function assessOpponentThreat(state, aiMemory) {
    const known = aiMemory.knownOpponentCards;
    const unknownCount = aiMemory.unknownOpponentDraws;

    return {
        // Highest known attack value opponent has
        highestKnownAttack: Math.max(...known.filter(c => c.type === 'attack').map(c => c.value), 0),

        // Can opponent beat a given value? (certainty level)
        // If we KNOW they have an 8, they can definitely beat 7
        canDefinitelyBeat: (value) => known.some(c =>
            c.type === 'attack' && c.value >= value || c.isSpecial
        ),

        // Number of specials opponent is known to have
        knownSpecials: known.filter(c => c.isSpecial),

        // How many unknown cards they have (could be anything)
        uncertainty: unknownCount,

        // Are they close to winning? (hand size + prison cards remaining)
        cardsToWin: state.player.hand.length + prisonCardsRemaining(state.player.prison),
    }
}
```

---

## Layer 3: Strategic Scoring (WHAT PLAY HURTS THEM MOST?)

These are ADDITIONAL scoring factors added to the existing scoring engine.

### 3A: Block Scoring
**Goal: Play a value the opponent can't beat**

```
If I KNOW opponent's highest attack is 8:
  - Playing a 9: +15 points (they can't beat it with known cards)
  - Playing a 10: +12 points (also can't beat, but wastes a higher card)
  - Playing an 8: +0 (they can match it)
  - Playing a 5: -5 (easy for them)

If opponent has unknown cards:
  - Reduce confidence proportionally
  - 5 unknown cards = less certain about blocking
```

### 3B: Trap Scoring
**Goal: Build a pile they'll have to pick up**

```
If I know opponent can't beat 9, and value is currently 8:
  - Playing a 9 is a TRAP - they'll have to pick up
  - Score: +10 base + (pile_size * 2) because bigger pile = more pain

If pile is already big (8+) and opponent can't beat current value:
  - DON'T play Skorch (let them pick up the pile instead)
  - Skorch score: -20 (don't burn what they'd have to pick up)
```

### 3C: Dump Prevention
**Goal: Don't let them dump known bad cards**

```
If I know opponent has a 2:
  - Don't play a 1 (they dump the 2 easily)
  - Playing a 1 penalty: -10

If I know opponent has low cards (1-3):
  - Play MID values (4-6) to make their lows useless
  - But not too high (save high cards)
```

### 3D: Endgame Awareness
**Goal: When opponent is close to winning, play defensively**

```
If opponent has <= 3 total cards (hand + prison):
  - Play HIGH to block them every turn
  - Save specials for emergency
  - Shield becomes very valuable (skip their turn)

If opponent has 0 hand cards (prison phase):
  - They're playing one card at a time
  - Play values that block their visible prison cards
  - If their prison shows a 5, play a 6+ to force pickup
```

### 3E: Information Denial
**Goal: Don't give opponent free information**

```
When playing from prison:
  - Prefer playing face-down cards when we're ahead (hide our cards)
  - Prefer playing face-up cards when we need guaranteed plays

Stack vs Single decision:
  - If opponent has lots of cards, dump stacks (get ahead)
  - If opponent has few cards, play singles (maintain flexibility)
```

---

## Layer 4: Special Card Strategy

### Skorch
```
Score UP when:
  - Pile contains cards that would help opponent (high attacks, specials)
  - Pile is large AND opponent CAN beat current value (deny them the pile)

Score DOWN when:
  - Opponent CAN'T beat current value (let them pick up instead!)
  - Pile is small (waste of a Skorch)
  - We have attack cards that work
```

### Shield
```
Score UP when:
  - Opponent has 1-2 cards left (deny them turns)
  - We can follow up with an attack on our extra turn
  - Playing Shield empties our hand (reach prison)

Score DOWN when:
  - We have attack cards that beat the value
  - No follow-up possible
  - Opponent has many cards (skipping one turn doesn't matter)
```

### Demoter
```
Score UP when:
  - We can't beat the current value with attacks
  - We have low cards to play after opponent goes
  - Card counting shows few low cards remain (opponent can't follow up easily)

Score DOWN when:
  - We have attacks that work
  - Opponent is known to have low cards (easy follow-up for them)
```

### Elude
```
Score UP when:
  - Can't beat value with attacks
  - Buys time for a draw

Score DOWN when:
  - Attacks work fine
  - Value is low (elude at value 2 is pointless)
```

### Undead
```
Score UP when:
  - Opponent has high-value visible prison cards
  - We have low-value visible prison cards to trade
  - Strategic: take their special cards (Skorch, Shield)

Score DOWN when:
  - No good targets
  - Our prison cards are already good
```

---

## Implementation Plan

### Step 1: Add AI Memory
- Create `_aiMemory` on game state
- Track opponent pickups (we know what they got)
- Track opponent plays (remove from known)
- Track draws (unknown additions)

### Step 2: Add Opponent Assessment
- `assessOpponentThreat()` function
- Uses known cards + card counting for unknowns
- Returns threat assessment object

### Step 3: Add Strategic Scoring
- New function `scoreStrategic(move, state, aiMemory, counting)`
- Returns additional score points (positive or negative)
- Added to existing `scoreMove()` total

### Step 4: Integrate
- Call strategic scoring inside `scoreMove()`
- Add strategic reasoning to thoughts log
- Test against various game scenarios

---

## Example Decision Flow

**Situation:** Opponent just picked up pile containing [2, 8, 8, 8]. Discard is empty. My hand: [1, 5, 7, 9, Shield]

**AI Thinking:**
1. "Opponent has 2, 8, 8, 8 (known) + probably 1 unknown card"
2. "Their highest known attack is 8"
3. "If I play 9, they can't beat it with known cards (only unknown could save them)"
4. "If I play 1, they dump the 2 easily - bad move"
5. "If I play 5, they dump the 2 then play 8 - I lose the initiative"
6. "Best play: 9 (blocks their known 8s, forces pickup or special)"

**Scoring:**
- Attack 1: base 29 - dump_prevention -10 = 19
- Attack 5: base 25 - dump_prevention -5 = 20
- Attack 7: base 23 + partial_block +5 = 28
- Attack 9: base 21 + full_block +15 = 36 ← WINNER
- Shield: base -15 (has attacks) = -15

**Result:** Plays Attack 9 instead of Attack 1
