# Skorch Mobile Layout Design

## Problem
Desktop shows player + opponent side-by-side with floating center piles.
On mobile, everything is too small and cramped.

## Mobile Layout (top to bottom, full width)

```
[Header: Logo | Turn Indicator | Menu]
[Opponent Info Bar: Name | Card Count | Prison Mini]
[=== DISCARD PILE (large, centered) ===]
[=== Value to Beat badge ===]
[=== PLAY / PICKUP buttons (full width) ===]
[Your Hand (cards, full width, scrollable)]
[Your Prison (5 across, compact)]
[Status Bar]
```

## Key Decisions

1. **Opponent's hand**: Just show count, not cards. Save space.
2. **Opponent's prison**: Show as small icons or a compact row above discard.
3. **Discard pile**: LARGE and centered - most important visual.
4. **Your hand**: Full-width, cards at readable size, horizontal scroll if needed.
5. **Your prison**: Always 5 across, can be smaller than hand cards.
6. **Draw pile**: Small, next to discard or below buttons.
7. **Buttons**: Full width, easy to tap.
