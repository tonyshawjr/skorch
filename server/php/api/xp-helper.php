<?php
/**
 * XP & Level calculation helpers for Skorch.
 *
 * Level curve:
 *   1-10:   100 XP each
 *  11-25:   250 XP each
 *  26-50:   500 XP each
 *  51-75:  1000 XP each
 *  76-100: 2000 XP each
 */

/**
 * Returns the total XP required to reach a given level.
 * Level 1 requires 0 XP (starting level).
 */
function xpForLevel($level) {
    if ($level <= 1) return 0;

    $xp = 0;
    for ($l = 2; $l <= $level; $l++) {
        if ($l <= 10) {
            $xp += 100;
        } elseif ($l <= 25) {
            $xp += 250;
        } elseif ($l <= 50) {
            $xp += 500;
        } elseif ($l <= 75) {
            $xp += 1000;
        } else {
            $xp += 2000;
        }
    }
    return $xp;
}

/**
 * Calculate the level for a given total XP amount.
 * Returns a level between 1 and 100.
 */
function calculateLevel($xp) {
    $level = 1;
    while ($level < 100) {
        $needed = xpForLevel($level + 1);
        if ($xp < $needed) break;
        $level++;
    }
    return $level;
}

/**
 * Returns XP still needed to reach the next level.
 * If already at max level (100), returns 0.
 */
function xpForNextLevel($currentXp, $currentLevel) {
    if ($currentLevel >= 100) return 0;
    $nextLevelXp = xpForLevel($currentLevel + 1);
    return max(0, $nextLevelXp - $currentXp);
}

/**
 * Award XP to a user, recalculate their level, and persist to DB.
 *
 * @param SQLite3 $db
 * @param int     $userId
 * @param int     $amount  XP to add
 * @return array  ['xp' => int, 'level' => int, 'leveled_up' => bool, 'xp_gained' => int]
 */
function awardXP($db, $userId, $amount) {
    // Get current values
    $row = $db->query("SELECT xp, level FROM stats WHERE user_id = $userId")->fetch();
    $oldXp    = (int)($row['xp'] ?? 0);
    $oldLevel = (int)($row['level'] ?? 1);

    $newXp    = $oldXp + $amount;
    $newLevel = calculateLevel($newXp);

    // Cap at level 100
    if ($newLevel > 100) $newLevel = 100;

    $db->exec("UPDATE stats SET xp = $newXp, level = $newLevel WHERE user_id = $userId");

    return [
        'xp'        => $newXp,
        'level'     => $newLevel,
        'leveled_up' => $newLevel > $oldLevel,
        'xp_gained' => $amount,
    ];
}
